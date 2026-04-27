"use client";

import { useEffect, useState } from "react";
import { Loader2, Copy, CheckCircle2, AlertCircle, KeyRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";

type UserRole = "admin" | "inspector" | "viewer" | "client_user";

const ROLE_OPTIONS: { value: UserRole; label: string; description: string }[] = [
  {
    value: "inspector",
    label: "Inspektor",
    description: "Pełen CRUD inspekcji i zasobów. Najczęstsza rola pracownika.",
  },
  {
    value: "admin",
    label: "Administrator",
    description: "Pełne uprawnienia + Ustawienia + Diagnostyka.",
  },
  {
    value: "viewer",
    label: "Podgląd",
    description: "Tylko odczyt — bez możliwości edycji. Dla audytorów.",
  },
  {
    value: "client_user",
    label: "Użytkownik klienta",
    description: "Dostęp tylko do portalu klienta — wymaga wyboru klienta.",
  },
];

interface ClientOption {
  id: string;
  name: string;
}

interface CreatedUser {
  email: string;
  tempPassword: string;
  role: UserRole;
}

interface AddUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function AddUserDialog({ open, onOpenChange, onCreated }: AddUserDialogProps) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("inspector");
  const [clientId, setClientId] = useState<string>("");
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedUser | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch listy klientów gdy role='client_user' (raz, lazy)
  useEffect(() => {
    if (role !== "client_user" || clients.length > 0) return;
    setLoadingClients(true);
    const supabase = createClient();
    supabase
      .from("clients")
      .select("id, name")
      .not("is_deleted", "is", true)
      .order("name")
      .then(({ data }) => {
        setClients((data as ClientOption[]) || []);
        setLoadingClients(false);
      });
  }, [role, clients.length]);

  // Reset stanu przy otwieraniu
  useEffect(() => {
    if (open) {
      setEmail("");
      setFullName("");
      setPhone("");
      setRole("inspector");
      setClientId("");
      setError(null);
      setCreated(null);
      setCopied(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim()) {
      setError("Email jest wymagany.");
      return;
    }
    if (role === "client_user" && !clientId) {
      setError("Dla użytkownika klienta wybierz klienta z listy.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          full_name: fullName.trim() || undefined,
          phone: phone.trim() || undefined,
          role,
          client_id: role === "client_user" ? clientId : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Nie udało się utworzyć konta");
        setSubmitting(false);
        return;
      }
      setCreated({
        email: json.email,
        tempPassword: json.tempPassword,
        role: json.role,
      });
      setSubmitting(false);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd sieci");
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!created) return;
    const loginUrl =
      created.role === "client_user"
        ? `${window.location.origin}/portal/login`
        : `${window.location.origin}/login`;
    await navigator.clipboard.writeText(
      `Email: ${created.email}\nHasło tymczasowe: ${created.tempPassword}\nAdres logowania: ${loginUrl}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                Konto utworzone
              </DialogTitle>
              <DialogDescription>
                Przekaż dane logowania użytkownikowi. Po pierwszym logowaniu
                będzie zmuszony zmienić hasło.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="rounded-lg border border-warning-100 bg-warning-50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-warning-800" />
                  <p className="text-sm font-semibold text-warning-800">
                    Hasło widoczne tylko teraz — skopiuj zanim zamkniesz okno.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-graphite-500 w-24">Email:</span>
                    <code className="text-xs font-mono bg-white px-2 py-1.5 rounded border border-graphite-200 flex-1">
                      {created.email}
                    </code>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-graphite-500 w-24">Hasło tymcz.:</span>
                    <code className="text-xs font-mono bg-white px-2 py-1.5 rounded border border-graphite-200 flex-1 font-bold tracking-widest">
                      {created.tempPassword}
                    </code>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-graphite-500 w-24">Logowanie:</span>
                    <code className="text-xs font-mono bg-white px-2 py-1.5 rounded border border-graphite-200 flex-1">
                      {created.role === "client_user" ? "/portal/login" : "/login"}
                    </code>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopy}
                  className="w-full gap-2"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      Skopiowano
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Skopiuj dane logowania
                    </>
                  )}
                </Button>
              </div>
              <div className="rounded-lg border border-info-100 bg-info-50 p-3 text-xs text-info-800">
                {created.role === "client_user" ? (
                  <>
                    Konto klienta loguje się pod{" "}
                    <strong>/portal/login</strong>. Po pierwszym logowaniu zostanie
                    przekierowany do zmiany hasła, potem do dashboardu portalu.
                  </>
                ) : (
                  <>
                    Konto pracownika loguje się pod <strong>/login</strong>.
                    <strong className="block mt-1">Uwaga:</strong> projekt
                    obecnie używa Google OAuth. Logowanie email/hasło wymaga
                    włączenia opcji „Email" w Supabase → Auth → Providers
                    (jeśli jeszcze niewłączone). Alternatywnie poproś
                    pracownika o pierwsze logowanie przez Google — jego konto
                    powstanie z domyślną rolą „viewer", a Ty awansujesz go w
                    Ustawieniach.
                  </>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Zamknij</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Dodaj użytkownika</DialogTitle>
              <DialogDescription>
                Tworzenie konta z hasłem tymczasowym XXXX-XXXX-XXXX. Pracownik
                lub klient zmieni hasło przy pierwszym logowaniu.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="np. j.kowalski@cgedata.com"
                  className="font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="full-name">Imię i nazwisko</Label>
                  <Input
                    id="full-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="np. Jan Kowalski"
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
              </div>

              <div>
                <Label>Rola *</Label>
                <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        <div>
                          <p className="text-sm font-medium">{r.label}</p>
                          <p className="text-[10px] text-graphite-500">
                            {r.description}
                          </p>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {role === "client_user" && (
                <div>
                  <Label>Klient *</Label>
                  <Select value={clientId} onValueChange={setClientId}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          loadingClients
                            ? "Ładowanie listy klientów…"
                            : "Wybierz klienta z listy"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-graphite-500 mt-1">
                    Konto klienta otrzyma dostęp tylko do farm/turbin/protokołów tego klienta.
                  </p>
                </div>
              )}

              {role === "admin" && (
                <div className="rounded-lg border border-warning-100 bg-warning-50 p-3 text-xs text-warning-800 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <p>
                    <strong>Uwaga:</strong> rola Administrator daje pełen dostęp do
                    wszystkich danych, Ustawień i Diagnostyki. Nadawaj ostrożnie.
                  </p>
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-danger-100 bg-danger-50 p-3 text-sm text-danger-800 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  {error}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={submitting}
              >
                Anuluj
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Utwórz konto
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

