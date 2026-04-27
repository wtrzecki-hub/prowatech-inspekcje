"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdminImpersonateBannerProps {
  clientName: string;
}

export function AdminImpersonateBanner({ clientName }: AdminImpersonateBannerProps) {
  const router = useRouter();
  const [exiting, setExiting] = useState(false);

  const handleExit = async () => {
    setExiting(true);
    await fetch("/api/admin/impersonate", { method: "DELETE" });
    // Po wyjściu z impersonacji wracamy do panelu admina
    window.location.href = "/dashboard";
  };

  return (
    <div className="bg-warning-50 border-b border-warning-100 px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="bg-warning rounded-lg p-1.5 flex-shrink-0">
          <ShieldAlert className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-warning-800">
            Tryb administratora — podgląd portalu
          </p>
          <p className="text-xs text-graphite-700 truncate">
            Przeglądasz portal jako: <strong>{clientName}</strong>
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExit}
        disabled={exiting}
        className="bg-white hover:bg-warning-50 border-warning-100 text-graphite-900"
      >
        {exiting ? (
          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
        ) : (
          <LogOut className="h-3.5 w-3.5 mr-1.5" />
        )}
        Wyjdź z trybu admin
      </Button>
      <button
        onClick={() => router.push("/klienci")}
        className="text-xs text-info-800 hover:underline whitespace-nowrap"
      >
        Wybierz innego klienta →
      </button>
    </div>
  );
}
