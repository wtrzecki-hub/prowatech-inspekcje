"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Wind,
  FileText,
  AlertTriangle,
  Calendar,
  ArrowRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { INSPECTION_STATUS, CONDITION_COLORS } from "@/lib/constants";
import { resolvePortalClient } from "@/lib/portal/resolve-client";

interface DashboardData {
  clientName: string;
  farmCount: number;
  turbineCount: number;
  openRecommendations: number;
  recentProtocols: {
    id: string;
    protocol_number: string | null;
    inspection_date: string | null;
    overall_condition_rating: string | null;
    turbine_code: string;
    farm_name: string;
  }[];
  upcomingInspections: {
    id: string;
    turbine_code: string;
    farm_name: string;
    next_inspection_date: string;
  }[];
}

export default function PortalDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const supabase = createClient();
      const resolved = await resolvePortalClient(supabase);
      if (!resolved.ok) return;

      const clientId = resolved.context.clientId;
      const clientName = resolved.context.clientName;

      const [farmsRes, turbinesRes, recsRes, inspRes] = await Promise.all([
        supabase
          .from("wind_farms")
          .select("id")
          .eq("client_id", clientId)
          .not("is_deleted", "is", true),
        supabase
          .from("turbines")
          .select("id, turbine_code, next_inspection_date, wind_farms!inner(client_id)")
          .eq("wind_farms.client_id", clientId)
          .not("is_deleted", "is", true),
        supabase
          .from("repair_recommendations")
          .select(
            "id, inspections!inner(turbine_id, turbines!inner(wind_farm_id, wind_farms!inner(client_id)))"
          )
          .eq("inspections.turbines.wind_farms.client_id", clientId)
          .eq("is_completed", false),
        supabase
          .from("inspections")
          .select(
            `id, protocol_number, inspection_date, overall_condition_rating,
             turbines!inner(turbine_code, wind_farm_id, wind_farms!inner(client_id, name))`
          )
          .eq("turbines.wind_farms.client_id", clientId)
          .eq("status", "signed")
          .not("is_deleted", "is", true)
          .order("inspection_date", { ascending: false })
          .limit(4),
      ]);

      const turbines = turbinesRes.data ?? [];
      const upcoming = turbines
        .filter((t) => t.next_inspection_date)
        .sort(
          (a, b) =>
            new Date(a.next_inspection_date!).getTime() -
            new Date(b.next_inspection_date!).getTime()
        )
        .slice(0, 3)
        .map((t) => ({
          id: t.id,
          turbine_code: t.turbine_code,
          farm_name: "",
          next_inspection_date: t.next_inspection_date!,
        }));

      const protocols = (inspRes.data ?? []).map((i) => {
        const turbine = i.turbines as unknown as {
          turbine_code: string;
          wind_farms: { name: string };
        } | null;
        return {
          id: i.id,
          protocol_number: i.protocol_number,
          inspection_date: i.inspection_date,
          overall_condition_rating: i.overall_condition_rating,
          turbine_code: turbine?.turbine_code ?? "-",
          farm_name: turbine?.wind_farms?.name ?? "-",
        };
      });

      setData({
        clientName,
        farmCount: farmsRes.data?.length ?? 0,
        turbineCount: turbines.length,
        openRecommendations: recsRes.data?.length ?? 0,
        recentProtocols: protocols,
        upcomingInspections: upcoming,
      });
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-graphite-900">
          Witamy, {data.clientName}
        </h1>
        <p className="text-graphite-500 text-sm mt-1">
          Przegląd stanu Państwa instalacji wiatrowych
        </p>
      </div>

      {data.openRecommendations > 0 && (
        <div className="flex items-start gap-3 p-4 bg-warning-50 border border-warning-100 rounded-xl">
          <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-warning-800">
              Otwarte zalecenia serwisowe
            </p>
            <p className="text-xs text-warning-800 mt-0.5">
              Mają Państwo {data.openRecommendations} niewykonane{" "}
              {data.openRecommendations === 1 ? "zalecenie" : "zaleceń"} z
              poprzednich inspekcji.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="flex-shrink-0 border-warning-100 text-warning-800 hover:bg-warning-100"
            onClick={() => router.push("/portal/protokoly")}
          >
            Zobacz
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="border border-graphite-100">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-50 rounded-lg">
                <Wind className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono text-graphite-900">
                  {data.farmCount}
                </p>
                <p className="text-xs text-graphite-500 font-medium">
                  {data.farmCount === 1 ? "Farma" : "Farmy"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-graphite-100">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-graphite-50 rounded-lg">
                <Wind className="h-5 w-5 text-graphite-500" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono text-graphite-900">
                  {data.turbineCount}
                </p>
                <p className="text-xs text-graphite-500 font-medium">Turbiny</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-graphite-100">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-info-50 rounded-lg">
                <FileText className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono text-graphite-900">
                  {data.recentProtocols.length}
                </p>
                <p className="text-xs text-graphite-500 font-medium">
                  Protokołów
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border border-graphite-100">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold text-graphite-900">
              Ostatnie protokoły
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-primary-600 hover:text-primary-700 h-8 px-2 text-xs gap-1"
              onClick={() => router.push("/portal/protokoly")}
            >
              Wszystkie
              <ArrowRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recentProtocols.length === 0 ? (
              <p className="text-sm text-graphite-500 py-4 text-center">
                Brak podpisanych protokołów
              </p>
            ) : (
              data.recentProtocols.map((p) => {
                const cond = p.overall_condition_rating
                  ? CONDITION_COLORS[p.overall_condition_rating as keyof typeof CONDITION_COLORS]
                  : null;
                const condColor = cond ? `${cond.bg} ${cond.text}` : "bg-graphite-100 text-graphite-800";
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-graphite-100 hover:bg-graphite-50 cursor-pointer transition-colors"
                    onClick={() => router.push("/portal/protokoly")}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-graphite-900 truncate">
                        {p.protocol_number ?? "—"} · {p.turbine_code}
                      </p>
                      <p className="text-xs text-graphite-500 truncate">
                        {p.farm_name} ·{" "}
                        {p.inspection_date
                          ? new Date(p.inspection_date).toLocaleDateString(
                              "pl-PL"
                            )
                          : "—"}
                      </p>
                    </div>
                    {p.overall_condition_rating && (
                      <Badge className={`${condColor} flex-shrink-0 text-xs`}>
                        {p.overall_condition_rating}
                      </Badge>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="border border-graphite-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-graphite-900 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-graphite-500" />
              Nadchodzące inspekcje
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.upcomingInspections.length === 0 ? (
              <p className="text-sm text-graphite-500 py-4 text-center">
                Brak zaplanowanych inspekcji
              </p>
            ) : (
              data.upcomingInspections.map((ins) => {
                const date = new Date(ins.next_inspection_date);
                const isOverdue = date < new Date();
                return (
                  <div
                    key={ins.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-graphite-100"
                  >
                    <div
                      className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center flex-shrink-0 ${
                        isOverdue ? "bg-danger-50" : "bg-primary-50"
                      }`}
                    >
                      <span
                        className={`text-xs font-bold leading-none ${
                          isOverdue ? "text-danger" : "text-primary-700"
                        }`}
                      >
                        {date.getDate()}
                      </span>
                      <span
                        className={`text-xs leading-none ${
                          isOverdue ? "text-danger" : "text-primary-500"
                        }`}
                      >
                        {date.toLocaleString("pl-PL", { month: "short" })}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-graphite-900 font-mono">
                        {ins.turbine_code}
                      </p>
                      <p className="text-xs text-graphite-500">
                        {isOverdue ? "Termin minął" : "Planowana inspekcja"}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
