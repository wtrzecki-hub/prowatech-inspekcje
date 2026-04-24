"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus, LineChart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";

const WEEKS = 12;

interface WeekBucket {
  start: Date;
  end: Date;
  count: number;
}

function startOfIsoWeek(d: Date): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay(); // 0 = sunday
  const diff = (day === 0 ? -6 : 1 - day);
  date.setDate(date.getDate() + diff);
  return date;
}

function buildBuckets(): WeekBucket[] {
  const now = startOfIsoWeek(new Date());
  const buckets: WeekBucket[] = [];
  for (let i = WEEKS - 1; i >= 0; i--) {
    const start = new Date(now);
    start.setDate(start.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    buckets.push({ start, end, count: 0 });
  }
  return buckets;
}

export function InspectionTrendSparkline() {
  const [buckets, setBuckets] = useState<WeekBucket[]>(buildBuckets());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrend = async () => {
      const supabase = createClient();
      try {
        const initialBuckets = buildBuckets();
        const from = initialBuckets[0].start.toISOString();

        const { data, error } = await supabase
          .from("inspections")
          .select("inspection_date")
          .gte("inspection_date", from)
          .not("is_deleted", "is", true)
          .not("inspection_date", "is", null);

        if (error) throw error;

        const filled = initialBuckets.map((b) => ({ ...b }));
        (data || []).forEach((row: { inspection_date: string | null }) => {
          if (!row.inspection_date) return;
          const d = new Date(row.inspection_date);
          const idx = filled.findIndex(
            (b) => d >= b.start && d < b.end
          );
          if (idx >= 0) filled[idx].count += 1;
        });

        setBuckets(filled);
      } catch (err) {
        console.error("Error fetching inspection trend:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTrend();
  }, []);

  if (loading) {
    return (
      <Card className="rounded-xl border border-graphite-200 shadow-xs">
        <CardHeader className="pb-0 pt-5 px-5 border-b border-graphite-100 pb-4">
          <CardTitle className="text-[15px] font-bold text-graphite-900">
            Trend inspekcji
          </CardTitle>
          <p className="text-[12px] text-graphite-500 mt-0.5">
            Ostatnie {WEEKS} tygodni
          </p>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const total = buckets.reduce((acc, b) => acc + b.count, 0);
  const lastCount = buckets[buckets.length - 1]?.count ?? 0;
  const prevCount = buckets[buckets.length - 2]?.count ?? 0;
  const delta = lastCount - prevCount;

  // SVG sparkline geometry
  const W = 280;
  const H = 64;
  const PADDING_X = 4;
  const PADDING_Y = 8;
  const maxVal = Math.max(1, ...buckets.map((b) => b.count));
  const stepX = (W - PADDING_X * 2) / Math.max(1, buckets.length - 1);

  const points = buckets.map((b, i) => {
    const x = PADDING_X + i * stepX;
    const y =
      H - PADDING_Y - ((b.count / maxVal) * (H - PADDING_Y * 2) || 0);
    return { x, y, count: b.count };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

  const areaD =
    `${pathD} L${points[points.length - 1].x.toFixed(1)},${H - PADDING_Y} ` +
    `L${points[0].x.toFixed(1)},${H - PADDING_Y} Z`;

  const trendIcon =
    delta > 0 ? (
      <TrendingUp className="h-3.5 w-3.5" />
    ) : delta < 0 ? (
      <TrendingDown className="h-3.5 w-3.5" />
    ) : (
      <Minus className="h-3.5 w-3.5" />
    );

  const trendClass =
    delta > 0
      ? "text-success bg-success-50"
      : delta < 0
      ? "text-danger bg-danger-50"
      : "text-graphite-500 bg-graphite-100";

  const trendLabel =
    delta === 0
      ? "bez zmian"
      : `${delta > 0 ? "+" : ""}${delta} vs poprz. tydz.`;

  if (total === 0) {
    return (
      <Card className="rounded-xl border border-graphite-200 shadow-xs">
        <CardHeader className="pb-0 pt-5 px-5 border-b border-graphite-100 pb-4">
          <CardTitle className="text-[15px] font-bold text-graphite-900">
            Trend inspekcji
          </CardTitle>
          <p className="text-[12px] text-graphite-500 mt-0.5">
            Ostatnie {WEEKS} tygodni
          </p>
        </CardHeader>
        <CardContent className="p-5">
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="p-3 bg-graphite-50 rounded-2xl mb-3">
              <LineChart className="h-8 w-8 text-graphite-200" />
            </div>
            <p className="text-sm font-semibold text-graphite-800">
              Brak danych w oknie
            </p>
            <p className="text-xs text-graphite-500 mt-1">
              Trend pojawi się po zarejestrowaniu inspekcji
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl border border-graphite-200 shadow-xs">
      <CardHeader className="pb-0 pt-5 px-5 border-b border-graphite-100 pb-4">
        <CardTitle className="text-[15px] font-bold text-graphite-900">
          Trend inspekcji
        </CardTitle>
        <p className="text-[12px] text-graphite-500 mt-0.5">
          Ostatnie {WEEKS} tygodni
        </p>
      </CardHeader>
      <CardContent className="p-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[32px] font-bold leading-none text-graphite-900">
              {total}
            </div>
            <div className="text-[12px] text-graphite-500 mt-1">
              Łącznie w oknie
            </div>
          </div>
          <div
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold font-mono ${trendClass}`}
          >
            {trendIcon}
            {trendLabel}
          </div>
        </div>

        <div className="mt-4">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="w-full h-16"
            role="img"
            aria-label={`Trend inspekcji — ${WEEKS} tygodni, łącznie ${total}`}
          >
            <defs>
              <linearGradient
                id="sparklineGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor="#259648" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#259648" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={areaD} fill="url(#sparklineGradient)" />
            <path
              d={pathD}
              fill="none"
              stroke="#259648"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {points.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={i === points.length - 1 ? 3 : 1.75}
                fill={i === points.length - 1 ? "#1F7F3A" : "#259648"}
              />
            ))}
          </svg>
          <div className="mt-2 flex justify-between text-[10px] font-mono text-graphite-400 uppercase tracking-wider">
            <span>
              {buckets[0]?.start.toLocaleDateString("pl-PL", {
                day: "2-digit",
                month: "2-digit",
              })}
            </span>
            <span>
              {buckets[buckets.length - 1]?.start.toLocaleDateString("pl-PL", {
                day: "2-digit",
                month: "2-digit",
              })}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
