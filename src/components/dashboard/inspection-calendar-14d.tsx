"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";

const DAYS_BACK = 3;
const DAYS_FORWARD = 10; // łącznie 14 dni (3 w tył + dziś + 10 w przód)

interface DayCell {
  date: Date;
  isToday: boolean;
  isWeekend: boolean;
  completed: number; // inspekcje ze statusem zakończona/podpisana
  planned: number; // inspekcje w trakcie / przypadające next_*_date
}

interface InspectionRow {
  id: string;
  inspection_date: string | null;
  next_annual_date: string | null;
  next_five_year_date: string | null;
  next_electrical_date: string | null;
  status: string;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function InspectionCalendar14d() {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [cells, setCells] = useState<DayCell[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const buildInitial = (): DayCell[] => {
      const arr: DayCell[] = [];
      for (let offset = -DAYS_BACK; offset <= DAYS_FORWARD; offset++) {
        const d = new Date(today);
        d.setDate(d.getDate() + offset);
        const dow = d.getDay();
        arr.push({
          date: d,
          isToday: offset === 0,
          isWeekend: dow === 0 || dow === 6,
          completed: 0,
          planned: 0,
        });
      }
      return arr;
    };

    const fetchData = async () => {
      const supabase = createClient();
      try {
        const initial = buildInitial();
        const start = initial[0].date;
        const end = new Date(initial[initial.length - 1].date);
        end.setDate(end.getDate() + 1);

        const startIso = start.toISOString();
        const endIso = end.toISOString();

        // Pobieramy inspekcje które mogą trafić w okno po którymkolwiek z pól dat.
        const { data, error } = await supabase
          .from("inspections")
          .select(
            "id, inspection_date, next_annual_date, next_five_year_date, next_electrical_date, status"
          )
          .not("is_deleted", "is", true)
          .or(
            [
              `and(inspection_date.gte.${startIso},inspection_date.lt.${endIso})`,
              `and(next_annual_date.gte.${startIso},next_annual_date.lt.${endIso})`,
              `and(next_five_year_date.gte.${startIso},next_five_year_date.lt.${endIso})`,
              `and(next_electrical_date.gte.${startIso},next_electrical_date.lt.${endIso})`,
            ].join(",")
          );

        if (error) throw error;

        const rows = (data || []) as InspectionRow[];

        rows.forEach((row) => {
          if (row.inspection_date) {
            const d = startOfDay(new Date(row.inspection_date));
            const idx = initial.findIndex((c) => sameDay(c.date, d));
            if (idx >= 0) {
              const isDone =
                row.status === "completed" ||
                row.status === "signed" ||
                row.status === "review";
              if (isDone) initial[idx].completed += 1;
              else initial[idx].planned += 1;
            }
          }

          const addPlanned = (iso: string | null) => {
            if (!iso) return;
            const d = startOfDay(new Date(iso));
            const idx = initial.findIndex((c) => sameDay(c.date, d));
            if (idx >= 0) initial[idx].planned += 1;
          };
          addPlanned(row.next_annual_date);
          addPlanned(row.next_five_year_date);
          addPlanned(row.next_electrical_date);
        });

        setCells(initial);
      } catch (err) {
        console.error("Error fetching calendar inspections:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [today]);

  if (loading) {
    return (
      <Card className="rounded-xl border border-graphite-200 shadow-xs">
        <CardHeader className="pb-0 pt-5 px-5 border-b border-graphite-100 pb-4">
          <CardTitle className="text-[15px] font-bold text-graphite-900 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary-600" />
            Kalendarz 14 dni
          </CardTitle>
          <p className="text-[12px] text-graphite-500 mt-0.5">
            Wykonane i nadchodzące inspekcje
          </p>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 14 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalCompleted = cells.reduce((acc, c) => acc + c.completed, 0);
  const totalPlanned = cells.reduce((acc, c) => acc + c.planned, 0);

  return (
    <Card className="rounded-xl border border-graphite-200 shadow-xs">
      <CardHeader className="pb-0 pt-5 px-5 border-b border-graphite-100 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-[15px] font-bold text-graphite-900 flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary-600" />
              Kalendarz 14 dni
            </CardTitle>
            <p className="text-[12px] text-graphite-500 mt-0.5">
              Wykonane i nadchodzące inspekcje
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono uppercase tracking-wider text-graphite-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-primary-600" />
              <span className="text-graphite-800">{totalCompleted}</span>
              <span>wyk.</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-warning" />
              <span className="text-graphite-800">{totalPlanned}</span>
              <span>plan.</span>
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        <div className="grid grid-cols-7 gap-1.5">
          {["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"].map((d) => (
            <div
              key={d}
              className="text-[10px] font-mono font-semibold uppercase tracking-wider text-graphite-400 text-center pb-1"
            >
              {d}
            </div>
          ))}

          {/* Przesunięcie pierwszej pozycji względem Pn */}
          {(() => {
            if (cells.length === 0) return null;
            const firstDow = cells[0].date.getDay();
            const offset = firstDow === 0 ? 6 : firstDow - 1;
            return Array.from({ length: offset }).map((_, i) => (
              <div key={`pad-${i}`} />
            ));
          })()}

          {cells.map((c, i) => {
            const total = c.completed + c.planned;
            const hasData = total > 0;
            const isPast = c.date.getTime() < today.getTime();

            const base =
              "relative h-16 rounded-lg border flex flex-col p-1.5 transition-colors";
            const state = c.isToday
              ? "border-primary-600 bg-primary-50 ring-1 ring-primary-600/30"
              : hasData
              ? "border-graphite-200 bg-graphite-50 hover:bg-graphite-100"
              : "border-dashed border-graphite-200 bg-transparent";

            const dateFg = c.isToday
              ? "text-primary-700"
              : c.isWeekend
              ? "text-graphite-400"
              : "text-graphite-800";

            const handleClick = () => {
              if (!hasData) return;
              const iso = c.date.toISOString().slice(0, 10);
              router.push(`/inspekcje?date=${iso}`);
            };

            return (
              <div
                key={i}
                className={`${base} ${state} ${
                  hasData ? "cursor-pointer" : ""
                }`}
                onClick={handleClick}
                role={hasData ? "button" : undefined}
                tabIndex={hasData ? 0 : -1}
                title={
                  c.isToday
                    ? `Dziś · ${c.completed} wyk. · ${c.planned} plan.`
                    : c.date.toLocaleDateString("pl-PL", {
                        day: "2-digit",
                        month: "long",
                        weekday: "long",
                      })
                }
              >
                <div className="flex items-start justify-between">
                  <span
                    className={`font-mono text-[13px] font-semibold leading-none ${dateFg}`}
                  >
                    {c.date.getDate()}
                  </span>
                  {c.isToday && (
                    <span className="text-[9px] font-mono uppercase tracking-wider text-primary-700 font-bold">
                      dziś
                    </span>
                  )}
                </div>
                <div className="mt-auto flex items-center gap-1">
                  {c.completed > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-semibold text-primary-700">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary-600" />
                      {c.completed}
                    </span>
                  )}
                  {c.planned > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-semibold text-warning-700">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-warning" />
                      {c.planned}
                    </span>
                  )}
                  {!hasData && isPast && (
                    <span className="text-[9px] text-graphite-400 font-mono">
                      —
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
