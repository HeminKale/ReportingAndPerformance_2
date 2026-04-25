import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckSquare, Clock, AlertCircle, TrendingUp } from 'lucide-react';
import { format, eachDayOfInterval, subDays } from 'date-fns';
import { GamifiedPageHeader } from '@/components/gamification/gamified-page-header';
import { BentoStatsRow } from '@/components/gamification/bento-stats-row';
import { CompletionTrendsChart } from '@/components/gamification/completion-trends-chart';
import { MotivationWidget } from '@/components/gamification/motivation-widget';
import { computeApprovedTaskStreak } from '@/lib/gamification/streak';
import { productivityScoreFromRating } from '@/lib/gamification/xp';
import { getCurrentTimeInTimezone } from '@/lib/utils/timezone';
import Link from 'next/link';
import type { DailyPerformanceRating } from '@/lib/types/database';

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

  const tz = userData?.timezone || 'UTC';
  const localNow = getCurrentTimeInTimezone(tz);
  const hour = localNow.getHours();
  const firstName = userData?.full_name?.split(/\s+/)[0] || 'there';

  const today = format(localNow, 'yyyy-MM-dd');
  const monthStart = `${format(localNow, 'yyyy-MM')}-01`;

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

  const { data: pendingVerifications } = await supabase
    .from('task_logs')
    .select('*')
    .eq('user_id', user.id)
    .eq('verification_status', 'pending');

  const { data: lbRow } = await supabase
    .from('leaderboard')
    .select('score')
    .eq('user_id', user.id)
    .eq('organization_id', userData?.organization_id as string)
    .eq('month', monthStart)
    .maybeSingle();

  const totalXp = lbRow?.score ?? 0;

  const { data: dailyRating } = await supabase
    .from('leaderboard_daily')
    .select('performance')
    .eq('user_id', user.id)
    .eq('rating_date', today)
    .maybeSingle();

  const perf = dailyRating?.performance as DailyPerformanceRating | undefined;
  const { score: productivityScore, label: productivityLabel } = productivityScoreFromRating(perf ?? null);

  const streakSince = format(subDays(localNow, 120), 'yyyy-MM-dd');
  const { data: streakLogs } = await supabase
    .from('task_logs')
    .select('date')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .eq('verification_status', 'approved')
    .gte('date', streakSince);

  const approvedDates = [...new Set((streakLogs || []).map((r) => r.date))];
  const streak = computeApprovedTaskStreak(approvedDates, localNow);

  const weekStart = format(subDays(localNow, 6), 'yyyy-MM-dd');
  const { data: weekLogs } = await supabase
    .from('task_logs')
    .select('date')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .eq('verification_status', 'approved')
    .gte('date', weekStart)
    .lte('date', today);

  const countsByDate: Record<string, number> = {};
  for (const row of weekLogs || []) {
    countsByDate[row.date] = (countsByDate[row.date] || 0) + 1;
  }
  const weekDays = eachDayOfInterval({ start: subDays(localNow, 6), end: localNow });
  const trendData = weekDays.map((d) => {
    const key = format(d, 'yyyy-MM-dd');
    return { label: format(d, 'EEE'), count: countsByDate[key] || 0 };
  });

  const pendingToday = Math.max(0, totalTasks - completedTasks);
  const motivationHeadline =
    pendingToday > 0
      ? `${pendingToday} task${pendingToday === 1 ? '' : 's'} left today`
      : totalTasks > 0
        ? 'All tasks logged for today'
        : 'No tasks assigned today';
  const motivationSub =
    pendingToday > 0
      ? 'Finish strong and keep your streak shining.'
      : 'Great rhythm — check back tomorrow for new wins.';

  return (
    <div className="min-h-full bg-slate-50 p-6 md:p-8">
      <GamifiedPageHeader
        firstName={firstName}
        totalXp={totalXp}
        title="Dashboard"
        subtitle="Your performance at a glance — tasks, attendance, and momentum."
        hour={hour}
      />

      <BentoStatsRow
        className="mb-8"
        streak={streak}
        tasksCompletedToday={completedTasks}
        productivityScore={productivityScore}
        productivityLabel={productivityLabel}
      />

      <div className="mb-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 grid gap-6 sm:grid-cols-2">
          <Card className="overflow-hidden rounded-2xl border-slate-200 shadow-sm">
            <div className="h-1 bg-gradient-to-r from-indigo-500 to-violet-500" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-slate-600">Tasks today</CardTitle>
              <CheckSquare className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black tracking-tight text-slate-900">
                {completedTasks} <span className="text-xl font-bold text-slate-400">/</span> {totalTasks}
              </div>
              <p className="mt-1 text-xs font-medium text-slate-500">
                {totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}% complete
              </p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-2xl border-slate-200 shadow-sm">
            <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-slate-600">Attendance</CardTitle>
              <Clock className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black tracking-tight text-slate-900">
                {attendance?.clock_in_time ? 'In' : 'Out'}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {attendance?.clock_in_time 
                  ? `Since ${format(new Date(attendance.clock_in_time), 'h:mm a')}`
                  : 'Clock in to start your day'
                }
              </p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-2xl border-slate-200 shadow-sm">
            <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-slate-600">Pending review</CardTitle>
              <AlertCircle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-slate-900">
                {pendingVerifications?.length || 0}
              </div>
              <p className="mt-1 text-xs text-slate-500">Awaiting manager approval</p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-2xl border-slate-200 shadow-sm">
            <div className="h-1 bg-gradient-to-r from-violet-500 to-purple-600" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-slate-600">This month</CardTitle>
              <TrendingUp className="h-4 w-4 text-violet-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-indigo-600 tabular-nums">
                {totalXp.toLocaleString()}
              </div>
              <p className="mt-1 text-xs text-slate-500">Leaderboard score (XP)</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Completion trends</CardTitle>
              <CardDescription>Approved tasks per day (last 7 days)</CardDescription>
            </CardHeader>
            <CardContent>
              <CompletionTrendsChart data={trendData} />
            </CardContent>
          </Card>
          <MotivationWidget headline={motivationHeadline} subtext={motivationSub} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Today&apos;s tasks</CardTitle>
            <CardDescription>
              {format(localNow, 'MMMM d, yyyy')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {todayTasks && todayTasks.length > 0 ? (
              <div className="space-y-3">
                {todayTasks.slice(0, 5).map((task) => {
                  const log = taskLogs?.find(l => l.task_id === task.id);
                  return (
                    <div
                      key={task.id}
                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                          log?.status === 'completed' ? 'bg-emerald-500' : 'bg-slate-300'
                        }`} />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{task.title}</p>
                          <p className="text-xs font-medium capitalize text-slate-500">{task.type}</p>
                        </div>
                      </div>
                      {log && (
                        <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${
                          log.verification_status === 'approved' 
                            ? 'bg-emerald-100 text-emerald-800'
                            : log.verification_status === 'rejected'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-900'
                        }`}>
                          {log.verification_status}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No tasks for today</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Quick actions</CardTitle>
            <CardDescription>Jump to common workflows</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link
              href={`/org/${orgSlug}/attendance`}
              className="block rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-indigo-200 hover:shadow-md"
            >
              <p className="font-bold text-slate-900">Clock in / out</p>
              <p className="text-sm text-slate-500">Manage attendance</p>
            </Link>
            <Link
              href={`/org/${orgSlug}/tasks`}
              className="block rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-indigo-200 hover:shadow-md"
            >
              <p className="font-bold text-slate-900">Submit tasks</p>
              <p className="text-sm text-slate-500">Log daily, weekly, and monthly work</p>
            </Link>
            <Link
              href={`/org/${orgSlug}/leaves`}
              className="block rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-indigo-200 hover:shadow-md"
            >
              <p className="font-bold text-slate-900">Request leave</p>
              <p className="text-sm text-slate-500">Vacation, sick, or personal time</p>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
