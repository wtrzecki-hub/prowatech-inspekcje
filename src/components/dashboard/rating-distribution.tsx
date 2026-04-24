"use client";

import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { CONDITION_RATINGS } from "@/lib/constants";

type Rating = "dobry" | "zadowalajacy" | "sredni" | "zly" | "awaryjny";

const ORDER: Rating[] = ["dobry", "zadowalajacy", "sredni", "zly", "awaryjny"];

// Kolory wypełnienia paska — spójne z CONDITION_COLORS,
// ale jako bg-* bezpośrednio dla paska (żywszy odcień).
const BAR_BG: Record<Rating, string> = {
  dobry: "bg-success",
  zadowalajacy: "bg-info",
  sredni: "bg-warning",
  zly: "bg-orange-500",
  awaryjny: "bg-danger",
};

const LABEL_FG: Record<Rating, string> = {
  dobry: "text-success-800",
  zadowalajacy: "text-info-800",
  sredni: "text-warning-800",
  zly: "text-orange-700",
  awaryjny: "text-danger-800",
};

export function RatingDistribution() {
  const [counts, setCounts] = useState<Record<Rating, number>>({
    dobry: 0,
    zadowalajacy: 0,
    sredni: 0,
    zly: 0,
    awaryjny: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDistribution = async () => {
      const supabase = createClient();
      try {
        // Rozkład ocen z inspection_elements (ocenione elementy, N/A wyłączone),
        // tylko z inspekcji które nie są soft-deleted.
        const { data, error } = await supabase
          .from("inspection_elements")
          .select(
            "condition_rating, is_not_applicable, inspections!inner(is_deleted)"
          )
          .eq("is_not_applicable", false)
          .not("condition_rating", "is", null)
          .not("inspections.is_deleted", "is", true)
          .limit(10000);

        if (error) throw error;

        const next: Record<Rating, number> = {
          dobry: 0,
          zadowalajacy: 0,
          sredni: 0,
          zly: 0,
          awaryjny: 0,
        };
        (data || []).forEach(
          (row: { condition_rating: Rating | null }) => {
            if (row.condition_rating && row.condition_rating in next) {
              next[row.condition_rating] += 1;
            }
          }
        );
        setCounts(next);
      } catch (err) {
        console.error("Error fetching rating distribution:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDistribution();
  }, []);

  if (loading) {
    return (
      <Card className="rounded-xl border border-graphite-200 shadow-xs">
        <CardHeader className="pb-0 pt-5 px-5 border-b border-graphite-100 pb-4">
          <CardTitle className="text-[15px] font-bold text-graphite-900 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary-600" />
            Rozkład ocen
          </CardTitle>
          <p className="text-[12px] text-graphite-500 mt-0.5">
            Ocenione elementy turbin
          </p>
        </CardHeader>
        <CardContent className="p-5 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full rounded-md" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const total = ORDER.reduce((acc, r) => acc + counts[r], 0);
  const max = Math.max(1, ...ORDER.map((r) => counts[r]));

  return (
    <Card className="rounded-xl border border-graphite-200 shadow-xs">
      <CardHeader className="pb-0 pt-5 px-5 border-b border-graphite-100 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-[15px] font-bold text-graphite-900 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary-600" />
              Rozkład ocen
            </CardTitle>
            <p className="text-[12px] text-graphite-500 mt-0.5">
              Ocenione elementy turbin
            </p>
          </div>
          <div className="text-right">
            <div className="font-mono text-[20px] font-bold text-graphite-900 leading-none">
              {total}
            </div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-graphite-500 mt-1">
              Łącznie
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="p-3 bg-graphite-50 rounded-2xl mb-3">
              <BarChart3 className="h-8 w-8 text-graphite-200" />
            </div>
            <p className="text-sm font-semibold text-graphite-800">
              Brak ocenionych elementów
            </p>
            <p className="text-xs text-graphite-500 mt-1">
              Rozkład pojawi się po wypełnieniu inspekcji
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {ORDER.map((r) => {
              const count = counts[r];
              const pct = total > 0 ? (count / total) * 100 : 0;
              const relPct = (count / max) * 100;
              return (
                <li key={r}>
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-[13px] font-semibold ${LABEL_FG[r]}`}
                    >
                      {CONDITION_RATINGS[r]}
                    </span>
                    <span className="font-mono text-[12px] text-graphite-500">
                      <span className="text-graphite-900 font-semibold">
                        {count}
                      </span>
                      <span className="text-graphite-400 ml-2">
                        {pct.toFixed(0)}%
                      </span>
                    </span>
                  </div>
                  <div className="h-2 bg-graphite-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${BAR_BG[r]} transition-all`}
                      style={{ width: `${relPct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
