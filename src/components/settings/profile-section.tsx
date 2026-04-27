"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  inspector: "Inspektor",
  client_user: "Użytkownik klienta",
  viewer: "Podgląd",
};

interface ProfileSectionProps {
  userId: string;
}

export function ProfileSection({ userId }: ProfileSectionProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [createdAt, setCreatedAt] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setAvatarUrl(user.user_metadata?.avatar_url);
      }
      const { data, error: err } = await supabase
        .from("profiles")
        .select("email, full_name, phone, role, created_at")
        .eq("id", userId)
        .single();
      if (!err && data) {
        setEmail(data.email);
        setFullName(data.full_name || "");
        setPhone(data.phone || "");
        setRole(data.role);
        setCreatedAt(data.created_at);
      }
      setLoading(false);
    };
    load();
  }, [userId]);

  const handleSave = async () => {
    setError(null);
    setSuccess(false);
    setSaving(true);
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim() || null,
        phone: phone.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select();
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (!data || data.length === 0) {
      setError("Nie udało się zapisać zmian (zero wierszy zaktualizowanych).");
      return;
    }
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        </CardContent>
      </Card>
    );
  }

  const initials = (fullName || email)
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Twoje konto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Avatar + meta */}
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={avatarUrl} alt={fullName || email} />
              <AvatarFallback className="bg-primary-600 text-white text-lg font-semibold">
                {initials || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-sm font-semibold text-graphite-900">
                {fullName || email}
              </p>
              <p className="text-xs text-graphite-500 font-mono">{email}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant={role === "admin" ? "success" : "neutral"}
                  className="text-xs"
                >
                  {ROLE_LABELS[role] || role}
                </Badge>
                {createdAt && (
                  <span className="text-xs text-graphite-500">
                    Konto od {new Date(createdAt).toLocaleDateString("pl-PL")}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Edytowalne pola */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={email}
                disabled
                className="font-mono bg-graphite-50"
              />
              <p className="text-xs text-graphite-500 mt-1">
                Email pochodzi z Google OAuth — nieedytowalny.
              </p>
            </div>
            <div>
              <Label htmlFor="full-name">Imię i nazwisko</Label>
              <Input
                id="full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="np. Waldemar Trzecki"
              />
            </div>
            <div>
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+48 600 000 000"
                className="font-mono"
              />
            </div>
            <div>
              <Label>Rola</Label>
              <Input
                value={ROLE_LABELS[role] || role}
                disabled
                className="bg-graphite-50"
              />
              <p className="text-xs text-graphite-500 mt-1">
                Zmiana roli — w zakładce „Użytkownicy".
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-danger-100 bg-danger-50 p-3 text-sm text-danger-800">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg border border-success-100 bg-success-50 p-3 text-sm text-success-800 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Zapisano zmiany
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Zapisz zmiany
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
