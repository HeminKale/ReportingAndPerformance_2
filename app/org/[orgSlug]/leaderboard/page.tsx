"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { getCurrentTimeInTimezone } from "@/lib/utils/timezone";
import { 
  CalendarIcon, Trophy, Medal, Award, Crown, 
  Star, Sparkles, ChevronRight, Quote 
} from "lucide-react";
import type { User, LeaderboardDaily } from "@/lib/types/database";
import { dailyPerformanceLabel } from "@/lib/types/database";
import { cn } from "@/lib/utils/cn";
import { DashboardSkyBg } from "@/components/dashboard/dashboard-sky-bg";

interface LeaderboardEntry {
  id: string;
  user_id: string;
  month: string;
  rank: number;
  score: number;
  decided_by: string;
  notes: string | null;
  users: User;
}

type DailyRow = {
  user: User;
  rating: LeaderboardDaily | null;
};

function SkeletonRow() {
  return (
    <div className="flex items-center gap-6 p-6 rounded-xl border animate-pulse bg-white/50">
      <div className="h-12 w-12 rounded-full bg-muted flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-muted rounded w-1/3" />
        <div className="h-3 bg-muted rounded w-1/4" />
      </div>
      <div className="h-8 w-16 bg-muted rounded" />
    </div>
  );
}

