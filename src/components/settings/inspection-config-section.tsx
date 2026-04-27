"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, Library, Layers, ArrowRight, Palette } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  CONDITION_RATINGS_ACTIVE,
  CONDITION_COLORS,
  INSPECTION_TYPES,
  INSPECTION_STATUSES,
  STATUS_COLORS,
  BASIC_REQUIREMENTS_ART5,
} from "@/lib/constants";

const URGENCY_PALETTE = [
  { value: "I", label: "I — Krytyczna", classes: "bg-danger-100 text-danger-800" },
  { value: "II", label: "II — Wysoka", classes: "bg-warning-100 text-warning-800" },
  { value: "III", label: "III — Średnia", classes: "bg-info-100 text-info-800" },
  { value: "IV", label: "IV — Niska", classes: "bg-graphite-100 text-graphite-800" },
];

export function InspectionConfigSection() {
  const [defectStats, setDefectStats] = useState<{
    total: number;
    active: number;
    categories: number;
  }>({ total: 0, active: 0, categories: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    const load = async () => {
      const { data, error } = await supabase
        .from("defect_library")
        .select("id, category, is_active");
      if (!error && data) {
        const total = data.length;
        const active = data.filter((d) => d.is_active).length;
        const categories = new Set(data.map((d) => d.category)).size;
        setDefectStats({ total, active, categories });
      }
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div className="space-y-4">
      {/* Biblioteka defektów — link */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Library className="h-5 w-5 text-graphite-500" />
            Biblioteka defektów
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-graphite-500">
            Słownik typowych usterek wykorzystywany jako picker w formularzu inspekcji.
            Edycję pełnego CRUD-u znajdziesz w dedykowanej zakładce.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            {loading ? (
              <div className="h-6 w-24 bg-graphite-100 animate-pulse rounded" />
            ) : (
              <>
                <Badge variant="neutral" className="font-mono">
                  {defectStats.active} / {defectStats.total} aktywnych
                </Badge>
                <Badge variant="info" className="font-mono">
                  {defectStats.categories} kategorii
                </Badge>
              </>
            )}
            <Link href="/biblioteka-defektow" className="ml-auto">
              <Button variant="outline" size="sm" className="gap-2">
                Otwórz Bibliotekę
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Typy kontroli + statusy */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-graphite-500" />
            Typy kontroli i statusy inspekcji
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <p className="text-[11px] font-semibold tracking-wider uppercase text-graphite-500 mb-2">
              Typy kontroli (PIIB)
            </p>
            <div className="flex flex-wrap gap-2">
              {INSPECTION_TYPES.map((t) => (
                <Badge key={t.value} variant="neutral" className="text-xs">
                  {t.label}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-graphite-500 mt-2">
              Kontrola roczna — sekcje I, II, III, V, VII; pięcioletnia — dodatkowo IV
              (pomiary elektryczne) i VI (wymagania art. 5 PB).
            </p>
          </div>

          <div>
            <p className="text-[11px] font-semibold tracking-wider uppercase text-graphite-500 mb-2">
              Statusy inspekcji
            </p>
            <div className="flex flex-wrap gap-2">
              {INSPECTION_STATUSES.map((s) => (
                <Badge
                  key={s.value}
                  variant="neutral"
                  className={`text-xs ${STATUS_COLORS[s.value] || ""}`}
                >
                  {s.label}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-graphite-500 mt-2">
              Przejście <code className="font-mono">completed → signed</code> dzieje się
              automatycznie po wpisaniu obu dat podpisu (trigger DB).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Skala ocen + paleta pilności */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="h-5 w-5 text-graphite-500" />
            Paleta ocen i pilności
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <p className="text-[11px] font-semibold tracking-wider uppercase text-graphite-500 mb-3">
              4-stopniowa skala oceny PIIB
            </p>
            <div className="grid md:grid-cols-2 gap-2">
              {CONDITION_RATINGS_ACTIVE.map((r) => {
                const colors = CONDITION_COLORS[r.value];
                return (
                  <div
                    key={r.value}
                    className="flex items-start gap-3 p-3 rounded-lg border border-graphite-200"
                  >
                    <Badge
                      variant="neutral"
                      className={`text-xs whitespace-nowrap ${
                        colors ? `${colors.bg} ${colors.text}` : ""
                      }`}
                    >
                      {r.label}
                    </Badge>
                    <p className="text-xs text-graphite-500 leading-relaxed">
                      {r.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold tracking-wider uppercase text-graphite-500 mb-3">
              4-stopniowa pilność zaleceń remontowych
            </p>
            <div className="flex flex-wrap gap-2">
              {URGENCY_PALETTE.map((u) => (
                <Badge
                  key={u.value}
                  variant="neutral"
                  className={`text-xs ${u.classes}`}
                >
                  {u.label}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-graphite-500 mt-2">
              Klasy CSS spójne z generatorami protokołów (PDF B3 + DOCX A3) z{" "}
              <code className="font-mono">src/lib/design/protocol-tokens.ts</code>.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Wymagania art. 5 PB */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-5 w-5 text-graphite-500" />
            7 wymagań podstawowych — art. 5 PB
          </CardTitle>
          <p className="text-xs text-graphite-500">
            Sekcja VI w protokole 5-letnim. Tworzona automatycznie dla każdej kontroli
            5-letniej (preset rows w <code className="font-mono">basic_requirements_art5</code>).
          </p>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm text-graphite-700">
            {BASIC_REQUIREMENTS_ART5.map((req, idx) => (
              <li key={req.code} className="flex items-start gap-3">
                <span className="font-mono text-xs text-graphite-500 mt-0.5">
                  {idx + 1}.
                </span>
                <div>
                  <span className="font-medium">{req.label}</span>{" "}
                  <code className="font-mono text-[10px] text-graphite-400 ml-1">
                    {req.code}
                  </code>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-graphite-500 leading-relaxed">
            <strong className="text-graphite-700">Definicje elementów turbiny</strong>{" "}
            (15 dla kontroli rocznej, 16 dla 5-letniej) są w tabeli{" "}
            <code className="font-mono">element_definitions</code> i ładują się
            automatycznie do formularza inspekcji wg{" "}
            <code className="font-mono">inspection_type</code>. Edycja przez Supabase SQL
            — w przyszłej iteracji widok edytora dorzucony tutaj.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
