"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { URGENCY_LEVEL } from "@/lib/constants";

interface RepairRecommendation {
  id: string;
  scope_description: string;
  element_name: string;
  urgency_level: string;
  deadline_date: string;
  inspection_id: string;
}

export function AlertsPanel() {
  const [recommendations, setRecommendations] = useState<RepairRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchOverdueRecommendations = async () => {
      const supabase = createClient();
      try {
        const now = new Date().toISOString();

        // Inner join z `inspections` + filter `is_deleted` — żeby nie pokazywać
        // zaleceń z soft-deleted inspekcji.
        const { data, error } = await supabase
          .from("repair_recommendations")
          .select(
            `
            id,
            scope_description,
            element_name,
            urgency_level,
            deadline_date,
            inspection_id,
            inspections!inner(is_deleted)
          `
          )
          .eq("is_completed", false)
          .lt("deadline_date", now)
          .not("inspections.is_deleted", "is", true)
          .order("deadline_date", { ascending: true })
          .limit(10);

        if (error) throw error;

        setRecommendations(data || []);
      } catch (error) {
        console.error("Error fetching overdue recommendations:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOverdueRecommendations();
  }, []);

  const handleCardClick = (inspectionId: string) => {
    router.push(`/inspekcje/${inspectionId}`);
  };

  const getUrgencyColor = (level: string) => {
    const urgency = URGENCY_LEVEL[level as keyof typeof URGENCY_LEVEL];
    return urgency?.color || "bg-graphite-100 text-graphite-800";
  };

  const getUrgencyLabel = (level: string) => {
    const urgency = URGENCY_LEVEL[level as keyof typeof URGENCY_LEVEL];
    return urgency?.label || level;
  };

  if (loading) {
    return (
      <Card className="lg:col-span-1 rounded-xl border border-graphite-200 shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-[15px] font-bold text-graphite-900 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-danger" />
            Najpilniejsze zalecenia
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="lg:col-span-1 rounded-xl border border-graphite-200 shadow-xs">
      <CardHeader className="pb-0 pt-5 px-5 border-b border-graphite-100 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-[15px] font-bold text-graphite-900 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-danger" />
              Najpilniejsze zalecenia
            </CardTitle>
            <p className="text-[12px] text-graphite-500 mt-0.5">Wymagają zajęcia się</p>
          </div>
          {recommendations.length > 0 && (
            <span className="text-xs font-semibold bg-danger-50 text-danger-700 px-2 py-0.5 rounded-full">
              {recommendations.length}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {recommendations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-5 text-center">
            <div className="p-3 bg-success-50 rounded-2xl mb-3">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <p className="text-sm font-semibold text-graphite-800">Wszystko w porządku</p>
            <p className="text-xs text-graphite-500 mt-1">Brak przeterminowanych zaleceń</p>
          </div>
        ) : (
          <ul className="divide-y divide-graphite-100">
            {recommendations.map((rec) => (
              <li
                key={rec.id}
                className="p-4 hover:bg-graphite-50/50 cursor-pointer transition-colors"
                onClick={() => handleCardClick(rec.inspection_id)}
              >
                <div className="flex items-start gap-3">
                  <Badge className={`${getUrgencyColor(rec.urgency_level)} shrink-0 mt-0.5`}>
                    {getUrgencyLabel(rec.urgency_level)}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-graphite-900 leading-tight">
                      {rec.element_name}
                    </p>
                    <p className="text-[12px] text-graphite-500 mt-0.5 line-clamp-2">
                      {rec.scope_description}
                    </p>
                    <p className="font-mono text-[11px] text-danger mt-1 font-semibold">
                      Termin: {new Date(rec.deadline_date).toLocaleDateString("pl-PL")}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