function todayYmd() {
  return format(getCurrentTimeInTimezone('Asia/Kolkata'), "yyyy-MM-dd");
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = getCurrentTimeInTimezone('Asia/Kolkata');
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [dailyRows, setDailyRows] = useState<DailyRow[]>([]);
  const [dailyLoading, setDailyLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date>(() => getCurrentTimeInTimezone('Asia/Kolkata'));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [profilePhotos, setProfilePhotos] = useState<Record<string, string>>({});

  const supabase = createClient();
  const selectedDayStr = format(selectedDay, "yyyy-MM-dd");

  useEffect(() => {
    fetchLeaderboard();
  }, [selectedMonth]);

  useEffect(() => {
    fetchDailyLeaderboard();
  }, [selectedDay]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: userData } = await supabase
      .from("users")
      .select("organization_id, timezone")
      .eq("id", user.id)
      .single();

    if (userData?.timezone) {
      const zonedNow = getCurrentTimeInTimezone(userData.timezone);
      setSelectedMonth(prev => prev === format(getCurrentTimeInTimezone('Asia/Kolkata'), "yyyy-MM") ? format(zonedNow, "yyyy-MM") : prev);
      setSelectedDay(prev => {
        const istInitial = format(getCurrentTimeInTimezone('Asia/Kolkata'), "yyyy-MM-dd");
        return format(prev, "yyyy-MM-dd") === istInitial ? zonedNow : prev;
      });
    }

    const firstDay = `${selectedMonth}-01`;
    const { data, error } = await supabase
      .from("leaderboard")
      .select("*, users!user_id(*)")
      .eq("organization_id", userData?.organization_id)
      .eq("month", firstDay)
      .order("rank", { ascending: true });

    if (error) {
      console.error("[Leaderboard] monthly fetch:", error);
      setLeaderboard([]);
    } else {
      const entries = (data as any) || [];
      setLeaderboard(entries);

      const userIds = entries.map((e: any) => e.user_id);
      if (userIds.length > 0) {
        const { data: photos } = await supabase
          .from('employee_documents')
          .select('user_id, file_url')
          .in('user_id', userIds)
          .eq('doc_type', 'photo');
        
        const photoMap: Record<string, string> = {};
        photos?.forEach(p => {
          photoMap[p.user_id] = p.file_url;
        });
        setProfilePhotos(prev => ({ ...prev, ...photoMap }));
      }
    }
    setLoading(false);
  };

  const fetchDailyLeaderboard = async () => {
    setDailyLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setDailyLoading(false);
      return;
    }

    const { data: userData } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    const orgId = userData?.organization_id;
    if (!orgId) {
      setDailyRows([]);
      setDailyLoading(false);
      return;
    }

    const dayStr = format(selectedDay, "yyyy-MM-dd");
    const { data: usersData } = await supabase
      .from("users")
      .select("*")
      .eq("organization_id", orgId)
      .neq("role", "admin")
      .order("full_name", { ascending: true });

    const { data: ratingsData } = await supabase
      .from("leaderboard_daily")
      .select("*")
      .eq("organization_id", orgId)
      .eq("rating_date", dayStr);

    const byUser: Record<string, LeaderboardDaily> = {};
    for (const row of ratingsData || []) {
      byUser[row.user_id] = row as LeaderboardDaily;
    }

    const users = (usersData || []) as User[];
    setDailyRows(users.map((u) => ({ user: u, rating: byUser[u.id] ?? null })));
    setDailyLoading(false);
  };

  const displayMonth = (() => {
    try {
      return format(new Date(`${selectedMonth}-01`), "MMMM yyyy");
    } catch {
      return selectedMonth;
    }
  })();

  const topEntry = leaderboard.find((e) => e.rank === 1);
  const secondEntry = leaderboard.find((e) => e.rank === 2);
  const thirdEntry = leaderboard.find((e) => e.rank === 3);
  const rest = leaderboard.filter((e) => e.rank > 3);

  const currentHour = getCurrentTimeInTimezone('Asia/Kolkata').getHours();

  return (
    <div className="relative min-h-screen pb-20">
      <DashboardSkyBg currentHour={currentHour} />
      
      <div className="relative z-10 p-4 md:p-8 max-w-5xl mx-auto">
        <div className="mb-10 text-center pt-12">
          <div className="inline-flex items-center justify-center p-3 mb-4 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 shadow-xl">
             <Trophy className="h-10 w-10 text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 drop-shadow-sm mb-3">
            Hall of Fame
          </h1>
          <p className="text-slate-600 font-medium max-w-lg mx-auto">
            Celebrating excellence and commitment. Our top performers for the month.
          </p>
        </div>

        <Tabs defaultValue="monthly" className="space-y-8">
          <div className="flex justify-center">
            <TabsList className="bg-white/40 backdrop-blur-md p-1.5 rounded-2xl border border-white/60 shadow-lg">
              <TabsTrigger value="monthly" className="rounded-xl px-8 py-2.5 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all font-bold">Monthly Honors</TabsTrigger>
              <TabsTrigger value="daily" className="rounded-xl px-8 py-2.5 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all font-bold">Daily Pulse</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="monthly" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white/40 backdrop-blur-md p-4 rounded-3xl border border-white/60 shadow-sm">
              <div className="flex items-center gap-3 px-2">
                 <CalendarIcon className="h-5 w-5 text-blue-500" />
                 <p className="text-slate-700 font-bold">Rankings for {displayMonth}</p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="month"
                  className="w-44 bg-white/80 rounded-xl border-slate-200 focus:ring-blue-500"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                />
              </div>
            </div>

            {loading ? (
              <div className="space-y-4">
                <div className="rounded-[2.5rem] bg-white/50 backdrop-blur-md border border-white/60 p-12 animate-pulse space-y-4">
                  <div className="h-6 bg-muted rounded w-1/4 mx-auto" />
                  <div className="h-10 bg-muted rounded w-1/2 mx-auto" />
                </div>
                {[1, 2, 3].map((i) => <SkeletonRow key={i} />)}
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="rounded-[2.5rem] bg-white/50 backdrop-blur-md border-2 border-dashed border-slate-200 p-16 text-center space-y-6">
                <Trophy className="h-20 w-20 text-slate-200 mx-auto" />
                <h3 className="text-2xl font-bold text-slate-400">Grand Reveal Pending</h3>
                <p className="text-slate-500 max-w-xs mx-auto mt-2">The Hall of Fame for {displayMonth} is still being curated. Stay tuned!</p>
              </div>
            ) : (
              <div className="space-y-12">
                {/* Podium */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end pt-12 px-4">
                  {/* 2nd */}
                  <div className="order-2 md:order-1 flex flex-col items-center group">
                    {secondEntry && (
                      <>
                        <div className="relative mb-4">
                          <div className="h-24 w-24 rounded-full border-4 border-slate-300 p-1 bg-white shadow-xl overflow-hidden transition-transform group-hover:scale-105">
                            <img src={profilePhotos[secondEntry.user_id] || `https://api.dicebear.com/7.x/notionists/svg?seed=${secondEntry.users.full_name}`} className="h-full w-full object-cover rounded-full" />
                          </div>
                          <div className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full bg-slate-300 flex items-center justify-center border-2 border-white shadow-md">
                            <Medal className="h-4 w-4 text-slate-600" />
                          </div>
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-slate-800 text-lg">{secondEntry.users.full_name.split(' ')[0]}</p>
                          <Badge variant="secondary" className="bg-slate-100 text-slate-600">Runner Up</Badge>
                          <div className="mt-4 h-32 w-28 bg-gradient-to-t from-slate-200/80 to-slate-100/40 backdrop-blur-sm rounded-t-2xl border-t border-x border-slate-300/50 flex flex-col items-center justify-center p-4">
                             <span className="text-3xl font-black text-slate-400 opacity-50">#2</span>
                             <span className="text-sm font-bold text-slate-600 mt-1">{secondEntry.score}/10</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  {/* 1st */}
                  <div className="order-1 md:order-2 flex flex-col items-center group mb-8 md:mb-0">
                    {topEntry && (
                      <>
                        <div className="relative mb-6">
                          <div className="absolute -top-10 left-1/2 -translate-x-1/2 animate-bounce z-20"><Crown className="h-12 w-12 text-yellow-500 fill-yellow-500" /></div>
                          <div className="h-36 w-36 rounded-full border-[6px] border-yellow-400 p-1.5 bg-white shadow-xl overflow-hidden transition-transform group-hover:scale-105">
                            <img src={profilePhotos[topEntry.user_id] || `https://api.dicebear.com/7.x/notionists/svg?seed=${topEntry.users.full_name}`} className="h-full w-full object-cover rounded-full" />
                          </div>
                          <div className="absolute -bottom-3 -right-3 h-12 w-12 rounded-full bg-yellow-400 flex items-center justify-center border-4 border-white shadow-lg">
                            <Trophy className="h-6 w-6 text-yellow-900" />
                          </div>
                        </div>
                        <div className="text-center">
                          <p className="font-black text-slate-900 text-2xl tracking-tight">{topEntry.users.full_name.split(' ')[0]}</p>
                          <Badge className="bg-yellow-400 text-yellow-900 hover:bg-yellow-400 border-none px-4 py-0.5 mt-1 font-bold uppercase tracking-tight">Performer of the Month</Badge>
                          <div className="mt-6 h-48 w-32 bg-gradient-to-t from-yellow-400/80 via-yellow-200/40 to-yellow-100/20 backdrop-blur-md rounded-t-[2.5rem] border-t border-x border-yellow-400/50 flex flex-col items-center justify-center p-4 shadow-lg">
                             <span className="text-5xl font-black text-yellow-600/50">#1</span>
                             <div className="mt-2 text-xl font-black text-yellow-900">{topEntry.score}/10</div>
                             {topEntry.notes && (
                               <Popover>
                                 <PopoverTrigger asChild>
                                   <Button variant="ghost" size="icon" className="mt-2 h-8 w-8 rounded-full bg-white/50 text-yellow-700"><Quote className="h-4 w-4" /></Button>
                                 </PopoverTrigger>
                                 <PopoverContent className="w-64 p-4 rounded-2xl bg-white/90 backdrop-blur-xl border-yellow-200 shadow-xl">
                                   <p className="text-sm italic text-slate-700 font-medium">"{topEntry.notes}"</p>
                                 </PopoverContent>
                               </Popover>
                             )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  {/* 3rd */}
                  <div className="order-3 md:order-3 flex flex-col items-center group">
                    {thirdEntry && (
                      <>
                        <div className="relative mb-4">
                          <div className="h-20 w-20 rounded-full border-4 border-amber-600/50 p-1 bg-white shadow-xl overflow-hidden transition-transform group-hover:scale-105">
                            <img src={profilePhotos[thirdEntry.user_id] || `https://api.dicebear.com/7.x/notionists/svg?seed=${thirdEntry.users.full_name}`} className="h-full w-full object-cover rounded-full" />
                          </div>
                          <div className="absolute -bottom-2 -right-2 h-7 w-7 rounded-full bg-amber-600 flex items-center justify-center border-2 border-white shadow-md">
                            <Award className="h-3.5 w-3.5 text-white" />
                          </div>
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-slate-800 text-lg">{thirdEntry.users.full_name.split(' ')[0]}</p>
                          <Badge variant="secondary" className="bg-amber-50 text-amber-700">Rising Star</Badge>
                          <div className="mt-4 h-24 w-24 bg-gradient-to-t from-amber-200/60 to-amber-50/20 backdrop-blur-sm rounded-t-2xl border-t border-x border-amber-300/40 flex flex-col items-center justify-center p-4">
                             <span className="text-2xl font-black text-amber-600/40">#3</span>
                             <span className="text-xs font-bold text-amber-800 mt-0.5">{thirdEntry.score}/10</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Others */}
                <div className="mt-12 space-y-4 px-4">
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest px-2 mb-4">Outstanding Contributions</h3>
                  <div className="grid gap-3">
                    {rest.map((entry) => (
                      <div key={entry.id} className="group flex items-center gap-4 rounded-3xl bg-white/60 backdrop-blur-md border border-white/80 p-4 shadow-sm hover:shadow-md transition-all">
                        <div className="flex-shrink-0 w-12 flex justify-center text-xl font-black text-slate-300 group-hover:text-slate-500 transition-colors">#{entry.rank}</div>
                        <div className="h-12 w-12 rounded-full overflow-hidden border-2 border-slate-100 flex-shrink-0">
                          <img src={profilePhotos[entry.user_id] || `https://api.dicebear.com/7.x/notionists/svg?seed=${entry.users.full_name}`} className="h-full w-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-800 truncate group-hover:text-blue-600 transition-colors">{entry.users.full_name}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[150px]">
                              <div className="h-full bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full" style={{ width: `${(entry.score / 10) * 100}%` }} />
                            </div>
                            <span className="text-xs font-bold text-slate-500">{entry.score}/10</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {entry.notes && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-slate-400 hover:bg-slate-100"><Quote className="h-4 w-4" /></Button>
                              </PopoverTrigger>
                              <PopoverContent align="end" className="w-64 p-4 rounded-2xl bg-white/90 backdrop-blur-xl border-slate-200 shadow-xl">
                                <p className="text-sm font-medium text-slate-700 italic">"{entry.notes}"</p>
                              </PopoverContent>
                            </Popover>
                          )}
                          <ChevronRight className="h-5 w-5 text-slate-300" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="daily" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white/40 backdrop-blur-md p-4 rounded-3xl border border-white/60 shadow-sm">
              <div className="px-2">
                <p className="text-slate-700 font-bold">Daily performance for {format(selectedDay, "PPP")}</p>
              </div>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-auto justify-start text-left font-normal bg-white/80 rounded-xl">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(selectedDay, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar mode="single" selected={selectedDay} onSelect={(d) => { if (d) { setSelectedDay(d); setCalendarOpen(false); } }} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            {dailyLoading ? (
              <div className="rounded-[2.5rem] bg-white/50 backdrop-blur-md border p-12 text-center text-slate-500 animate-pulse">Syncing daily records…</div>
            ) : dailyRows.length === 0 ? (
              <div className="rounded-[2.5rem] bg-white/50 backdrop-blur-md border border-dashed border-slate-300 p-16 text-center text-slate-400">No daily records found.</div>
            ) : (
              <div className="grid gap-3">
                {dailyRows.map(({ user, rating }) => (
                  <div key={user.id} className="group flex items-center gap-4 rounded-3xl bg-white/60 backdrop-blur-md border border-white/80 p-4 shadow-sm hover:shadow-md transition-all">
                    <div className="h-10 w-10 rounded-full overflow-hidden border-2 border-slate-100 flex-shrink-0 bg-slate-50 flex items-center justify-center">
                      {profilePhotos[user.id] ? <img src={profilePhotos[user.id]} className="h-full w-full object-cover" /> : <span className="text-xs font-bold text-slate-400">{user.full_name.charAt(0)}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                       <p className="font-bold text-slate-800">{user.full_name}</p>
                       <p className="text-xs text-slate-500 truncate">{rating?.comments || "Consistent performance."}</p>
                    </div>
                    <div className="flex-shrink-0">
                      {rating ? (
                        <Badge className={cn(
                          "px-3 py-1 font-bold rounded-full",
                          rating.performance === 'excellent' && "bg-emerald-100 text-emerald-700 border-emerald-200",
                          rating.performance === 'very_good' && "bg-blue-100 text-blue-700 border-blue-200",
                          rating.performance === 'good' && "bg-sky-100 text-sky-700 border-sky-200",
                          rating.performance === 'average' && "bg-slate-100 text-slate-700 border-slate-200",
                          (rating.performance === 'poor' || rating.performance === 'very_poor') && "bg-red-100 text-red-700 border-red-200"
                        )}>{dailyPerformanceLabel(rating.performance)}</Badge>
                      ) : <Badge variant="outline" className="text-slate-300 border-slate-200">Pending</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
