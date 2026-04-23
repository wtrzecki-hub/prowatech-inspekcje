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
      iconColor: "text-primary-600",
      iconBg: "bg-primary-50",
      valueColor: "text-graphite-900",
    },
    {
      label: "Inspekcje w toku",
      subtitle: "Aktualnie prowadzone",
      value: stats.inProgressInspections,
      icon: Clock,
      iconColor: "text-warning",
      iconBg: "bg-warning-50",
      valueColor: "text-graphite-900",
    },
    {
      label: "Otwarte zalecenia",
      subtitle: "Wymagające naprawy",
      value: stats.openRecommendations,
      icon: AlertCircle,
      iconColor: "text-danger",
      iconBg: "bg-danger-50",
      valueColor: "text-danger",
    },
    {
      label: "Zakończone w tym miesiącu",
      subtitle: "Zamknięte inspekcje",
      value: stats.completedThisMonth,
      icon: CheckCircle2,
      iconColor: "text-success",
      iconBg: "bg-success-50",
      valueColor: "text-graphite-900",
    },
  ];

  if (stats.loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="rounded-xl">
            <CardContent className="p-5">
              <Skeleton className="h-9 w-9 rounded-lg mb-4" />
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
          <Card key={index} className="rounded-xl border border-graphite-200 shadow-xs hover:shadow-sm transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className={`w-9 h-9 rounded-lg ${stat.iconBg} flex items-center justify-center`}>
                  <Icon className={`h-[18px] w-[18px] ${stat.iconColor}`} />
                </div>
              </div>
              <div className={`font-mono text-[32px] font-bold leading-none mt-3 ${stat.valueColor}`}>
                {stat.value}
              </div>
              <div className="text-sm font-semibold text-graphite-800 mt-1">{stat.label}</div>
              <div className="text-xs text-graphite-500 mt-0.5">{stat.subtitle}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
