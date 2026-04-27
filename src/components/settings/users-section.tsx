"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, ShieldCheck, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";

type UserRole = "admin" | "inspector" | "client_user" | "viewer";

const ROLE_OPTIONS: { value: UserRole; label: string; description: string }[] = [
  {
    value: "admin",
    label: "Administrator",
    description: "Pełne uprawnienia do wszystkich funkcji.",
  },
  {
    value: "inspector",
    label: "Inspektor",
    description: "Pełen CRUD inspekcji i zasobów. Bez Ustawień / Diagnostyki.",
  },
  {
    value: "client_user",
    label: "Użytkownik klienta",
    description: "Dostęp tylko do portalu klienta — swoje farmy/turbiny/protokoły.",
  },
  {
    value: "viewer",
    label: "Podgląd",
    description: "Tylko odczyt — bez możliwości edycji.",
  },
];

const ROLE_LABEL: Record<string, string> = Object.fromEntries(
  ROLE_OPTIONS.map((r) => [r.value, r.label])
);

const ROLE_BADGE_VARIANT: Record<string, "success" | "info" | "warning" | "neutral"> = {
  admin: "success",
  inspector: "info",
  client_user: "warning",
  viewer: "neutral",
};

interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  created_at: string;
}

interface UsersSectionProps {
  currentUserId: string | null;
}

export function UsersSection({ currentUserId }: UsersSectionProps) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [confirmRoleChange, setConfirmRoleChange] = useState<{
    user: UserRow;
    newRole: UserRole;
  } | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const load = async () => {
      const { data, error: err } = await supabase
        .from("profiles")
        .select("id, email, full_name, phone, role, created_at")
        .order("created_at", { ascending: false });
      if (err) {
        setError(err.message);
      } else {
        setUsers((data || []) as UserRow[]);
      }
      setLoading(false);
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        u.email.toLowerCase().includes(q) ||
        (u.full_name || "").toLowerCase().includes(q) ||
        (u.phone || "").toLowerCase().includes(q)
      );
    });
  }, [users, search, roleFilter]);

  const stats = useMemo(() => {
    const counts: Record<string, number> = { admin: 0, inspector: 0, client_user: 0, viewer: 0 };
    users.forEach((u) => {
      counts[u.role] = (counts[u.role] || 0) + 1;
    });
    return counts;
  }, [users]);

  const handleRoleChange = (user: UserRow, newRole: UserRole) => {
    if (newRole === user.role) return;
    setConfirmRoleChange({ user, newRole });
  };

  const confirmRoleUpdate = async () => {
    if (!confirmRoleChange) return;
    setUpdating(true);
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("profiles")
      .update({
        role: confirmRoleChange.newRole,
        updated_at: new Date().toISOString(),
      })
      .eq("id", confirmRoleChange.user.id)
      .select();
    setUpdating(false);
    if (err) {
      setError(err.message);
      setConfirmRoleChange(null);
      return;
    }
    if (!data || data.length === 0) {
      setError("Nie zaktualizowano (zero wierszy). Sprawdź RLS.");
      setConfirmRoleChange(null);
      return;
    }
    setUsers((prev) =>
      prev.map((u) =>
        u.id === confirmRoleChange.user.id
          ? { ...u, role: confirmRoleChange.newRole }
          : u
      )
    );
    setConfirmRoleChange(null);
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

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {ROLE_OPTIONS.map((role) => (
          <Card key={role.value}>
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold tracking-wider uppercase text-graphite-500 mb-1">
                {role.label}
              </p>
              <p className="text-2xl font-bold text-graphite-900 font-mono">
                {stats[role.value] || 0}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-graphite-500" />
            Wszyscy użytkownicy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-graphite-500" />
              <Input
                placeholder="Szukaj po emailu, imieniu, telefonie…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="md:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie role</SelectItem>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <div className="rounded-lg border border-danger-100 bg-danger-50 p-3 text-sm text-danger-800">
              {error}
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Użytkownik</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="hidden md:table-cell">Telefon</TableHead>
                  <TableHead className="hidden md:table-cell">Utworzony</TableHead>
                  <TableHead>Rola</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <TableRow key={u.id} className="hover:bg-graphite-50/50">
                    <TableCell>
                      <p className="text-sm font-medium text-graphite-900">
                        {u.full_name || "—"}
                      </p>
                      {u.id === currentUserId && (
                        <Badge variant="info" className="text-[10px] mt-0.5">
                          To Ty
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-graphite-700">
                      {u.email}
                    </TableCell>
                    <TableCell className="hidden md:table-cell font-mono text-xs text-graphite-500">
                      {u.phone || "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-graphite-500">
                      {new Date(u.created_at).toLocaleDateString("pl-PL")}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={u.role}
                        onValueChange={(v) => handleRoleChange(u, v as UserRole)}
                        disabled={u.id === currentUserId}
                      >
                        <SelectTrigger className="w-44 h-8 text-xs">
                          <SelectValue>
                            <Badge
                              variant={ROLE_BADGE_VARIANT[u.role] || "neutral"}
                              className="text-xs"
                            >
                              {ROLE_LABEL[u.role] || u.role}
                            </Badge>
                          </SelectValue>
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
                      {u.id === currentUserId && (
                        <p className="text-[10px] text-graphite-500 mt-0.5">
                          Nie możesz zmienić własnej roli.
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-8 text-graphite-500 text-sm">
              Brak użytkowników spełniających kryteria.
            </div>
          )}

          <p className="text-xs text-graphite-500">
            Pokazano {filtered.length} z {users.length}.{" "}
            <strong>Tworzenie kont:</strong> klient_user — zakładka „Portal klienta" w widoku{" "}
            <code className="font-mono">/klienci/[id]</code>; admin/inspector — pierwsze
            logowanie przez Google OAuth (rola domyślna „viewer", tutaj awansujesz).
          </p>
        </CardContent>
      </Card>

      {/* Confirm dialog */}
      <Dialog
        open={confirmRoleChange !== null}
        onOpenChange={(o) => !o && setConfirmRoleChange(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Potwierdź zmianę roli
            </DialogTitle>
            <DialogDescription>
              {confirmRoleChange && (
                <>
                  Zmieniasz rolę użytkownika{" "}
                  <strong>{confirmRoleChange.user.full_name || confirmRoleChange.user.email}</strong>{" "}
                  z <Badge variant="neutral" className="text-xs mx-1">{ROLE_LABEL[confirmRoleChange.user.role]}</Badge>{" "}
                  na <Badge variant={ROLE_BADGE_VARIANT[confirmRoleChange.newRole]} className="text-xs mx-1">{ROLE_LABEL[confirmRoleChange.newRole]}</Badge>.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {confirmRoleChange?.newRole === "admin" && (
            <div className="rounded-lg border border-warning-100 bg-warning-50 p-3 text-xs text-warning-800">
              <strong>Uwaga:</strong> rola admin daje pełen dostęp do wszystkich danych
              i Ustawień. Nadawaj ostrożnie.
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmRoleChange(null)}
              disabled={updating}
            >
              Anuluj
            </Button>
            <Button onClick={confirmRoleUpdate} disabled={updating}>
              {updating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Zmień rolę
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

