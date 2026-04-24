"use client";

import Link from "next/link";
import { Plus, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { RecentInspections } from "@/components/dashboard/recent-inspections";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";
import { InspectionTrendSparkline } from "@/components/dashboard/inspection-trend-sparkline";
import { InspectionCalendar14d } from "@/components/dashboard/inspection-calendar-14d";
import { RatingDistribution } from "@/components/dashboard/rating-distribution";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-primary-700 font-semibold mb-1">
            Dashboard
          </div>
          <h1 className="text-2xl font-bold text-graphite-900 tracking-tight">
            Panel inspektora
          </h1>
          <p className="text-sm text-graphite-500 mt-0.5">
            Skrót stanu inspekcji ProWaTech
          </p>
        </div>
        {/* Quick Actions */}
        <div className="flex gap-3 flex-col sm:flex-row">
          <Link href="/inspekcje/nowa">
            <Button className="w-full sm:w-auto h-10 gap-2">
              <Plus className="h-4 w-4" />
              Nowa inspekcja
            </Button>
          </Link>
          <Link href="/klienci?nowy=true">
            <Button
              variant="outline"
              className="w-full sm:w-auto h-10 border-graphite-200 gap-2"
            >
              <Building2 className="h-4 w-4" />
              Dodaj klienta
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <StatsCards />

      {/* Analytics row — trend, kalendarz, rozkład ocen */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <InspectionTrendSparkline />
        <div className="lg:col-span-2">
          <InspectionCalendar14d />
        </div>
      </div>

      {/* Recent + rating + alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <RecentInspections />
        <div className="flex flex-col gap-6">
          <RatingDistribution />
          <AlertsPanel />
        </div>
      </div>
    </div>
  );
}
