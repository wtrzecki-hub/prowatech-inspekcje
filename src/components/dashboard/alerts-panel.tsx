"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
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
    const supabase = createClient();

    const fetchOverdueRecommendations = async () => {
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
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            Przeterminowane zalecenia
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="lg:col-span-1">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600" />
          Przeterminowane zalecenia
        </CardTitle>
      </CardHeader>
      <CardContent>
        {recommendations.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-green-600 text-sm font-medium">
              ✓ Brak przeterminowanych zaleceń
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recommendations.map((rec) => (
              <div
                key={rec.id}
                className="p-3 rounded-lg border border-red-200 bg-red-50 cursor-pointer hover:bg-red-100 transition"
                onClick={() => handleCardClick(rec.inspection_id)}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-900">
                      {rec.element_name}
                    </p>
                    <p className="text-xs text-gray-700 mt-1">
                      {rec.scope_description}
                    </p>
                  </div>
                  <Badge className={getUrgencyColor(rec.urgency_level)}>
                    {getUrgencyLabel(rec.urgency_level)}
                  </Badge>
                </div>
                <p className="text-xs text-red-700 font-medium">
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
