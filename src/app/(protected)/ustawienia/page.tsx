"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Settings,
  User,
  Building,
  Users as UsersIcon,
  ClipboardList,
  ShieldOff,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { ProfileSection } from "@/components/settings/profile-section";
import { CompanySection } from "@/components/settings/company-section";
import { UsersSection } from "@/components/settings/users-section";
import { InspectionConfigSection } from "@/components/settings/inspection-config-section";

export default function UstawieniaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      setUserId(session.user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();
      setUserRole(profile?.role ?? null);
      setLoading(false);
    };
    load();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (userRole !== "admin") {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <ShieldOff className="h-12 w-12 text-graphite-300 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-graphite-900 mb-1">
            Brak dostępu
          </h2>
          <p className="text-sm text-graphite-500 mb-4">
            Sekcja Ustawienia jest dostępna tylko dla administratorów.
          </p>
          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            Wróć do dashboardu
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div>
        <p className="text-[11px] font-semibold tracking-wider uppercase text-graphite-500 mb-1">
          Administracja
        </p>
        <div className="flex items-center gap-2">
          <Settings className="h-7 w-7 text-graphite-700" />
          <h1 className="text-2xl md:text-3xl font-bold text-graphite-900">
            Ustawienia
          </h1>
        </div>
        <p className="text-sm text-graphite-500 mt-1">
          Konfiguracja konta, firmy, użytkowników i parametrów inspekcji.
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="h-auto flex-wrap justify-start gap-1 p-1 bg-graphite-100">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Profil użytkownika
          </TabsTrigger>
          <TabsTrigger value="company" className="gap-2">
            <Building className="h-4 w-4" />
            Dane firmy
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <UsersIcon className="h-4 w-4" />
            Użytkownicy
          </TabsTrigger>
          <TabsTrigger value="inspections" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Konfiguracja inspekcji
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          {userId && <ProfileSection userId={userId} />}
        </TabsContent>
        <TabsContent value="company" className="mt-6">
          <CompanySection />
        </TabsContent>
        <TabsContent value="users" className="mt-6">
          <UsersSection currentUserId={userId} />
        </TabsContent>
        <TabsContent value="inspections" className="mt-6">
          <InspectionConfigSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
