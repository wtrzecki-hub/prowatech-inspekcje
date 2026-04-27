"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Wind,
  ClipboardCheck,
  Users,
  Activity,
  Library,
  Settings,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface MobileNavProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  userRole?: string | null;
}

const NAV_ITEMS_BASE = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Klienci", href: "/klienci", icon: Building2 },
  { label: "Farmy wiatrowe", href: "/farmy", icon: Wind },
  { label: "Inspekcje", href: "/inspekcje", icon: ClipboardCheck },
  { label: "Inspektorzy", href: "/inspektorzy", icon: Users },
  { label: "Biblioteka defektów", href: "/biblioteka-defektow", icon: Library },
];

const NAV_ITEMS_ADMIN = [
  { label: "Ustawienia", href: "/ustawienia", icon: Settings },
  { label: "Diagnostyka", href: "/diagnostyka", icon: Activity },
];

export function MobileNav({ isOpen, onOpenChange, userRole }: MobileNavProps) {
  const pathname = usePathname();
  const isAdmin = userRole === "admin";

  const renderItem = (item: { label: string; href: string; icon: typeof LayoutDashboard }) => {
    const Icon = item.icon;
    const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => onOpenChange(false)}
      >
        <div
          className={cn(
            "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-150",
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
          <span className="text-sm">{item.label}</span>
          {isActive && (
            <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary-600" />
          )}
        </div>
      </Link>
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="p-0 w-72">
        <SheetHeader className="border-b border-graphite-200 px-5 py-4">
          <SheetTitle className="text-left flex items-center gap-2.5">
            <img src="/logo-prowatech.png" alt="ProWaTech" className="h-8 w-auto" />
          </SheetTitle>
        </SheetHeader>

        <div className="px-3 py-4 space-y-1">
          {NAV_ITEMS_BASE.map(renderItem)}
        </div>

        {isAdmin && (
          <>
            <div className="mt-2 mb-2 px-3">
              <p className="text-[11px] font-semibold tracking-wider uppercase text-graphite-400">
                Administracja
              </p>
            </div>
            <div className="px-3 space-y-1">
              {NAV_ITEMS_ADMIN.map(renderItem)}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
