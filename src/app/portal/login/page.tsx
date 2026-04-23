"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Wind } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

export default function PortalLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword(
        { email, password }
      );

      if (authError || !data.user) {
        setError("Nieprawidłowy email lub hasło");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, force_password_change")
        .eq("id", data.user.id)
        .single();

      if (profile?.role !== "client_user") {
        await supabase.auth.signOut();
        setError("Brak dostępu do portalu klienta");
        return;
      }

      router.push(
        profile.force_password_change ? "/portal/konto" : "/portal/dashboard"
      );
    } catch {
      setError("Wystąpił błąd. Spróbuj ponownie.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/portal/auth/reset`,
      });
    } finally {
      setResetSent(true);
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-graphite-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary rounded-xl">
              <Wind className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-graphite-500 leading-none mb-0.5">
                ProWaTech
              </p>
              <p className="text-sm font-bold text-graphite-900 leading-tight">
                Portal Operatora
              </p>
            </div>
          </div>
        </div>

        {!showReset ? (
          <Card className="border border-graphite-100 shadow-md">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-graphite-900">
                Logowanie
              </CardTitle>
              <CardDescription className="text-graphite-500">
                Zaloguj się, aby zobaczyć inspekcje Państwa turbin
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 p-3 bg-danger-50 border border-danger-100 rounded-lg text-danger-800 text-sm">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {error}
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="email"
                    className="text-xs font-semibold uppercase tracking-wide text-graphite-500"
                  >
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="adres@firma.pl"
                    required
                    autoComplete="email"
                    className="border-graphite-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="password"
                    className="text-xs font-semibold uppercase tracking-wide text-graphite-500"
                  >
                    Hasło
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                      className="border-graphite-200 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-graphite-500 hover:text-graphite-800"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Logowanie..." : "Zaloguj się"}
                </Button>
                <button
                  type="button"
                  onClick={() => setShowReset(true)}
                  className="w-full text-center text-sm text-primary-600 hover:text-primary-700"
                >
                  Zapomniałem/am hasła
                </button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card className="border border-graphite-100 shadow-md">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-graphite-900">
                Reset hasła
              </CardTitle>
              <CardDescription className="text-graphite-500">
                Wyślemy Państwu link do ustawienia nowego hasła
              </CardDescription>
            </CardHeader>
            <CardContent>
              {resetSent ? (
                <div className="space-y-4">
                  <div className="p-4 bg-success-50 border border-success-100 rounded-lg text-success-800 text-sm">
                    Jeśli podany adres jest zarejestrowany w systemie, otrzymają
                    Państwo wiadomość z linkiem do resetu hasła.
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setShowReset(false);
                      setResetSent(false);
                      setResetEmail("");
                    }}
                  >
                    Wróć do logowania
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleReset} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="reset-email"
                      className="text-xs font-semibold uppercase tracking-wide text-graphite-500"
                    >
                      Email
                    </Label>
                    <Input
                      id="reset-email"
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="adres@firma.pl"
                      required
                      className="border-graphite-200"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={resetLoading}>
                    {resetLoading ? "Wysyłanie..." : "Wyślij link resetujący"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setShowReset(false)}
                    className="w-full text-center text-sm text-graphite-500 hover:text-graphite-800"
                  >
                    Wróć do logowania
                  </button>
                </form>
              )}
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-graphite-500 mt-6">
          © {new Date().getFullYear()} ProWaTech ·{" "}
          <a href="/login" className="text-primary-600 hover:underline">
            Panel inspektora
          </a>
        </p>
      </div>
    </div>
  );
}
