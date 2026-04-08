"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  Clock,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
    const fetchStats = async () => {
      const supabase = createClient();
      try {
        const { count: totalCount } = await supabase
          .from("inspections")
          .select("*", { count: "exact", head: true });

        const { count: inProgressCount } = await supabase
          .from("inspections")
          .select("*", { count: "exact", head: true })
          .eq("status", "in_progress");

        const { count: openRecommendationsCount } = await supabase
          .from("repair_recommendations")
          .select("*", { count: "exact", head: true })
          .eq("is_completed", false);

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
      subtitle: "Wszystkie zarejestrowane",
      value: stats.totalInspections,
      icon: BarChart3,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-50",
      valueColor: "text-blue-700",
    },
    {
      label: "Inspekcje w toku",
      subtitle: "Aktualnie prowadzone",
      value: stats.inProgressInspections,
      icon: Clock,
      iconColor: "text-amber-600",
      iconBg: "bg-amber-50",
      valueColor: "text-amber-700",
    },
    {
      label: "Otwarte zalecenia",
      subtitle: "Wymagające naprawy",
      value: stats.openRecommendations,
      icon: AlertCircle,
      iconColor: "text-red-600",
      iconBg: "bg-red-50",
      valueColor: "text-red-700",
    },
    {
      label: "Zakończone w tym miesiącu",
      subtitle: "Zamknięte inspekcje",
      value: stats.completedThisMonth,
      icon: CheckCircle2,
      iconColor: "text-green-600",
      iconBg: "bg-green-50",
      valueColor: "text-green-700",
    },
  ];

  if (stats.loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="rounded-xl">
            <CardContent className="p-6">
              <Skeleton className="h-10 w-10 rounded-xl mb-4" />
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-4 w-32" />
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
          <Card key={index} className="rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className={`inline-flex p-2.5 rounded-xl ${stat.iconBg} mb-4`}>
                <Icon className={`h-5 w-5 ${stat.iconColor}`} />
              </div>
              <div className={`text-4xl font-bold mb-1 ${stat.valueColor}`}>
                {stat.value}
              </div>
              <div className="text-sm font-semibold text-gray-700">{stat.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{stat.subtitle}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
