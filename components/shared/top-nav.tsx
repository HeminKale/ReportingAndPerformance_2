"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Flame, LogOut, Settings, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { NotificationBell } from "@/components/shared/notification-bell";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { APP_THEMES, AppTheme, useTheme } from "@/lib/hooks/use-theme";
import { rankForTotalXp } from "@/lib/gamification/xp-rules";

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
  { title: "XP History", path: "xp-history" },
];

/** Primary bar shows this many links; additional routes go under "More". */
const NAV_PRIMARY_MAX = 10;

function ThemeDot({ theme }: { theme: AppTheme }) {
  const colors: Record<AppTheme, string> = {
    taskos: "from-indigo-500 to-indigo-700",
    bloom: "from-fuchsia-500 to-violet-600",
    sand: "from-[#fff6f0] to-[#faf9f6] ring-1 ring-amber-200/80",
    stone: "from-[#d7d6d4] to-[#faf9f6] ring-1 ring-stone-300/80",
    sage: "from-[#e8f2eb] to-[#f6fbf7] ring-1 ring-emerald-200/80",
  };

  return <span className={cn("h-4 w-4 rounded-full bg-gradient-to-br", colors[theme])} />;
}

export function TopNav({ orgSlug, userRole, userId, userName }: TopNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { theme, setTheme } = useTheme();
  const [moreOpen, setMoreOpen] = useState(false);
  const [gamificationHud, setGamificationHud] = useState<{
    streak: number;
    xp: number;
    rank: string;
  } | null>(null);
  const canAccessAdminTools = userRole === "admin" || userRole === "manager";
  const displayName = userName || "Hero";
  const { primaryNavItems, overflowNavItems } = useMemo(() => {
    const primary = navItems.slice(0, NAV_PRIMARY_MAX);
    const overflow = navItems.length > NAV_PRIMARY_MAX ? navItems.slice(NAV_PRIMARY_MAX) : [];
    return { primaryNavItems: primary, overflowNavItems: overflow };
  }, []);

  const overflowHasActive = overflowNavItems.some(
    (item) => pathname === `/org/${orgSlug}/${item.path}`
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_gamification")
        .select("total_xp, current_streak")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      if (!data) {
        setGamificationHud({ streak: 0, xp: 0, rank: rankForTotalXp(0).rankName });
        return;
      }
      const xp = data.total_xp ?? 0;
      setGamificationHud({
        streak: data.current_streak ?? 0,
        xp,
        rank: rankForTotalXp(xp).rankName,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="app-shell-nav fixed inset-x-0 top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center gap-2 px-4 md:gap-3 md:px-6">
        <Link
          href={`/org/${orgSlug}/dashboard`}
          className="app-logo-text flex shrink-0 items-center gap-2 font-black tracking-tight text-slate-900"
        >
          <span className="app-logo-icon inline-flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white">⚡</span>
          <span>Worksphere</span>
        </Link>

        <nav className="app-nav-links mx-auto hidden min-w-0 flex-1 items-center justify-center gap-0 border-0 bg-transparent p-0 md:flex">
          <div className="flex min-w-0 max-w-full flex-wrap items-center justify-center gap-x-0 gap-y-0">
            {primaryNavItems.map((item) => {
              const href = `/org/${orgSlug}/${item.path}`;
              const isActive = pathname === href;
              return (
                <Link
                  key={item.path}
                  href={href}
                  className={cn(
                    "app-nav-link shrink-0 rounded-none border-b-2 border-transparent px-2.5 py-2 text-sm font-semibold text-slate-600 transition-colors duration-200 hover:border-slate-300 hover:text-slate-900 md:px-3",
                    isActive && "app-nav-link-active border-slate-900 text-slate-900"
                  )}
                >
                  {item.title}
                </Link>
              );
            })}
            {overflowNavItems.length > 0 && (
              <Popover open={moreOpen} onOpenChange={setMoreOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "app-nav-link inline-flex shrink-0 items-center gap-0.5 rounded-none border-b-2 border-transparent px-2.5 py-2 text-sm font-semibold text-slate-600 transition-colors duration-200 hover:border-slate-300 hover:text-slate-900 md:px-3",
                      overflowHasActive && "app-nav-link-active border-slate-900 text-slate-900",
                      moreOpen && !overflowHasActive && "border-slate-400 text-slate-900"
                    )}
                    aria-expanded={moreOpen}
                    aria-haspopup="true"
                  >
                    More
                    <ChevronDown className="h-4 w-4 opacity-70" aria-hidden />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="center" className="app-popover w-56 p-2">
                  <p className="px-2 pb-1 pt-0.5 text-xs font-bold uppercase tracking-wider text-slate-500">More</p>
                  <div className="flex flex-col">
                    {overflowNavItems.map((item) => {
                      const href = `/org/${orgSlug}/${item.path}`;
                      const isActive = pathname === href;
                      return (
                        <Link
                          key={item.path}
                          href={href}
                          onClick={() => setMoreOpen(false)}
                          className={cn(
                            "rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100",
                            isActive && "bg-slate-100 font-semibold text-slate-900"
                          )}
                        >
                          {item.title}
                        </Link>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1">
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
              <Button variant="ghost" className="app-ghost-btn h-10 gap-1 rounded-full px-2" aria-label="Account menu">
                <span className="app-avatar-dot inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                  {displayName.charAt(0).toUpperCase()}
                </span>
                <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="app-popover w-72 rounded-2xl border-slate-200 p-3">
              <div className="app-profile-panel rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="truncate font-bold tracking-tight text-slate-900">{displayName}</p>
                <p className="text-sm capitalize text-slate-500">{userRole}</p>
                <div className="mt-3 space-y-1.5 text-sm">
                  <p className="flex items-center gap-2 text-slate-700">
                    <Flame className="h-4 w-4 text-orange-500" />
                    <span>{gamificationHud?.streak ?? 0} day streak</span>
                  </p>
                  <p className="flex items-center gap-2 text-slate-700">
                    <Sparkles className="h-4 w-4 text-fuchsia-500" />
                    <span>
                      {gamificationHud?.xp ?? 0} XP · {gamificationHud?.rank ?? "Rookie"}
                    </span>
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
