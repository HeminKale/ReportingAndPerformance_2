"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { NotificationBell } from "@/components/shared/notification-bell";
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
} from "lucide-react";

interface SidebarProps {
  orgSlug: string;
  userRole: string;
  userId: string;
}

export function Sidebar({ orgSlug, userRole, userId }: SidebarProps) {
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
      title: "Manager Panel",
      href: `/org/${orgSlug}/manager`,
      icon: Users,
      roles: ['admin', 'manager'],
    },
    {
      title: "Admin Panel",
      href: `/org/${orgSlug}/admin`,
      icon: Settings,
      roles: ['admin'],
    },
  ];

  const filteredNavItems = navItems.filter((item) =>
    item.roles.includes(userRole)
  );

  return (
    <div className="flex flex-col h-full w-64 bg-card border-r">
      <div className="p-6 border-b flex items-center justify-between">
        <h1 className="text-xl font-bold">Employee Tracker</h1>
        <NotificationBell userId={userId} orgSlug={orgSlug} />
      </div>
      
      <nav className="flex-1 p-4 space-y-1">
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.title}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t">
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5 mr-3" />
          Logout
        </Button>
      </div>
    </div>
  );
}
