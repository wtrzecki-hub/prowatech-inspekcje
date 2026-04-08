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

        const { data, error } = await supabase
          .from("repair_recommendations")
          .select(
            `
            id,
            scope_description,
            element_name,
            urgency_level,
            deadline_date,
            inspection_id
          `
          )
          .eq("is_completed", false)
          .lt("deadline_date", now)
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
    return urgency?.color || "bg-gray-100 text-gray-800";
  };

  const getUrgencyLabel = (level: string) => {
    const urgency = URGENCY_LEVEL[level as keyof typeof URGENCY_LEVEL];
    return urgency?.label || level;
  };

  if (loading) {
    return (
      <Card className="lg:col-span-1 rounded-xl border border-gray-100 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            Przeterminowane zalecenia
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
    <Card className="lg:col-span-1 rounded-xl border border-gray-100 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-500" />
          Przeterminowane zalecenia
          {recommendations.length > 0 && (
            <span className="ml-auto text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
              {recommendations.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {recommendations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="p-3 bg-green-50 rounded-2xl mb-3">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <p className="text-sm font-semibold text-gray-700">Wszystko w porządku</p>
            <p className="text-xs text-gray-400 mt-1">Brak przeterminowanych zaleceń</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recommendations.map((rec) => (
              <div
                key={rec.id}
                className="p-3 rounded-xl border border-red-100 bg-red-50 cursor-pointer hover:bg-red-100 transition-colors"
                onClick={() => handleCardClick(rec.inspection_id)}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate">
                      {rec.element_name}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">
                      {rec.scope_description}
                    </p>
                  </div>
                  <Badge className={`${getUrgencyColor(rec.urgency_level)} flex-shrink-0`}>
                    {getUrgencyLabel(rec.urgency_level)}
                  </Badge>
                </div>
                <p className="text-xs text-red-600 font-semibold">
                  Termin: {new Date(rec.deadline_date).toLocaleDateString("pl-PL")}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
