"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Wind, FileText, User, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { readImpersonateCookie } from "@/lib/portal/resolve-client";
import { AdminImpersonateBanner } from "@/components/portal/admin-impersonate-banner";

const navItems = [
  { label: "Panel", href: "/portal/dashboard", icon: LayoutDashboard },
  { label: "Moje farmy", href: "/portal/farmy", icon: Wind },
  { label: "Protokoły", href: "/portal/protokoly", icon: FileText },
  { label: "Konto", href: "/portal/konto", icon: User },
];

export default function PortalClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [impersonateClientName, setImpersonateClientName] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/portal/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, force_password_change, full_name, email")
        .eq("id", session.user.id)
        .single();

      if (!profile) {
        await supabase.auth.signOut();
        router.push("/portal/login");
        return;
      }

      const impersonateClientId = readImpersonateCookie();

      // Admin z cookie impersonacji — wpuszczamy
      if (profile.role === "admin" && impersonateClientId) {
        const { data: client } = await supabase
          .from("clients")
          .select("name")
          .eq("id", impersonateClientId)
          .not("is_deleted", "is", true)
          .single();
        if (!client) {
          // Cookie wskazuje na nieistniejącego klienta — czyść i przekieruj
          await fetch("/api/admin/impersonate", { method: "DELETE" });
          router.push("/dashboard");
          return;
        }
        setImpersonateClientName(client.name);
        setUserName(`${profile.full_name || profile.email} (admin)`);
        setUserEmail(profile.email || "");
        setLoading(false);
        return;
      }

      // Standardowy client_user
      if (profile.role !== "client_user") {
        await supabase.auth.signOut();
        router.push("/portal/login");
        return;
      }

      if (
        profile.force_password_change &&
        !pathname?.startsWith("/portal/konto")
      ) {
        router.push("/portal/konto");
        return;
      }

      setUserName(profile.full_name || profile.email || "");
      setUserEmail(profile.email || "");
      setLoading(false);
    };

    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.push("/portal/login");
    });

    return () => subscription?.unsubscribe();
  }, [router, pathname]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/portal/login");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-graphite-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3" />
          <p className="text-graphite-500 text-sm">Ładowanie...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-graphite-50">
      {/* Sidebar */}
      <div className="hidden md:flex flex-col w-60 bg-white border-r border-graphite-100 shadow-sm flex-shrink-0">
        <div className="p-4 h-16 flex items-center gap-2.5 border-b border-graphite-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-prowatech.png" alt="ProWaTech" className="h-9 w-auto flex-shrink-0" />
          <p className="text-xs font-bold text-graphite-900 leading-tight">
            Portal Operatora
          </p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              pathname?.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 cursor-pointer text-sm",
                    isActive
                      ? "bg-primary-50 text-primary-700 font-semibold"
                      : "text-graphite-500 hover:bg-graphite-50 hover:text-graphite-900 font-medium"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 flex-shrink-0",
                      isActive ? "text-primary-600" : "text-graphite-500"
                    )}
                  />
                  {item.label}
                  {isActive && (
                    <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary-600" />
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-graphite-100">
          <div className="flex items-center gap-2 p-2 rounded-xl">
            <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-primary-700">
                {userName.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-graphite-900 truncate">
                {userName}
              </p>
              <p className="text-xs text-graphite-500 truncate">{userEmail}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="p-1.5 h-auto text-graphite-500 hover:text-danger flex-shrink-0"
              title="Wyloguj"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile top bar */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {impersonateClientName && (
          <AdminImpersonateBanner clientName={impersonateClientName} />
        )}
        <div className="md:hidden flex items-center justify-between px-4 h-14 bg-white border-b border-graphite-100">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-prowatech.png" alt="ProWaTech" className="h-7 w-auto flex-shrink-0" />
            <span className="text-sm font-bold text-graphite-900">
              Portal Operatora
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="p-1.5 h-auto text-graphite-500 hover:text-danger"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        {/* Mobile nav */}
        <div className="md:hidden flex border-b border-graphite-100 bg-white overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-4 py-2 text-xs flex-shrink-0",
                  isActive
                    ? "text-primary-700 font-semibold border-b-2 border-primary"
                    : "text-graphite-500"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>

        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
