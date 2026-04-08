"use client";

import Link from "next/link";
import { Plus, ClipboardCheck, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { RecentInspections } from "@/components/dashboard/recent-inspections";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Witaj w systemie zarządzania inspekcjami turbin wiatrowych
          </p>
        </div>
        {/* Quick Actions */}
        <div className="flex gap-3 flex-col sm:flex-row">
          <Link href="/inspekcje/nowa">
            <Button className="w-full sm:w-auto h-10 rounded-xl bg-blue-600 hover:bg-blue-700 gap-2">
              <Plus className="h-4 w-4" />
              Nowa inspekcja
            </Button>
          </Link>
          <Link href="/klienci?nowy=true">
            <Button
              variant="outline"
              className="w-full sm:w-auto h-10 rounded-xl border-gray-200 gap-2"
            >
              <Building2 className="h-4 w-4" />
              Dodaj klienta
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <StatsCards />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <RecentInspections />
        <AlertsPanel />
      </div>
    </div>
  );
}
