"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";

export default function PortalKontoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isReset = searchParams.get("reset") === "1";

  const [profile, setProfile] = useState<{
    full_name: string | null;
    email: string;
    force_password_change: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      supabase
        .from("profiles")
        .select("full_name, email, force_password_change")
        .eq("id", session.user.id)
        .single()
        .then(({ data }) => {
          if (data) setProfile(data);
          setLoading(false);
        });
    });
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Hasła nie są zgodne");
      return;
    }
    if (newPassword.length < 8) {
      setError("Hasło musi mieć co najmniej 8 znaków");
      return;
    }
    setError(null);
    setSaving(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        await supabase
          .from("profiles")
          .update({
            force_password_change: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", session.user.id);
      }

      setSuccess(true);
      setNewPassword("");
      setConfirmPassword("");
      setProfile((prev) =>
        prev ? { ...prev, force_password_change: false } : prev
      );

      setTimeout(() => router.push("/portal/dashboard"), 2000);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Błąd zmiany hasła"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-xl">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const forceChange = profile?.force_password_change ?? false;

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-graphite-900">Konto</h1>
        {profile?.email && (
          <p className="text-graphite-500 text-sm mt-1">{profile.email}</p>
        )}
      </div>

      {(forceChange || isReset) && !success && (
        <div className="flex items-start gap-3 p-4 bg-warning-50 border border-warning-100 rounded-xl text-warning-800 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          {forceChange
            ? "Przed skorzystaniem z portalu należy ustawić własne hasło."
            : "Proszę ustawić nowe hasło po zresetowaniu."}
        </div>
      )}

      <Card className="border border-graphite-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-graphite-900 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-graphite-500" />
            Zmiana hasła
          </CardTitle>
          <CardDescription className="text-graphite-500 text-xs">
            Hasło musi mieć co najmniej 8 znaków
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="flex items-center gap-3 p-4 bg-success-50 border border-success-100 rounded-xl text-success-800 text-sm">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
              Hasło zostało zmienione. Przekierowywanie do panelu…
            </div>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-danger-50 border border-danger-100 rounded-lg text-danger-800 text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}
              <div className="space-y-1.5">
                <Label
                  htmlFor="new-password"
                  className="text-xs font-semibold uppercase tracking-wide text-graphite-500"
                >
                  Nowe hasło
                </Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 znaków"
                    required
                    className="border-graphite-200 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-graphite-500 hover:text-graphite-800"
                  >
                    {showNew ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="confirm-password"
                  className="text-xs font-semibold uppercase tracking-wide text-graphite-500"
                >
                  Powtórz hasło
                </Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="border-graphite-200 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-graphite-500 hover:text-graphite-800"
                  >
                    {showConfirm ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? "Zapisywanie…" : "Ustaw nowe hasło"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
