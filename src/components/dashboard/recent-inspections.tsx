"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { INSPECTION_STATUS } from "@/lib/constants";

interface Inspection {
  id: string;
  protocol_number: string;
  inspection_date: string;
  status: string;
  assessment_rating: number | null;
  turbines: {
    name: string;
  };
  wind_farms: {
    name: string;
  };
  clients: {
    name: string;
  };
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
            assessment_rating,
            turbines(name),
            wind_farms(name),
            clients(name)
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
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">Ostatnie inspekcje</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-lg">Ostatnie inspekcje</CardTitle>
      </CardHeader>
      <CardContent>
        {inspections.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">Brak inspekcji</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Nr protokołu</TableHead>
                  <TableHead className="text-xs">Data</TableHead>
                  <TableHead className="text-xs">Turbina</TableHead>
                  <TableHead className="text-xs">Farma</TableHead>
                  <TableHead className="text-xs">Klient</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Ocena</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inspections.map((inspection) => (
                  <TableRow
                    key={inspection.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleRowClick(inspection.id)}
                  >
                    <TableCell className="text-xs font-medium">
                      {inspection.protocol_number}
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(inspection.inspection_date).toLocaleDateString("pl-PL")}
                    </TableCell>
                    <TableCell className="text-xs">
                      {inspection.turbines?.name || "-"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {inspection.wind_farms?.name || "-"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {inspection.clients?.name || "-"}
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge className={getStatusColor(inspection.status)}>
                        {getStatusLabel(inspection.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      {inspection.assessment_rating ? `${inspection.assessment_rating}/10` : "-"}
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
