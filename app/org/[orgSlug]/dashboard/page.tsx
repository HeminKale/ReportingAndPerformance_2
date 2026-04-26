import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckSquare, Clock, Flame, Sparkles, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { getCurrentTimeInTimezone } from '@/lib/utils/timezone';
import { rankForTotalXp, RANK_TIERS } from '@/lib/gamification/xp-rules';
import { DashboardSkyBg } from '@/components/dashboard/dashboard-sky-bg';

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return null;
  }

  const { data: userData } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  const userTimezone = userData?.timezone || 'Asia/Kolkata';
  const nowUserTime = getCurrentTimeInTimezone(userTimezone);
  const today = format(nowUserTime, 'yyyy-MM-dd');

  const { data: todayTasks } = await supabase
    .from('tasks')
    .select(`
      *,
      task_logs!left(*)
    `)
    .eq('organization_id', userData?.organization_id)
    .or(`assigned_to.eq.${user.id},is_common_task.eq.true`)
    .eq('is_active', true);

  const { data: attendance } = await supabase
    .from('attendance')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', today)
    .single();

  const { data: taskLogs } = await supabase
    .from('task_logs')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', today);

  const completedTasks = taskLogs?.filter(log => log.status === 'completed').length || 0;
  const totalTasks = todayTasks?.length || 0;
  const currentHour = nowUserTime.getHours();
  const greeting =
    currentHour >= 5 && currentHour < 12
      ? "Good morning"
      : currentHour >= 12 && currentHour < 17
      ? "Good afternoon"
      : currentHour >= 17 && currentHour < 21
      ? "Good evening"
      : "Good night";

  const { data: pendingVerifications } = await supabase
    .from('task_logs')
    .select('*')
    .eq('user_id', user.id)
    .eq('verification_status', 'pending');

  const { data: gamification } = await supabase
    .from('user_gamification')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  const totalXp = gamification?.total_xp ?? 0;
  const { rankName, nextTier } = rankForTotalXp(totalXp);
  const streakDays = gamification?.current_streak ?? 0;
  const longestStreak = gamification?.longest_streak ?? 0;
  const earnedBadges = Array.isArray(gamification?.earned_badges) ? gamification!.earned_badges : [];
  const recentBadges = earnedBadges.slice(-3).reverse();
  const nextGoalXp = nextTier?.minXp ?? RANK_TIERS[RANK_TIERS.length - 1]!.minXp;
  const xpProgressPct =
    nextTier && nextGoalXp > 0 ? Math.min(100, Math.round((totalXp / nextGoalXp) * 100)) : 100;

  return (
    <div className="relative min-h-full pb-12">
      <DashboardSkyBg currentHour={currentHour} />
      
      <div className="mx-auto flex w-full max-w-[1600px] flex-col md:flex-row relative z-10">
        {/* Left Column (Standing Rectangle) */}
        <div className="w-full md:w-[40%] px-4 md:pl-8 md:pr-4 pt-[25vh]">
          <div className="sticky top-[2vh] flex flex-col rounded-t-[2.5rem] rounded-b-[1rem] bg-white/80 backdrop-blur-xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.08)] p-8 pt-16 min-h-[calc(75vh-2rem)]">
            
            {/* Circular Placeholder */}
            <div className="absolute top-0 left-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border-[6px] border-white/90 bg-slate-100 shadow-xl backdrop-blur-sm">
              <img 
                src={`https://api.dicebear.com/7.x/notionists/svg?seed=${userData?.full_name || 'Hero'}&backgroundColor=e2e8f0`} 
                alt="Profile" 
                className="h-full w-full object-cover"
              />
            </div>

            {/* Greeting & Profile Info */}
            <div className="text-center mb-8">
              <p className="text-sm font-bold uppercase tracking-wider text-slate-500/80">{greeting}</p>
              <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-900 bg-gradient-to-br from-slate-900 to-slate-600 bg-clip-text text-transparent">{userData?.full_name || "Hero"}</h2>
              <p className="text-sm text-slate-600 mt-2 font-medium">Ready to crush another day?</p>
            </div>

            {/* Gamification Stats inside Card */}
            <div className="grid gap-3 sm:grid-cols-2 mb-6">
              <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 p-4 border border-blue-100/50 text-center shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-600/80">Rank</p>
                <p className="mt-1 text-xl font-extrabold text-blue-950">{rankName}</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 p-4 border border-orange-100/50 text-center shadow-sm">
                <Flame className="mx-auto h-4 w-4 text-orange-500 mb-1" />
                <p className="text-xl font-extrabold text-orange-950">{streakDays}</p>
                <p className="text-[10px] uppercase font-bold text-orange-700/70">Day Streak</p>
              </div>
            </div>

            {/* XP Progress */}
            <div className="mb-6 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
              <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-600 uppercase tracking-wider">
                <span>Progress to {nextTier?.rankName || 'Max'}</span>
                <span className="text-blue-600">{totalXp} / {nextTier ? nextGoalXp : totalXp} XP</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-200/50 shadow-inner">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 shadow-sm"
                  style={{ width: `${xpProgressPct}%` }}
                />
              </div>
            </div>

            {/* Badges */}
            {recentBadges.length > 0 ? (
              <div className="mt-auto pt-4 border-t border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3 text-center">Recent Achievements</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {recentBadges.map((b: { id: string; badgeName: string }) => (
                    <span
                      key={b.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/50 bg-amber-50/80 px-3 py-1.5 text-xs font-semibold text-amber-900 shadow-sm"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                      {b.badgeName}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

          </div>
        </div>

        {/* Right Column (Rest of Content) */}
        <div className="w-full md:w-[60%] px-4 md:pl-4 md:pr-8 pt-[32vh] space-y-8">
           {/* Attendance Row */}
           <section className="grid gap-6 xl:grid-cols-2">
              <Card className="option-panel rounded-3xl border-white/40 shadow-xl bg-white/60 backdrop-blur-md">
                <CardHeader>
                  <CardTitle className="text-xl tracking-tight">Attendance</CardTitle>
                  <CardDescription>{attendance?.clock_in_time ? "Clocked In" : "Not Clocked In"}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="option-soft-card rounded-2xl bg-white p-4 text-center shadow-sm">
                    <p className="text-3xl font-black tracking-tight text-slate-800">{Math.max(totalTasks - completedTasks, 0)} / {totalTasks}</p>
                    <p className="mt-1 text-sm text-slate-500 font-medium">Essential tasks remaining today</p>
                  </div>
                  <a
                    href={`/org/${orgSlug}/attendance`}
                    className="option-cta block rounded-2xl bg-slate-900 px-4 py-3 text-center text-sm font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:bg-slate-800"
                  >
                    {attendance?.clock_in_time ? "Manage Attendance" : "Clock In to Start"}
                  </a>
                </CardContent>
              </Card>
              
              <div className="grid grid-rows-2 gap-4">
                <Card className="rounded-2xl border-white/40 bg-white/60 backdrop-blur-md shadow-lg transition-transform hover:-translate-y-1">
                  <CardContent className="flex h-full items-center justify-between p-5">
                    <div>
                      <p className="text-sm font-bold uppercase tracking-wider text-slate-500">Tasks Today</p>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-slate-800">{completedTasks}</span>
                        <span className="text-sm font-medium text-slate-500">/ {totalTasks} done</span>
                      </div>
                    </div>
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100/80 shadow-inner">
                      <CheckSquare className="h-6 w-6 text-blue-600" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="rounded-2xl border-white/40 bg-white/60 backdrop-blur-md shadow-lg transition-transform hover:-translate-y-1">
                  <CardContent className="flex h-full items-center justify-between p-5">
                    <div>
                      <p className="text-sm font-bold uppercase tracking-wider text-slate-500">Approvals</p>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-slate-800">{pendingVerifications?.length || 0}</span>
                        <span className="text-sm font-medium text-slate-500">pending</span>
                      </div>
                    </div>
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100/80 shadow-inner">
                      <AlertCircle className="h-6 w-6 text-amber-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>
           </section>

           {/* Daily Quests */}
           <section className="space-y-4 relative z-10">
              <div className="flex items-center gap-2 px-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">Daily Quests</h3>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="option-quest-card rounded-2xl border-emerald-200/50 bg-emerald-50/80 backdrop-blur-sm shadow-md">
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <p className="font-semibold text-emerald-900">Approve 5 documents</p>
                        <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-emerald-600 shadow-sm">+50 XP</span>
                      </div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700/60 mt-2">Pending</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="option-quest-card rounded-2xl border-blue-200/50 bg-blue-50/80 backdrop-blur-sm shadow-md">
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <p className="font-semibold text-blue-900">Clock in before 9 AM</p>
                        <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-blue-600 shadow-sm">+20 XP</span>
                      </div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700/60 mt-2">Pending</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="option-quest-card rounded-2xl border-fuchsia-200/50 bg-fuchsia-50/80 backdrop-blur-sm shadow-md">
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <p className="font-semibold text-fuchsia-900">Zero mistakes today</p>
                        <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-fuchsia-600 shadow-sm">+100 XP</span>
                      </div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-fuchsia-700/60 mt-2">Pending</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* Tasks List and Quick Actions */}
            <div className="grid gap-6 md:grid-cols-2 pb-12">
              <Card className="rounded-3xl border-white/40 shadow-xl bg-white/70 backdrop-blur-md">
                <CardHeader>
                  <CardTitle>Today's Tasks</CardTitle>
                  <CardDescription>
                    Your tasks for {format(new Date(), 'MMMM d, yyyy')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {todayTasks && todayTasks.length > 0 ? (
                    <div className="space-y-4">
                      {todayTasks.slice(0, 5).map((task) => {
                        const log = taskLogs?.find(l => l.task_id === task.id);
                        return (
                          <div key={task.id} className="flex items-center justify-between rounded-xl bg-white/50 p-3 shadow-sm border border-slate-100">
                            <div className="flex items-center gap-3">
                              <div className={`h-2.5 w-2.5 rounded-full ${
                                log?.status === 'completed' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-300'
                              }`} />
                              <div>
                                <p className="font-semibold text-slate-800">{task.title}</p>
                                <p className="text-xs font-medium text-slate-500 capitalize">{task.type}</p>
                              </div>
                            </div>
                            {log && (
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
                                log.verification_status === 'approved' 
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : log.verification_status === 'rejected'
                                  ? 'bg-red-100 text-red-800'
                                  : log.verification_status === 'recalled'
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-blue-100 text-blue-800'
                              }`}>
                                {log.verification_status}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
                      <p className="text-sm font-medium text-slate-500">No tasks for today</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-white/40 shadow-xl bg-white/70 backdrop-blur-md">
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                  <CardDescription>
                    Common actions you might need
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <a
                    href={`/org/${orgSlug}/attendance`}
                    className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
                  >
                    <div>
                      <p className="font-semibold text-slate-800">Clock In/Out</p>
                      <p className="text-xs font-medium text-slate-500">Manage your attendance</p>
                    </div>
                    <Clock className="h-5 w-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                  </a>
                  <a
                    href={`/org/${orgSlug}/tasks`}
                    className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
                  >
                    <div>
                      <p className="font-semibold text-slate-800">Submit Tasks</p>
                      <p className="text-xs font-medium text-slate-500">Mark tasks as complete</p>
                    </div>
                    <CheckSquare className="h-5 w-5 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                  </a>
                  <a
                    href={`/org/${orgSlug}/leaves`}
                    className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
                  >
                    <div>
                      <p className="font-semibold text-slate-800">Request Leave</p>
                      <p className="text-xs font-medium text-slate-500">Submit a leave request</p>
                    </div>
                    <TrendingUp className="h-5 w-5 text-slate-400 group-hover:text-fuchsia-500 transition-colors" />
                  </a>
                </CardContent>
              </Card>
            </div>
        </div>
      </div>
    </div>
  );
}
