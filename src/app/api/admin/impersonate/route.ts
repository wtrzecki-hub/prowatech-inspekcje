/**
 * Impersonacja klienta przez admina — pozwala administratorowi otworzyć portal
 * klienta tak, jak widziałby go ten klient.
 *
 * Mechanizm:
 *  - POST { clientId } — sprawdza role admin, ustawia cookie pw_admin_impersonate_client
 *    z UUID klienta. Cookie sameSite=lax, max-age=8h. NIE httpOnly — layout portalu
 *    czyta go po stronie klienta, żeby znać kogo udajemy.
 *  - DELETE — kasuje cookie (wyjście z trybu impersonacji).
 *  - GET — zwraca aktualny stan { clientId, clientName, role } albo null.
 *
 * Bezpieczeństwo:
 *  - Każdy endpoint sprawdza, czy wywołujący ma role='admin' w profiles.
 *  - Cookie sameSite=lax + secure w produkcji.
 *  - Admin i tak widzi wszystko z RLS — cookie tylko zmienia widok UI portalu na
 *    "tylko ten klient".
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const COOKIE_NAME = "pw_admin_impersonate_client";

const SUPABASE_URL = "https://lhxhsprqoecepojrxepf.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoeGhzcHJxb2VjZXBvanJ4ZXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTE0NTksImV4cCI6MjA5MDYyNzQ1OX0.sb8WzlwpPAl4tj6CQgIH34PAQRklUmLeDFOMOS2kUi0";

function makeServerClient() {
  const cookieStore = cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set() {
        // NoOp — endpoint nie ustawia auth cookies
      },
      remove() {
        // NoOp
      },
    },
  });
}

async function ensureAdmin() {
  const supabase = makeServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "unauthenticated" }, { status: 401 }) };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { supabase, userId: user.id };
}

export async function POST(req: NextRequest) {
  const guard = await ensureAdmin();
  if (guard.error) return guard.error;
  const { supabase } = guard;

  let body: { clientId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const clientId = body.clientId?.trim();
  if (!clientId) {
    return NextResponse.json({ error: "missing_client_id" }, { status: 400 });
  }

  // Walidacja że klient istnieje (i nie jest soft-deleted)
  const { data: client, error } = await supabase
    .from("clients")
    .select("id, name")
    .eq("id", clientId)
    .not("is_deleted", "is", true)
    .single();

  if (error || !client) {
    return NextResponse.json({ error: "client_not_found" }, { status: 404 });
  }

  const response = NextResponse.json({
    ok: true,
    clientId: client.id,
    clientName: client.name,
  });

  response.cookies.set(COOKIE_NAME, client.id, {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 8, // 8h
    httpOnly: false, // klient czyta z JS w portal/(client)/layout.tsx
  });

  return response;
}

export async function DELETE() {
  const guard = await ensureAdmin();
  if (guard.error) return guard.error;

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, "", {
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function GET() {
  const supabase = makeServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const cookieStore = cookies();
  const impersonateClientId = cookieStore.get(COOKIE_NAME)?.value || null;

  if (!user) {
    return NextResponse.json({
      authenticated: false,
      impersonating: null,
    });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!impersonateClientId || profile?.role !== "admin") {
    return NextResponse.json({
      authenticated: true,
      role: profile?.role,
      impersonating: null,
    });
  }

  const { data: client } = await supabase
    .from("clients")
    .select("id, name")
    .eq("id", impersonateClientId)
    .single();

  return NextResponse.json({
    authenticated: true,
    role: profile?.role,
    impersonating: client
      ? { clientId: client.id, clientName: client.name }
      : null,
  });
}
