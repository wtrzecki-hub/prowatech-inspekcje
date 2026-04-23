"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { AlertTriangle, Calendar, ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CONDITION_COLORS } from "@/lib/constants";

interface Turbine {
  id: string;
  turbine_code: string;
  manufacturer: string | null;
  model: string | null;
  rated_power_mw: number | null;
  next_inspection_date: string | null;
  wind_farms: { name: string; client_id: string } | null;
}

interface Inspection {
  id: string;
  protocol_number: string | null;
  inspection_date: string | null;
  inspection_type: string;
  overall_condition_rating: string | null;
  status: string;
}

interface Recommendation {
  id: string;
  scope_description: string;
  element_name: string | null;
  urgency_level: string | null;
  deadline_date: string | null;
  is_completed: boolean;
}

export default function PortalTurbineDetailPage() {
  const router = useRouter();
  const params = useParams();
  const turbineId = params.id as string;

  const [turbine, setTurbine] = useState<Turbine | null>(null);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [openRecs, setOpenRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const { data: clientUser } = await supabase
        .from("client_users")
        .select("client_id")
        .eq("user_id", session.user.id)
        .single();

      if (!clientUser) return;

      const { data: turbineData } = await supabase
        .from("turbines")
        .select(
          "id, turbine_code, manufacturer, model, rated_power_mw, next_inspection_date, wind_farms(name, client_id)"
        )
        .eq("id", turbineId)
        .not("is_deleted", "is", true)
        .single();

      if (!turbineData) {
        setForbidden(true);
        setLoading(false);
        return;
      }

      const farm = turbineData.wind_farms as unknown as { name: string; client_id: string } | null;
      if (farm?.client_id !== clientUser.client_id) {
        setForbidden(true);
        setLoading(false);
        return;
      }

      setTurbine({ ...turbineData, wind_farms: farm });

      const [insRes, recRes] = await Promise.all([
        supabase
          .from("inspections")
          .select(
            "id, protocol_number, inspection_date, inspection_type, overall_condition_rating, status"
          )
          .eq("turbine_id", turbineId)
          .eq("status", "signed")
          .not("is_deleted", "is", true)
          .order("inspection_date", { ascending: false })
          .limit(10),
        supabase
          .from("repair_recommendations")
          .select(
            "id, scope_description, element_name, urgency_level, deadline_date, is_completed, inspection_id, inspections!inner(turbine_id)"
          )
          .eq("inspections.turbine_id", turbineId)
          .eq("is_completed", false)
          .order("deadline_date", { ascending: true }),
      ]);

      setInspections(insRes.data ?? []);
      setOpenRecs(recRes.data ?? []);
      setLoading(false);
    };
    fetch();
  }, [turbineId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (forbidden || !turbine) {
    return (
      <div className="text-center py-20">
        <p className="text-graphite-500 text-sm">Brak dostępu do tej turbiny</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => router.push("/portal/farmy")}
        >
          Wróć do farm
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="text-graphite-500 hover:text-graphite-900 gap-1 px-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Wróć
        </Button>
      </div>

      <Card className="border border-graphite-100">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-graphite-500 mb-1">
                {turbine.wind_farms?.name}
              </p>
              <h1 className="text-2xl font-bold font-mono text-graphite-900">
                {turbine.turbine_code}
              </h1>
              {(turbine.manufacturer || turbine.model) && (
                <p className="text-sm text-graphite-500 mt-1">
                  {[turbine.manufacturer, turbine.model]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
            {turbine.rated_power_mw && (
              <div className="text-right flex-shrink-0">
                <p className="text-2xl font-bold font-mono text-graphite-900">
                  {turbine.rated_power_mw}
                </p>
                <p className="text-xs text-graphite-500">MW</p>
              </div>
            )}
          </div>
          {turbine.next_inspection_date && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-graphite-100">
              <Calendar className="h-4 w-4 text-graphite-500" />
              <span className="text-xs text-graphite-500">
                Następna inspekcja:{" "}
                <span className="font-semibold text-graphite-800">
                  {new Date(turbine.next_inspection_date).toLocaleDateString(
                    "pl-PL"
                  )}
                </span>
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {openRecs.length > 0 && (
        <Card className="border border-warning-100 bg-warning-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-warning-800 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Otwarte zalecenia serwisowe ({openRecs.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {openRecs.map((rec) => {
              const isOverdue =
                rec.deadline_date && rec.deadline_date < new Date().toISOString();
              return (
                <div
                  key={rec.id}
                  className="p-3 bg-white rounded-xl border border-warning-100"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {rec.element_name && (
                        <p className="text-xs font-semibold text-graphite-900">
                          {rec.element_name}
                        </p>
                      )}
                      <p className="text-xs text-graphite-600 mt-0.5 line-clamp-2">
                        {rec.scope_description}
                      </p>
                    </div>
                    {rec.urgency_level && (
                      <Badge className="bg-warning-100 text-warning-800 hover:bg-warning-100 flex-shrink-0 text-xs">
                        Pilność {rec.urgency_level}
                      </Badge>
                    )}
                  </div>
                  {rec.deadline_date && (
                    <p
                      className={`text-xs font-semibold mt-2 ${
                        isOverdue ? "text-danger" : "text-graphite-500"
                      }`}
                    >
                      Termin:{" "}
                      {new Date(rec.deadline_date).toLocaleDateString("pl-PL")}
                      {isOverdue ? " — przeterminowane" : ""}
                    </p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card className="border border-graphite-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-graphite-900">
            Historia inspekcji
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {inspections.length === 0 ? (
            <p className="text-sm text-graphite-500 py-4 text-center">
              Brak podpisanych protokołów dla tej turbiny
            </p>
          ) : (
            inspections.map((ins) => {
              const cond = ins.overall_condition_rating
                ? CONDITION_COLORS[ins.overall_condition_rating as keyof typeof CONDITION_COLORS]
                : null;
              const condColor = cond ? `${cond.bg} ${cond.text}` : "bg-graphite-100 text-graphite-800";
              return (
                <div
                  key={ins.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-graphite-100"
                >
                  <div className="w-10 h-10 bg-graphite-50 rounded-lg flex flex-col items-center justify-center flex-shrink-0">
                    {ins.inspection_date && (
                      <>
                        <span className="text-xs font-bold text-graphite-800 leading-none">
                          {new Date(ins.inspection_date).getFullYear()}
                        </span>
                        <span className="text-xs text-graphite-500 leading-none">
                          {new Date(ins.inspection_date).toLocaleString(
                            "pl-PL",
                            { month: "short" }
                          )}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold font-mono text-graphite-900">
                      {ins.protocol_number ?? "—"}
                    </p>
                    <p className="text-xs text-graphite-500">
                      {ins.inspection_type === "annual"
                        ? "Inspekcja roczna"
                        : "Inspekcja 5-letnia"}
                    </p>
                  </div>
                  {ins.overall_condition_rating && (
                    <Badge className={`text-xs ${condColor} flex-shrink-0`}>
                      {ins.overall_condition_rating}
                    </Badge>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
