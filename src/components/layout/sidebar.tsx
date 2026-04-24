"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Building2,
  Wind,
  ClipboardCheck,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface SidebarProps {
  user?: {
    email?: string;
    user_metadata?: {
      full_name?: string;
      avatar_url?: string;
    };
  };
}

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Klienci", href: "/klienci", icon: Building2 },
  { label: "Farmy wiatrowe", href: "/farmy", icon: Wind },
  { label: "Inspekcje", href: "/inspekcje", icon: ClipboardCheck },
  { label: "Inspektorzy", href: "/inspektorzy", icon: Users },
];

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const userName = user?.user_metadata?.full_name || user?.email || "Użytkownik";
  const userInitials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={cn(
        "flex flex-col h-screen bg-white border-r border-graphite-200 transition-all duration-300 shadow-xs",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo Section */}
      <div className="p-4 flex items-center justify-between h-16 border-b border-graphite-200">
        {!isCollapsed && (
          <div className="flex items-center gap-2.5">
            <img src="/logo-prowatech.png" alt="ProWaTech" className="h-9 w-auto" />
          </div>
        )}
        {isCollapsed && (
          <div className="mx-auto">
            <img src="/logo-prowatech.png" alt="ProWaTech" className="h-8 w-auto" />
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn("p-1.5 h-auto text-graphite-500 hover:text-graphite-800", isCollapsed && "hidden")}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {isCollapsed && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 h-auto text-graphite-500 hover:text-graphite-800 absolute bottom-20 left-4"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Navigation Items */}
      <ScrollArea className="flex-1 px-3 py-4">
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");

            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 cursor-pointer",
                    isCollapsed && "justify-center px-2",
                    isActive
                      ? "bg-primary-50 text-primary-700 font-semibold"
                      : "text-graphite-500 hover:bg-graphite-50 hover:text-graphite-900 font-medium"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5 flex-shrink-0",
                      isActive ? "text-primary-600" : "text-graphite-500"
                    )}
                  />
                  {!isCollapsed && (
                    <span className="text-sm">{item.label}</span>
                  )}
                  {isActive && !isCollapsed && (
                    <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary-600" />
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </ScrollArea>

      {/* User Section */}
      <div className="p-3 border-t border-graphite-200">
        <div
          className={cn(
            "flex items-center gap-3 p-2 rounded-xl",
            isCollapsed && "justify-center"
          )}
        >
          <Avatar className="h-9 w-9 flex-shrink-0">
            <AvatarImage
              src={user?.user_metadata?.avatar_url}
              alt={userName}
            />
            <AvatarFallback className="bg-primary-600 text-white text-xs font-semibold">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-graphite-900 truncate">
                {userName}
              </p>
              <p className="text-xs text-graphite-500 truncate">{user?.email}</p>
            </div>
          )}
          {!isCollapsed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="p-1.5 h-auto text-graphite-500 hover:text-danger flex-shrink-0"
              title="Wyloguj"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
        {isCollapsed && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full mt-1 p-2 h-auto justify-center text-graphite-500 hover:text-danger"
            title="Wyloguj"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
