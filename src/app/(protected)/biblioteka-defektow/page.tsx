"use client";

import { useEffect, useMemo, useState } from "react";
import { Library, Plus, Search, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { DefectFormDialog } from "@/components/defect-library/defect-form-dialog";
import { CONDITION_RATINGS, CONDITION_COLORS } from "@/lib/constants";

export type DefectRow = {
  id: string;
  code: string;
  category: string;
  name_pl: string;
  description_template: string | null;
  recommendation_template: string | null;
  typical_rating: string | null;
  typical_urgency: "I" | "II" | "III" | "IV" | null;
  element_section: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export default function BibliotekaDefektowPage() {
  const [defects, setDefects] = useState<DefectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">(
    "active"
  );
  const [userRole, setUserRole] = useState<string | null>(null);
  const [editingDefect, setEditingDefect] = useState<DefectRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const isEditor = userRole === "admin" || userRole === "inspector";
  const isAdmin = userRole === "admin";

  useEffect(() => {
    const supabase = createClient();
    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();
        setUserRole(profile?.role ?? null);
      }

      const { data, error } = await supabase
        .from("defect_library")
        .select("*")
        .order("code");
      if (!error && data) {
        setDefects(data as DefectRow[]);
      }
      setLoading(false);
    };
    load();
  }, []);

  const categories = useMemo(() => {
    const set = new Set(defects.map((d) => d.category).filter(Boolean));
    return Array.from(set).sort();
  }, [defects]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return defects.filter((d) => {
      if (categoryFilter !== "all" && d.category !== categoryFilter) return false;
      if (activeFilter === "active" && !d.is_active) return false;
      if (activeFilter === "inactive" && d.is_active) return false;
      if (!q) return true;
      return (
        d.code.toLowerCase().includes(q) ||
        d.name_pl.toLowerCase().includes(q) ||
        (d.description_template || "").toLowerCase().includes(q) ||
        (d.recommendation_template || "").toLowerCase().includes(q) ||
        (d.element_section || "").toLowerCase().includes(q)
      );
    });
  }, [defects, search, categoryFilter, activeFilter]);

  const stats = useMemo(() => {
    const total = defects.length;
    const active = defects.filter((d) => d.is_active).length;
    const inactive = total - active;
    return { total, active, inactive, categories: categories.length };
  }, [defects, categories]);

  const handleSaved = (saved: DefectRow, isNew: boolean) => {
    setDefects((prev) => {
      if (isNew) return [...prev, saved].sort((a, b) => a.code.localeCompare(b.code));
      return prev.map((d) => (d.id === saved.id ? saved : d));
    });
    setDialogOpen(false);
    setEditingDefect(null);
  };

  const handleToggleActive = async (defect: DefectRow) => {
    if (!isAdmin) return;
    const supabase = createClient();
    const newState = !defect.is_active;
    const { data, error } = await supabase
      .from("defect_library")
      .update({ is_active: newState, updated_at: new Date().toISOString() })
      .eq("id", defect.id)
      .select()
      .single();
    if (!error && data) {
      setDefects((prev) =>
        prev.map((d) => (d.id === defect.id ? (data as DefectRow) : d))
      );
    }
  };

  const handleAdd = () => {
    setEditingDefect(null);
    setDialogOpen(true);
  };

  const handleEdit = (defect: DefectRow) => {
    setEditingDefect(defect);
    setDialogOpen(true);
  };

  const clearFilters = () => {
    setSearch("");
    setCategoryFilter("all");
    setActiveFilter("active");
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-wider uppercase text-graphite-500 mb-1">
            Biblioteka defektów
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-graphite-900">
            Słownik typowych usterek
          </h1>
          <p className="text-sm text-graphite-500 mt-1">
            Standardowe defekty z gotowymi opisami i zaleceniami — picker w formularzu inspekcji.
          </p>
        </div>
        {isEditor && (
          <Button onClick={handleAdd} size="lg" className="gap-2">
            <Plus className="h-4 w-4" />
            Dodaj defekt
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] font-semibold tracking-wider uppercase text-graphite-500 mb-1">
              Wszystkie
            </p>
            <p className="text-2xl font-bold text-graphite-900 font-mono">
              {stats.total}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] font-semibold tracking-wider uppercase text-graphite-500 mb-1">
              Aktywne
            </p>
            <p className="text-2xl font-bold text-success font-mono">
              {stats.active}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] font-semibold tracking-wider uppercase text-graphite-500 mb-1">
              Wyłączone
            </p>
            <p className="text-2xl font-bold text-graphite-500 font-mono">
              {stats.inactive}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] font-semibold tracking-wider uppercase text-graphite-500 mb-1">
              Kategorie
            </p>
            <p className="text-2xl font-bold text-info font-mono">
              {stats.categories}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-graphite-500" />
              <Input
                placeholder="Szukaj po kodzie, nazwie, opisie…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="md:w-64">
                <Filter className="h-4 w-4 mr-2 text-graphite-500" />
                <SelectValue placeholder="Kategoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie kategorie</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={activeFilter}
              onValueChange={(v) => setActiveFilter(v as typeof activeFilter)}
            >
              <SelectTrigger className="md:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Tylko aktywne</SelectItem>
                <SelectItem value="inactive">Tylko wyłączone</SelectItem>
                <SelectItem value="all">Wszystkie</SelectItem>
              </SelectContent>
            </Select>
            {(search || categoryFilter !== "all" || activeFilter !== "active") && (
              <Button variant="outline" onClick={clearFilters} className="gap-2">
                <X className="h-4 w-4" />
                Wyczyść
              </Button>
            )}
          </div>
          <p className="text-xs text-graphite-500 mt-3">
            Pokazano {filtered.length} z {stats.total}
          </p>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-2">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Library className="h-12 w-12 text-graphite-300 mx-auto mb-3" />
              <p className="text-graphite-500 font-medium">
                {defects.length === 0
                  ? "Biblioteka jest pusta"
                  : "Brak defektów spełniających kryteria"}
              </p>
              {(search || categoryFilter !== "all" || activeFilter !== "active") && (
                <Button variant="ghost" onClick={clearFilters} className="mt-3">
                  Wyczyść filtry
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[110px]">Kod</TableHead>
                    <TableHead>Nazwa</TableHead>
                    <TableHead>Kategoria</TableHead>
                    <TableHead className="hidden md:table-cell">Sekcja</TableHead>
                    <TableHead>Ocena</TableHead>
                    <TableHead>Pilność</TableHead>
                    <TableHead>Status</TableHead>
                    {isEditor && (
                      <TableHead className="text-right">Akcje</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((d) => (
                    <TableRow key={d.id} className="hover:bg-graphite-50/50">
                      <TableCell className="font-mono text-xs font-semibold text-graphite-700">
                        {d.code}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => isEditor && handleEdit(d)}
                          className="text-left text-sm font-medium text-graphite-900 hover:text-primary-700 disabled:cursor-default disabled:hover:text-graphite-900"
                          disabled={!isEditor}
                        >
                          {d.name_pl}
                        </button>
                        {d.description_template && (
                          <p className="text-xs text-graphite-500 line-clamp-1 mt-0.5">
                            {d.description_template}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="neutral" className="text-xs">
                          {d.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-graphite-500">
                        {d.element_section || "—"}
                      </TableCell>
                      <TableCell>
                        {d.typical_rating ? (
                          <Badge
                            className={`text-xs ${
                              CONDITION_COLORS[d.typical_rating]
                                ? `${CONDITION_COLORS[d.typical_rating].bg} ${CONDITION_COLORS[d.typical_rating].text}`
                                : ""
                            }`}
                            variant="neutral"
                          >
                            {CONDITION_RATINGS[d.typical_rating] || d.typical_rating}
                          </Badge>
                        ) : (
                          <span className="text-graphite-400 text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {d.typical_urgency ? (
                          <Badge
                            variant="neutral"
                            className={`text-xs font-mono ${URGENCY_UI[d.typical_urgency]}`}
                          >
                            {d.typical_urgency}
                          </Badge>
                        ) : (
                          <span className="text-graphite-400 text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {d.is_active ? (
                          <Badge variant="success" className="text-xs">
                            Aktywny
                          </Badge>
                        ) : (
                          <Badge variant="neutral" className="text-xs">
                            Wyłączony
                          </Badge>
                        )}
                      </TableCell>
                      {isEditor && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(d)}
                            className="text-xs"
                          >
                            Edytuj
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleActive(d)}
                              className="text-xs text-graphite-500 hover:text-graphite-900"
                            >
                              {d.is_active ? "Wyłącz" : "Włącz"}
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      {dialogOpen && (
        <DefectFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          defect={editingDefect}
          existingCategories={categories}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

// Klasy Tailwind dla pilności — zgodne z URGENCY_COLORS_HEX z protocol-tokens.ts
const URGENCY_UI: Record<"I" | "II" | "III" | "IV", string> = {
  I: "bg-danger-100 text-danger-800",
  II: "bg-warning-100 text-warning-800",
  III: "bg-info-100 text-info-800",
  IV: "bg-graphite-100 text-graphite-800",
};
