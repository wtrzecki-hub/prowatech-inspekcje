/**
 * Tworzenie konta użytkownika przez admina (z poziomu Ustawienia → Użytkownicy).
 *
 * Obsługuje wszystkie 4 role:
 *  - admin / inspector / viewer — pracownicy ProWaTech (lub zewnętrzni audytorzy)
 *  - client_user — analogicznie do `/api/portal/create-account`, dodatkowo wymaga `client_id`
 *
 * Mechanizm:
 *  - POST { email, full_name?, phone?, role, client_id? }
 *  - Generuje temp password XXXX-XXXX-XXXX (alfabet bez 0/1/I/O)
 *  - Tworzy konto przez auth.admin.createUser (service_role)
 *  - upsert profiles z `force_password_change: true`
 *  - Jeśli role='client_user': INSERT do client_users (rollback przez deleteUser jeśli błąd)
 *  - Zwraca { tempPassword, userId } do wyświetlenia w UI
 *
 * Bezpieczeństwo:
 *  - Sprawdza role='admin' wywołującego
 *  - SUPABASE_SERVICE_ROLE_KEY z env (Vercel — Sensitive)
 */

import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = "https://lhxhsprqoecepojrxepf.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoeGhzcHJxb2VjZXBvanJ4ZXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTE0NTksImV4cCI6MjA5MDYyNzQ1OX0.sb8WzlwpPAl4tj6CQgIH34PAQRklUmLeDFOMOS2kUi0";

const VALID_ROLES = ["admin", "inspector", "viewer", "client_user"] as const;
type UserRole = (typeof VALID_ROLES)[number];

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const seg = () =>
    Array.from(
      { length: 4 },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  return `${seg()}-${seg()}-${seg()}`;
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {}
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    email?: string;
    full_name?: string;
    phone?: string;
    role?: string;
    client_id?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const full_name = body.full_name?.trim() || null;
  const phone = body.phone?.trim() || null;
  const role = body.role as UserRole | undefined;
  const client_id = body.client_id?.trim() || null;

  if (!email) {
    return NextResponse.json({ error: "Email jest wymagany" }, { status: 400 });
  }
  if (!role || !VALID_ROLES.includes(role)) {
    return NextResponse.json(
      { error: "Nieprawidłowa rola" },
      { status: 400 }
    );
  }
  if (role === "client_user" && !client_id) {
    return NextResponse.json(
      { error: "Dla użytkownika klienta wymagany jest client_id" },
      { status: 400 }
    );
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error("SUPABASE_SERVICE_ROLE_KEY not configured");
    return NextResponse.json(
      { error: "Błąd konfiguracji serwera (brak service role key)" },
      { status: 500 }
    );
  }

  const adminClient = createAdminClient(SUPABASE_URL, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Walidacja klienta przed tworzeniem konta (gdy client_user)
  if (role === "client_user" && client_id) {
    const { data: clientRow, error: clientErr } = await adminClient
      .from("clients")
      .select("id, name")
      .eq("id", client_id)
      .not("is_deleted", "is", true)
      .single();
    if (clientErr || !clientRow) {
      return NextResponse.json(
        { error: "Klient nie istnieje lub został usunięty" },
        { status: 404 }
      );
    }
  }

  const tempPassword = generateTempPassword();

  const { data: newUser, error: createError } =
    await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: full_name || email },
    });

  if (createError) {
    if (
      createError.message.includes("already been registered") ||
      createError.message.includes("already exists")
    ) {
      return NextResponse.json(
        { error: "Konto dla tego adresu email już istnieje" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: createError.message }, { status: 400 });
  }

  const userId = newUser.user.id;

  // upsert profiles (trigger AFTER INSERT na auth.users tworzy default profile
  // z rolą 'viewer' — nadpisujemy upsertem)
  const { error: profileError } = await adminClient.from("profiles").upsert({
    id: userId,
    email,
    full_name,
    phone,
    role,
    force_password_change: true,
    updated_at: new Date().toISOString(),
  });

  if (profileError) {
    // Rollback — kasujemy konto z auth.users żeby nie zostawić sieroty
    await adminClient.auth.admin.deleteUser(userId);
    return NextResponse.json(
      { error: `Błąd zapisu profilu: ${profileError.message}` },
      { status: 500 }
    );
  }

  // Dla client_user — link z klientem
  if (role === "client_user" && client_id) {
    const { error: linkError } = await adminClient
      .from("client_users")
      .insert({ user_id: userId, client_id });

    if (linkError) {
      // Rollback — kasujemy konto + profile (cascade z FK)
      await adminClient.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: `Błąd tworzenia powiązania z klientem: ${linkError.message}` },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    userId,
    tempPassword,
    email,
    role,
  });
}
