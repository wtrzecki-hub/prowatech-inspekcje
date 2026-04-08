"use client";

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
        <SheetHeader className="border-b border-gray-100 px-5 py-4">
          <SheetTitle className="text-left flex items-center gap-2.5">
            <div className="p-1.5 bg-blue-600 rounded-lg">
              <Wind className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-gray-900">Prowatech</span>
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
                  <span className="text-sm">{item.label}</span>
                  {isActive && (
                    <div className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-600" />
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
