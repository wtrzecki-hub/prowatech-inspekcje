"use client";

import { useEffect, useState } from "react";
import { FileText, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CONDITION_COLORS } from "@/lib/constants";

interface Protocol {
  id: string;
  protocol_number: string | null;
  inspection_date: string | null;
  inspection_type: string;
  overall_condition_rating: string | null;
  turbine_code: string;
  farm_name: string;
}

export default function PortalProtokolyPage() {
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const { data: clientUser } = await supabase
        .from("client_users")
        .select("client_id")
        .eq("user_id", session.user.id)
        .single();

      if (!clientUser) return;

      const { data: inspections } = await supabase
        .from("inspections")
        .select(
          `id, protocol_number, inspection_date, inspection_type, overall_condition_rating,
           turbines!inner(turbine_code, wind_farms!inner(client_id, name))`
        )
        .eq("turbines.wind_farms.client_id", clientUser.client_id)
        .eq("status", "signed")
        .not("is_deleted", "is", true)
        .order("inspection_date", { ascending: false });

      const items = (inspections ?? []).map((i) => {
        const turbine = i.turbines as unknown as {
          turbine_code: string;
          wind_farms: { name: string };
        } | null;
        return {
          id: i.id,
          protocol_number: i.protocol_number,
          inspection_date: i.inspection_date,
          inspection_type: i.inspection_type,
          overall_condition_rating: i.overall_condition_rating,
          turbine_code: turbine?.turbine_code ?? "-",
          farm_name: turbine?.wind_farms?.name ?? "-",
        };
      });

      setProtocols(items);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-graphite-900">
          Archiwum protokołów
        </h1>
        <p className="text-graphite-500 text-sm mt-1">
          Podpisane protokoły z inspekcji Państwa instalacji
        </p>
      </div>

      <Card className="border border-graphite-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-graphite-900 flex items-center gap-2">
            <FileText className="h-4 w-4 text-graphite-500" />
            {protocols.length}{" "}
            {protocols.length === 1 ? "protokół" : "protokołów"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {protocols.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 bg-graphite-50 rounded-2xl mb-4">
                <FileText className="h-10 w-10 text-graphite-200" />
              </div>
              <p className="text-sm font-semibold text-graphite-800">
                Brak protokołów
              </p>
              <p className="text-xs text-graphite-500 mt-1">
                Podpisane protokoły będą widoczne po zakończeniu inspekcji
              </p>
            </div>
          ) : (
            <div className="divide-y divide-graphite-100">
              {protocols.map((p) => {
                const cond = p.overall_condition_rating
                  ? CONDITION_COLORS[p.overall_condition_rating as keyof typeof CONDITION_COLORS]
                  : null;
                const condColor = cond ? `${cond.bg} ${cond.text}` : "bg-graphite-100 text-graphite-800";

                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-4 px-4 py-3 hover:bg-graphite-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold font-mono text-graphite-900">
                          {p.protocol_number ?? "—"}
                        </span>
                        <span className="text-xs text-graphite-500">·</span>
                        <span className="text-xs font-mono text-graphite-700">
                          {p.turbine_code}
                        </span>
                        <span className="text-xs text-graphite-500">·</span>
                        <span className="text-xs text-graphite-500 truncate">
                          {p.farm_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-graphite-500">
                          {p.inspection_date
                            ? new Date(p.inspection_date).toLocaleDateString(
                                "pl-PL"
                              )
                            : "—"}
                        </span>
                        <Badge className="text-xs bg-graphite-100 text-graphite-800 hover:bg-graphite-100">
                          {p.inspection_type === "annual"
                            ? "Roczna"
                            : "5-letnia"}
                        </Badge>
                        {p.overall_condition_rating && (
                          <Badge className={`text-xs ${condColor}`}>
                            {p.overall_condition_rating}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2.5 text-xs gap-1 border-graphite-200"
                        onClick={() =>
                          window.open(`/api/pdf/${p.id}`, "_blank")
                        }
                      >
                        <Download className="h-3 w-3" />
                        PDF
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2.5 text-xs gap-1 border-graphite-200"
                        onClick={() =>
                          window.open(`/api/docx/${p.id}`, "_blank")
                        }
                      >
                        <Download className="h-3 w-3" />
                        DOCX
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
