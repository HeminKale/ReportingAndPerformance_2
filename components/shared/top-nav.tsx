"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Flame, LogOut, Settings, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { NotificationBell } from "@/components/shared/notification-bell";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { APP_THEMES, AppTheme, useTheme } from "@/lib/hooks/use-theme";

interface TopNavProps {
  orgSlug: string;
  userRole: string;
  userId: string;
  userName?: string;
}

const navItems = [
  { title: "Dashboard", path: "dashboard" },
  { title: "Tasks", path: "tasks" },
  { title: "Attendance", path: "attendance" },
  { title: "Leaves", path: "leaves" },
  { title: "Notifications", path: "notifications" },
  { title: "Calendar", path: "calendar" },
  { title: "Leaderboard", path: "leaderboard" },
  { title: "Documents", path: "documents" },
  { title: "Enquiries", path: "enquiries" },
  { title: "Trainings", path: "trainings" },
  { title: "Mistakes", path: "mistakes" },
  { title: "Announcements", path: "announcements" },
];

function ThemeDot({ theme }: { theme: AppTheme }) {
  const colors: Record<AppTheme, string> = {
    taskos: "from-blue-500 to-indigo-600",
    bloom: "from-fuchsia-500 to-violet-600",
    midnight: "from-cyan-400 to-blue-500",
  };

  return <span className={cn("h-4 w-4 rounded-full bg-gradient-to-br", colors[theme])} />;
}

export function TopNav({ orgSlug, userRole, userId, userName }: TopNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { theme, setTheme } = useTheme();
  const canAccessAdminTools = userRole === "admin" || userRole === "manager";
  const displayName = userName || "Hero";
  const appTitle = theme === "bloom" ? "Bloom" : theme === "midnight" ? "Midnight" : "TaskOS";

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="app-shell-nav fixed inset-x-0 top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center gap-3 px-4 md:px-6">
        <Link href={`/org/${orgSlug}/dashboard`} className="app-logo-text flex items-center gap-2 font-black tracking-tight text-slate-900">
          <span className="app-logo-icon inline-flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white">⚡</span>
          <span>{appTitle}</span>
        </Link>

        <nav className="app-nav-links mx-auto hidden items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 md:flex">
          {navItems.map((item) => {
            const href = `/org/${orgSlug}/${item.path}`;
            const isActive = pathname === href;
            return (
              <Link
                key={item.path}
                href={href}
                className={cn(
                  "app-nav-link rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 transition-all duration-200 hover:bg-slate-100 hover:text-slate-900",
                  isActive && "app-nav-link-active bg-slate-100 text-slate-900"
                )}
              >
                {item.title}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <NotificationBell userId={userId} orgSlug={orgSlug} />

          {canAccessAdminTools && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="app-ghost-btn rounded-full">
                  <Settings className="app-icon h-5 w-5 text-slate-600" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="app-popover w-56 rounded-2xl border-slate-200 p-2">
                <p className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-500">Control Center</p>
                <div className="space-y-1">
                  <Link
                    href={`/org/${orgSlug}/manager`}
                    className="block rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                  >
                    Manager Panel
                  </Link>
                  {userRole === "admin" && (
                    <Link
                      href={`/org/${orgSlug}/settings`}
                      className="block rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                    >
                      Admin Settings
                    </Link>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" className="app-ghost-btn h-10 rounded-full px-2.5">
                <span className="app-avatar-dot inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                  {displayName.charAt(0).toUpperCase()}
                </span>
                <span className="app-nav-link ml-2 hidden max-w-24 truncate text-sm font-semibold text-slate-700 md:block">{displayName}</span>
                <ChevronDown className="ml-1 h-4 w-4 text-slate-500" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="app-popover w-72 rounded-2xl border-slate-200 p-3">
              <div className="app-profile-panel rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="truncate font-bold tracking-tight text-slate-900">{displayName}</p>
                <p className="text-sm capitalize text-slate-500">{userRole}</p>
                <div className="mt-3 space-y-1.5 text-sm">
                  <p className="flex items-center gap-2 text-slate-700">
                    <Flame className="h-4 w-4 text-orange-500" />
                    <span>5 Day Streak</span>
                  </p>
                  <p className="flex items-center gap-2 text-slate-700">
                    <Sparkles className="h-4 w-4 text-fuchsia-500" />
                    <span>850 XP</span>
                  </p>
                </div>
              </div>

              <div className="mt-3">
                <p className="px-1 text-xs font-bold uppercase tracking-wider text-slate-500">Theme</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {APP_THEMES.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setTheme(option.value)}
                      className={cn(
                        "rounded-xl border px-2 py-2 text-xs font-semibold transition-all",
                        theme === option.value
                          ? "app-theme-pill-active border-blue-300 bg-blue-50 text-blue-700"
                          : "app-theme-pill border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      )}
                    >
                      <span className="mb-1 flex justify-center">
                        <ThemeDot theme={option.value} />
                      </span>
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                variant="outline"
                className="mt-3 w-full justify-start rounded-xl border-slate-200 text-slate-700"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </header>
  );
}
