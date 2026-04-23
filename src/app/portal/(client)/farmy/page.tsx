"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Wind, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface Farm {
  id: string;
  name: string;
  location_address: string | null;
  number_of_turbines: number | null;
  total_capacity_mw: number | null;
  openRecs: number;
  overdueRecs: number;
}

function HealthChip({ open, overdue }: { open: number; overdue: number }) {
  if (overdue > 0) {
    return (
      <Badge className="bg-danger-100 text-danger-800 hover:bg-danger-100 gap-1">
        <XCircle className="h-3 w-3" />
        {overdue} przeterminowane
      </Badge>
    );
  }
  if (open > 0) {
    return (
      <Badge className="bg-warning-100 text-warning-800 hover:bg-warning-100 gap-1">
        <AlertTriangle className="h-3 w-3" />
        {open} otwarte zalecenia
      </Badge>
    );
  }
  return (
    <Badge className="bg-success-100 text-success-800 hover:bg-success-100 gap-1">
      <CheckCircle2 className="h-3 w-3" />
      Wszystko OK
    </Badge>
  );
}

export default function PortalFarmyPage() {
  const router = useRouter();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);

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

      const { data: farmsData } = await supabase
        .from("wind_farms")
        .select("id, name, location_address, number_of_turbines, total_capacity_mw")
        .eq("client_id", clientUser.client_id)
        .not("is_deleted", "is", true)
        .order("name");

      if (!farmsData) return;

      const now = new Date().toISOString();
      const enriched = await Promise.all(
        farmsData.map(async (farm) => {
          const { data: turbines } = await supabase
            .from("turbines")
            .select("id")
            .eq("wind_farm_id", farm.id)
            .not("is_deleted", "is", true);

          const turbineIds = (turbines ?? []).map((t) => t.id);
          if (turbineIds.length === 0) {
            return { ...farm, openRecs: 0, overdueRecs: 0 };
          }

          const { data: inspections } = await supabase
            .from("inspections")
            .select("id")
            .in("turbine_id", turbineIds)
            .not("is_deleted", "is", true);

          const inspectionIds = (inspections ?? []).map((i) => i.id);
          if (inspectionIds.length === 0) {
            return { ...farm, openRecs: 0, overdueRecs: 0 };
          }

          const { data: recs } = await supabase
            .from("repair_recommendations")
            .select("id, deadline_date")
            .in("inspection_id", inspectionIds)
            .eq("is_completed", false);

          const openRecs = recs?.length ?? 0;
          const overdueRecs =
            recs?.filter(
              (r) => r.deadline_date && r.deadline_date < now
            ).length ?? 0;

          return { ...farm, openRecs, overdueRecs };
        })
      );

      setFarms(enriched);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-graphite-900">Moje farmy</h1>
        <p className="text-graphite-500 text-sm mt-1">
          {farms.length} {farms.length === 1 ? "farma" : "farmy wiatrowe"} w
          Państwa portfelu
        </p>
      </div>

      {farms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="p-4 bg-graphite-50 rounded-2xl mb-4">
            <Wind className="h-10 w-10 text-graphite-200" />
          </div>
          <p className="text-sm font-semibold text-graphite-800">
            Brak przypisanych farm
          </p>
          <p className="text-xs text-graphite-500 mt-1">
            Skontaktuj się z ProWaTech w celu przypisania danych
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {farms.map((farm) => (
            <Card
              key={farm.id}
              className="border border-graphite-100 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => router.push(`/portal/farmy/${farm.id}`)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="p-2 bg-primary-50 rounded-lg flex-shrink-0">
                    <Wind className="h-5 w-5 text-primary-600" />
                  </div>
                  <HealthChip
                    open={farm.openRecs}
                    overdue={farm.overdueRecs}
                  />
                </div>
                <h3 className="text-sm font-semibold text-graphite-900 mb-1">
                  {farm.name}
                </h3>
                {farm.location_address && (
                  <p className="text-xs text-graphite-500 mb-3 line-clamp-1">
                    {farm.location_address}
                  </p>
                )}
                <div className="flex gap-4 text-xs text-graphite-500">
                  {farm.number_of_turbines != null && (
                    <span>
                      <span className="font-semibold font-mono text-graphite-800">
                        {farm.number_of_turbines}
                      </span>{" "}
                      turbin
                    </span>
                  )}
                  {farm.total_capacity_mw != null && (
                    <span>
                      <span className="font-semibold font-mono text-graphite-800">
                        {farm.total_capacity_mw}
                      </span>{" "}
                      MW
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
