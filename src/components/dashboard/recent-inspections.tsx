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
    return statusInfo?.color || "bg-gray-100 text-gray-800";
  };

  const getStatusLabel = (status: string) => {
    const statusInfo = INSPECTION_STATUS[status as keyof typeof INSPECTION_STATUS];
    return statusInfo?.label || status;
  };

  if (loading) {
    return (
      <Card className="lg:col-span-2 rounded-xl border border-gray-100 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-gray-900">Ostatnie inspekcje</CardTitle>
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
    <Card className="lg:col-span-2 rounded-xl border border-gray-100 shadow-sm">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold text-gray-900">Ostatnie inspekcje</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="text-blue-600 hover:text-blue-700 h-8 px-2 text-xs gap-1"
          onClick={() => router.push("/inspekcje")}
        >
          Zobacz wszystkie
          <ArrowRight className="h-3 w-3" />
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {inspections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="p-4 bg-gray-50 rounded-2xl mb-4">
              <ClipboardList className="h-10 w-10 text-gray-300" />
            </div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Brak inspekcji</p>
            <p className="text-xs text-gray-400 mb-4">Dodaj pierwszą inspekcję, aby zobaczyć ją tutaj</p>
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
                <TableRow className="border-b border-gray-100">
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-400 px-4">Nr protokołu</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-400">Data</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-400">Turbina</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-400">Farma</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-400">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inspections.map((inspection) => (
                  <TableRow
                    key={inspection.id}
                    className="cursor-pointer hover:bg-blue-50/50 transition-colors border-b border-gray-50 h-14"
                    onClick={() => handleRowClick(inspection.id)}
                  >
                    <TableCell className="text-xs font-semibold text-gray-900 px-4">
                      {inspection.protocol_number || "-"}
                    </TableCell>
                    <TableCell className="text-xs text-gray-600">
                      {new Date(inspection.inspection_date).toLocaleDateString("pl-PL")}
                    </TableCell>
                    <TableCell className="text-xs text-gray-600">
                      {inspection.turbines?.turbine_code || "-"}
                    </TableCell>
                    <TableCell className="text-xs text-gray-600">
                      {inspection.turbines?.wind_farms?.name || "-"}
                    </TableCell>
                    <TableCell className="text-xs">
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
