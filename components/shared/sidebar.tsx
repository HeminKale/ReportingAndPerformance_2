"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { NotificationBell } from "@/components/shared/notification-bell";
import { PlayerLevelWidget } from "@/components/gamification/player-level-widget";
import {
  LayoutDashboard,
  CheckSquare,
  Clock,
  Calendar,
  Bell,
  Trophy,
  AlertCircle,
  Users,
  Settings,
  LogOut,
  Megaphone,
} from "lucide-react";

interface SidebarProps {
  orgSlug: string;
  orgName?: string | null;
  userRole: string;
  userId: string;
  userName?: string;
  totalXp: number;
}

export function Sidebar({
  orgSlug,
  orgName,
  userRole,
  userId,
  userName,
  totalXp,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const navItems = [
    {
      title: "Dashboard",
      href: `/org/${orgSlug}/dashboard`,
      icon: LayoutDashboard,
      roles: ['admin', 'manager', 'employee'],
    },
    {
      title: "Tasks",
      href: `/org/${orgSlug}/tasks`,
      icon: CheckSquare,
      roles: ['admin', 'manager', 'employee'],
    },
    {
      title: "Attendance",
      href: `/org/${orgSlug}/attendance`,
      icon: Clock,
      roles: ['admin', 'manager', 'employee'],
    },
    {
      title: "Leaves",
      href: `/org/${orgSlug}/leaves`,
      icon: Calendar,
      roles: ['admin', 'manager', 'employee'],
    },
    {
      title: "Notifications",
      href: `/org/${orgSlug}/notifications`,
      icon: Bell,
      roles: ['admin', 'manager', 'employee'],
    },
    {
      title: "Calendar",
      href: `/org/${orgSlug}/calendar`,
      icon: Calendar,
      roles: ['admin', 'manager', 'employee'],
    },
    {
      title: "Leaderboard",
      href: `/org/${orgSlug}/leaderboard`,
      icon: Trophy,
      roles: ['admin', 'manager', 'employee'],
    },
    {
      title: "Mistakes",
      href: `/org/${orgSlug}/mistakes`,
      icon: AlertCircle,
      roles: ['admin', 'manager', 'employee'],
    },
    {
      title: "Announcements",
      href: `/org/${orgSlug}/announcements`,
      icon: Megaphone,
      roles: ['admin', 'manager', 'employee'],
    },
    {
      title: "Manager Panel",
      href: `/org/${orgSlug}/manager`,
      icon: Users,
      roles: ['manager', 'admin'],
    },
    {
      title: "Settings",
      href: `/org/${orgSlug}/settings`,
      icon: Settings,
      roles: ['admin'],
    },
  ];

  const filteredNavItems = navItems.filter((item) =>
    item.roles.includes(userRole)
  );

  return (
    <div className="flex h-full w-64 flex-col border-r border-slate-800/80 bg-slate-900 text-slate-200">
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 p-5">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wider text-slate-500">
            Workspace
          </p>
          <h1 className="truncate text-lg font-bold text-white" title={orgName || orgSlug}>
            {orgName || orgSlug}
          </h1>
        </div>
        <NotificationBell userId={userId} orgSlug={orgSlug} variant="dark" />
      </div>
      
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "border-l-2 border-indigo-400 bg-indigo-500/15 text-white"
                  : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
              )}
            >
              <Icon className={cn("h-5 w-5 shrink-0", isActive ? "text-indigo-300" : "text-slate-400")} />
              {item.title}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-slate-800 p-4">
        <div className="rounded-xl border border-slate-700/80 bg-slate-800/40 px-3 py-2">
          <p className="truncate text-sm font-semibold text-white">{userName || "Member"}</p>
          <p className="text-xs capitalize text-slate-400">{userRole}</p>
        </div>
        <PlayerLevelWidget totalXp={totalXp} compact />
        <Button
          variant="outline"
          className="w-full justify-start rounded-xl border-slate-600 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );
}
