"use client";

import { Menu, Wind } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";

interface HeaderProps {
  onMenuClick?: () => void;
  user?: {
    email?: string;
    user_metadata?: {
      full_name?: string;
      avatar_url?: string;
    };
  };
}

export function Header({ onMenuClick, user }: HeaderProps) {
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
    <header className="sticky top-0 z-40 w-full bg-white border-b border-gray-100 shadow-sm">
      <div className="flex h-16 items-center justify-between px-4 gap-3">
        {/* Hamburger + Logo for mobile */}
        <div className="flex items-center gap-3 md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="h-10 w-10 text-gray-500"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="p-1 bg-blue-600 rounded-lg">
              <Wind className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-sm text-gray-900">Prowatech</span>
          </div>
        </div>

        {/* Spacer for desktop */}
        <div className="hidden md:flex flex-1" />

        {/* User Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 h-10 px-2 rounded-xl hover:bg-gray-50"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={user?.user_metadata?.avatar_url}
                  alt={userName}
                />
                <AvatarFallback className="bg-blue-600 text-white text-xs font-semibold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:block text-sm font-medium text-gray-700 max-w-32 truncate">
                {userName}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-2">
              <p className="text-sm font-semibold text-gray-900">{userName}</p>
              <p className="text-xs text-gray-500 mt-0.5">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-red-600 focus:text-red-600 cursor-pointer"
            >
              Wyloguj
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
