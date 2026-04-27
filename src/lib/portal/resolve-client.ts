/**
 * Wspólny resolver dla wszystkich stron portalu klienta.
 *
 * Każda strona portalu (dashboard, farmy, turbiny, protokoły, konto) musi wiedzieć
 * jakiego klienta dotyczy widok. Dotychczas każda fetchowała `client_users` po
 * `user_id = auth.uid()`. Teraz dodajemy 2 ścieżki:
 *
 *  1. Standardowa — user.role === 'client_user' → fetch z `client_users`.
 *  2. Impersonacja — user.role === 'admin' + cookie `pw_admin_impersonate_client`
 *     ustawione przez POST /api/admin/impersonate → bierzemy clientId z cookie.
 *
 * RLS: admin ma pełny dostęp do `clients/wind_farms/turbines/inspections/...`,
 * więc wszystkie zapytania w portalu zadziałają — pod warunkiem że strony filtrują
 * dane explicite przez `.eq('client_id', ...)` (a robią to, sprawdzone).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const IMPERSONATE_COOKIE = "pw_admin_impersonate_client";

export interface PortalClientContext {
  clientId: string;
  clientName: string;
  isImpersonating: boolean;
  /** Rola zalogowanego użytkownika — przydatna do disable'owania edycji konta w trybie admin. */
  userRole: "admin" | "inspector" | "client_user" | "viewer";
}

export interface PortalClientResolveError {
  error: "no_session" | "no_profile" | "no_client_user" | "no_impersonate_target" | "wrong_role";
  message: string;
}

/** Czyta cookie po stronie klienta (browser). */
export function readImpersonateCookie(): string | null {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie.split(";").map((c) => c.trim());
  const match = cookies.find((c) => c.startsWith(`${IMPERSONATE_COOKIE}=`));
  if (!match) return null;
  const value = match.split("=")[1];
  return value ? decodeURIComponent(value) : null;
}

/**
 * Główna funkcja — wywołuj w `useEffect` na każdej stronie portalu zamiast
 * dotychczasowego fetchu z `client_users`.
 *
 * Zwraca `{ clientId, clientName, isImpersonating, userRole }` lub `{ error }`.
 */
export async function resolvePortalClient(
  supabase: SupabaseClient
): Promise<{ ok: true; context: PortalClientContext } | { ok: false; error: PortalClientResolveError }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return {
      ok: false,
      error: { error: "no_session", message: "Brak sesji — wymagane logowanie." },
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  if (!profile) {
    return {
      ok: false,
      error: { error: "no_profile", message: "Brak profilu użytkownika w bazie." },
    };
  }

  const userRole = profile.role as PortalClientContext["userRole"];
  const impersonateClientId = readImpersonateCookie();

  // Tryb impersonacji — admin z cookie
  if (userRole === "admin" && impersonateClientId) {
    const { data: client, error } = await supabase
      .from("clients")
      .select("id, name")
      .eq("id", impersonateClientId)
      .not("is_deleted", "is", true)
      .single();
    if (error || !client) {
      return {
        ok: false,
        error: {
          error: "no_impersonate_target",
          message:
            "Klient z cookie impersonacji nie istnieje. Wyjdź z trybu i wybierz innego.",
        },
      };
    }
    return {
      ok: true,
      context: {
        clientId: client.id,
        clientName: client.name,
        isImpersonating: true,
        userRole,
      },
    };
  }

  // Standardowy client_user
  if (userRole === "client_user") {
    const { data: clientUser } = await supabase
      .from("client_users")
      .select("client_id, clients(id, name)")
      .eq("user_id", session.user.id)
      .single();

    if (!clientUser) {
      return {
        ok: false,
        error: {
          error: "no_client_user",
          message: "Brak powiązania użytkownika z klientem. Skontaktuj się z administratorem.",
        },
      };
    }

    const client = clientUser.clients as unknown as {
      id: string;
      name: string;
    } | null;

    return {
      ok: true,
      context: {
        clientId: clientUser.client_id,
        clientName: client?.name || "",
        isImpersonating: false,
        userRole,
      },
    };
  }

  // Admin bez cookie / inny role
  return {
    ok: false,
    error: {
      error: "wrong_role",
      message:
        "Portal klienta jest dostępny tylko dla użytkownika klienta. Aby przeglądać jako admin, ustaw tryb impersonacji w widoku klienta.",
    },
  };
}
