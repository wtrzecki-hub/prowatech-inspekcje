"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  Clock,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";

interface StatsData {
  totalInspections: number;
  inProgressInspections: number;
  openRecommendations: number;
  completedThisMonth: number;
  loading: boolean;
}

export function StatsCards() {
  const [stats, setStats] = useState<StatsData>({
    totalInspections: 0,
    inProgressInspections: 0,
    openRecommendations: 0,
    completedThisMonth: 0,
    loading: true,
  });

  useEffect(() => {
    const supabase = createClient();

    const fetchStats = async () => {
      try {
        // Get total inspections
        const { count: totalCount } = await supabase
          .from("inspections")
          .select("*", { count: "exact", head: true });

        // Get in-progress inspections
        const { count: inProgressCount } = await supabase
          .from("inspections")
          .select("*", { count: "exact", head: true })
          .eq("status", "in_progress");

        // Get open repair recommendations
        const { count: openRecommendationsCount } = await supabase
          .from("repair_recommendations")
          .select("*", { count: "exact", head: true })
          .eq("is_completed", false);

        // Get inspections completed this month
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const { count: completedThisMonthCount } = await supabase
          .from("inspections")
          .select("*", { count: "exact", head: true })
          .eq("status", "completed")
          .gte("completed_at", firstDay.toISOString())
          .lte("completed_at", lastDay.toISOString());

        setStats({
          totalInspections: totalCount || 0,
          inProgressInspections: inProgressCount || 0,
          openRecommendations: openRecommendationsCount || 0,
          completedThisMonth: completedThisMonthCount || 0,
          loading: false,
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
        setStats((prev) => ({ ...prev, loading: false }));
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      label: "Łączna liczba inspekcji",
      value: stats.totalInspections,
      icon: BarChart3,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      label: "Inspekcje w toku",
      value: stats.inProgressInspections,
      icon: Clock,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
    {
      label: "Otwarte zalecenia",
      value: stats.openRecommendations,
      icon: AlertCircle,
      color: "text-red-600",
      bgColor: "bg-red-100",
    },
    {
      label: "Zakończone w tym miesiącu",
      value: stats.completedThisMonth,
      icon: CheckCircle2,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
  ];

  if (stats.loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {stat.value}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
