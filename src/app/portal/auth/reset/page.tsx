"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, KeyRound } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

/**
 * Reset password landing page.
 *
 * Flow odporny na prefetch Gmaila / SafeBrowsing:
 * - Email template w Supabase wysyła link:
 *     {{ .SiteURL }}/portal/auth/reset?token_hash={{ .TokenHash }}&type=recovery
 * - Ta strona to *client component* — wywołuje supabase.auth.verifyOtp({ token_hash })
 *   po stronie klienta, w useEffect. Skaner Gmaila wykonuje tylko GET, nie odpala JS,
 *   więc token nie jest konsumowany przed kliknięciem przez użytkownika.
 * - Po success → redirect do /portal/konto?reset=1 (formularz "Ustaw nowe hasło").
 */
export default function PortalResetPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<"verifying" | "error">("verifying");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const tokenHash = searchParams.get("token_hash");
    const type = searchParams.get("type");

    if (!tokenHash || type !== "recovery") {
      setErrorMessage(
        "Link resetujący jest nieprawidłowy lub niekompletny. Wyślij prośbę o reset ponownie."
      );
      setStatus("error");
      return;
    }

    const supabase = createClient();
    supabase.auth
      .verifyOtp({ type: "recovery", token_hash: tokenHash })
      .then(({ data, error }) => {
        if (error || !data.session) {
          setErrorMessage(
            "Link wygasł lub został już użyty. Wyślij prośbę o reset ponownie."
          );
          setStatus("error");
          return;
        }
        router.push("/portal/konto?reset=1");
      });
  }, [searchParams, router]);

  if (status === "verifying") {
    return (
      <div className="min-h-screen bg-graphite-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3" />
          <p className="text-graphite-500 text-sm">
            Weryfikacja linku resetującego…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-graphite-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="border border-graphite-100 shadow-md">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-graphite-900 flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-graphite-500" />
              Reset hasła
            </CardTitle>
            <CardDescription className="text-graphite-500">
              Link resetujący nie jest już ważny
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-2 p-3 bg-danger-50 border border-danger-100 rounded-lg text-danger-800 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
            <Link href="/portal/login" className="block">
              <Button variant="outline" className="w-full">
                Wróć do logowania
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
