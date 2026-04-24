"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { INSPECTION_STATUS } from "@/lib/constants";

interface Inspection {
  id: string;
  protocol_number: string;
  inspection_date: string;
  status: string;
  turbines: {
    turbine_code: string;
    wind_farms: {
      name: string;
      clients: {
        name: string;
      };
    };
  } | null;
}

export function RecentInspections() {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchInspections = async () => {
      const supabase = createClient();
      try {
        const { data, error } = await supabase
          .from("inspections")
          .select(
            `
            id,
            protocol_number,
            inspection_date,
            status,
            turbines(turbine_code, wind_farms(name, clients(name)))
          `
          )
          .not("is_deleted", "is", true)
          .order("inspection_date", { ascending: false })
          .limit(10);

        if (error) throw error;

        setInspections(data || []);
      } catch (error) {
        console.error("Error fetching inspections:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchInspections();
  }, []);

  const handleRowClick = (inspectionId: string) => {
    router.push(`/inspekcje/${inspectionId}`);
  };

  const getStatusColor = (status: string) => {
    const statusInfo = INSPECTION_STATUS[status as keyof typeof INSPECTION_STATUS];
    return statusInfo?.color || "bg-graphite-100 text-graphite-800";
  };

  const getStatusLabel = (status: string) => {
    const statusInfo = INSPECTION_STATUS[status as keyof typeof INSPECTION_STATUS];
    return statusInfo?.label || status;
  };

  if (loading) {
    return (
      <Card className="lg:col-span-2 rounded-xl border border-graphite-200 shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-[15px] font-bold text-graphite-900">Ostatnie inspekcje</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="lg:col-span-2 rounded-xl border border-graphite-200 shadow-xs">
      <CardHeader className="pb-0 pt-5 px-5 flex flex-row items-center justify-between border-b border-graphite-100 pb-4">
        <div>
          <CardTitle className="text-[15px] font-bold text-graphite-900">Ostatnie inspekcje</CardTitle>
          <p className="text-[12px] text-graphite-500 mt-0.5">Ostatnio zarejestrowane</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-primary-700 hover:text-primary-800 h-8 px-2 text-xs gap-1"
          onClick={() => router.push("/inspekcje")}
        >
          Wszystkie
          <ArrowRight className="h-3 w-3" />
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {inspections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="p-4 bg-graphite-50 rounded-2xl mb-4">
              <ClipboardList className="h-10 w-10 text-graphite-200" />
            </div>
            <p className="text-sm font-semibold text-graphite-800 mb-1">Brak inspekcji</p>
            <p className="text-xs text-graphite-500 mb-4">Dodaj pierwszą inspekcję, aby zobaczyć ją tutaj</p>
            <Button
              size="sm"
              className="h-9 rounded-xl"
              onClick={() => router.push("/inspekcje/nowa")}
            >
              Dodaj inspekcję
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-graphite-50/50 hover:bg-graphite-50/50 border-b border-graphite-100">
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 px-5 py-2.5">Nr protokołu</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5">Data</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5">Turbina</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5">Farma</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400 py-2.5">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inspections.map((inspection) => (
                  <TableRow
                    key={inspection.id}
                    className="cursor-pointer hover:bg-graphite-50/50 transition-colors border-b border-graphite-100 h-[52px]"
                    onClick={() => handleRowClick(inspection.id)}
                  >
                    <TableCell className="font-mono font-semibold text-graphite-900 px-5 text-[13px]">
                      {inspection.protocol_number || "-"}
                    </TableCell>
                    <TableCell className="font-mono text-graphite-500 text-[13px]">
                      {new Date(inspection.inspection_date).toLocaleDateString("pl-PL")}
                    </TableCell>
                    <TableCell className="text-[13px]">
                      <span className="font-mono font-medium text-graphite-800">
                        {inspection.turbines?.turbine_code || "-"}
                      </span>
                      {inspection.turbines?.wind_farms?.name && (
                        <span className="text-graphite-500 ml-1">
                          {inspection.turbines.wind_farms.name}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-graphite-500 text-[13px]">
                      {inspection.turbines?.wind_farms?.clients?.name || "-"}
                    </TableCell>
                    <TableCell className="text-[13px]">
                      <Badge className={getStatusColor(inspection.status)}>
                        {getStatusLabel(inspection.status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
