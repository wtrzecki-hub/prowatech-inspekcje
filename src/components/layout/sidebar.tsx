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
        "flex flex-col h-screen bg-white border-r border-gray-100 transition-all duration-300 shadow-sm",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo Section */}
      <div className="p-4 flex items-center justify-between h-16 border-b border-gray-100">
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
          className={cn("p-1.5 h-auto text-gray-400 hover:text-gray-600", isCollapsed && "hidden")}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {isCollapsed && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 h-auto text-gray-400 hover:text-gray-600 absolute bottom-20 left-4"
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
                      ? "bg-blue-50 text-blue-700 font-semibold"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-medium"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5 flex-shrink-0",
                      isActive ? "text-blue-600" : "text-gray-400"
                    )}
                  />
                  {!isCollapsed && (
                    <span className="text-sm">{item.label}</span>
                  )}
                  {isActive && !isCollapsed && (
                    <div className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-600" />
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </ScrollArea>

      {/* User Section */}
      <div className="p-3 border-t border-gray-100">
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
            <AvatarFallback className="bg-blue-600 text-white text-xs font-semibold">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {userName}
              </p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
          )}
          {!isCollapsed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="p-1.5 h-auto text-gray-400 hover:text-red-500 flex-shrink-0"
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
            className="w-full mt-1 p-2 h-auto justify-center text-gray-400 hover:text-red-500"
            title="Wyloguj"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
