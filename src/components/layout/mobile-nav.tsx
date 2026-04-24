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
}

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Klienci", href: "/klienci", icon: Building2 },
  { label: "Farmy wiatrowe", href: "/farmy", icon: Wind },
  { label: "Inspekcje", href: "/inspekcje", icon: ClipboardCheck },
  { label: "Inspektorzy", href: "/inspektorzy", icon: Users },
];

export function MobileNav({ isOpen, onOpenChange }: MobileNavProps) {
  const pathname = usePathname();

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="p-0 w-72">
        <SheetHeader className="border-b border-graphite-200 px-5 py-4">
          <SheetTitle className="text-left flex items-center gap-2.5">
            <img src="/logo-prowatech.png" alt="ProWaTech" className="h-8 w-auto" />
          </SheetTitle>
        </SheetHeader>

        <div className="px-3 py-4 space-y-1">
          {navItems.map((item) => {
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
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
