import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckSquare, Clock, Flame, Sparkles, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

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

  const today = format(new Date(), 'yyyy-MM-dd');

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
  const currentHour = new Date().getHours();
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

  return (
    <div className="option-surface space-y-6 p-6 md:p-8">
      <section className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-[hsl(var(--hero-from))] to-[hsl(var(--hero-to))] p-8 text-white shadow-xl">
          <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-20 right-20 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <p className="text-sm font-semibold text-white/80">{greeting}, {userData?.full_name || "Hero"}!</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight">Ready to crush another day?</h2>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                <p className="text-xs font-bold uppercase tracking-wider text-white/70">Current Rank</p>
                <p className="mt-1 text-2xl font-extrabold">Focus Master</p>
                <p className="text-sm text-white/80">Level 4</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4 text-center backdrop-blur">
                <Flame className="mx-auto h-4 w-4 text-orange-300" />
                <p className="mt-1 text-xl font-extrabold">5</p>
                <p className="text-xs text-white/75">Day Streak</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4 text-center backdrop-blur">
                <TrendingUp className="mx-auto h-4 w-4 text-cyan-200" />
                <p className="mt-1 text-xl font-extrabold">{totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}%</p>
                <p className="text-xs text-white/75">Completion</p>
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-semibold text-white/80">XP Progress to Level 5</span>
                <span className="font-semibold">850 / 1000 XP</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white/20">
                <div className="h-full w-[85%] animate-pulse-glow rounded-full bg-gradient-to-r from-sky-300 via-indigo-300 to-fuchsia-300" />
              </div>
            </div>
          </div>
        </div>

        <Card className="option-panel rounded-3xl border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl tracking-tight">Attendance</CardTitle>
            <CardDescription>{attendance?.clock_in_time ? "Clocked In" : "Not Clocked In"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="option-soft-card rounded-2xl bg-slate-50 p-4 text-center">
              <p className="text-3xl font-black tracking-tight">{Math.max(totalTasks - completedTasks, 0)} / {totalTasks}</p>
              <p className="mt-1 text-sm text-muted-foreground">Essential tasks remaining today</p>
            </div>
            <a
              href={`/org/${orgSlug}/attendance`}
              className="option-cta block rounded-2xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-800"
            >
              {attendance?.clock_in_time ? "Manage Attendance" : "Clock In to Start"}
            </a>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Daily Quests</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="option-quest-card rounded-2xl border-emerald-200 bg-emerald-50/70">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-emerald-900">Approve 5 documents</p>
                <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-emerald-600">+50 XP</span>
              </div>
              <p className="mt-4 text-xs font-bold uppercase tracking-wider text-emerald-700/80">Pending</p>
            </CardContent>
          </Card>
          <Card className="option-quest-card rounded-2xl border-blue-200 bg-blue-50/70">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-blue-900">Clock in before 9 AM</p>
                <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-blue-600">+20 XP</span>
              </div>
              <p className="mt-4 text-xs font-bold uppercase tracking-wider text-blue-700/80">Pending</p>
            </CardContent>
          </Card>
          <Card className="option-quest-card rounded-2xl border-fuchsia-200 bg-fuchsia-50/70">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-fuchsia-900">Zero mistakes today</p>
                <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-fuchsia-600">+100 XP</span>
              </div>
              <p className="mt-4 text-xs font-bold uppercase tracking-wider text-fuchsia-700/80">Pending</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Tasks Today
            </CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {completedTasks} / {totalTasks}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}% completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Attendance Status
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {attendance?.clock_in_time ? 'Clocked In' : 'Not Clocked In'}
            </div>
            <p className="text-xs text-muted-foreground">
              {attendance?.clock_in_time 
                ? `Since ${format(new Date(attendance.clock_in_time), 'h:mm a')}`
                : 'Clock in to start your day'
              }
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Verifications
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pendingVerifications?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Awaiting manager approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              This Month
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              --
            </div>
            <p className="text-xs text-muted-foreground">
              Performance score
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
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
                    <div key={task.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`h-2 w-2 rounded-full ${
                          log?.status === 'completed' ? 'bg-green-500' : 'bg-gray-300'
                        }`} />
                        <div>
                          <p className="font-medium">{task.title}</p>
                          <p className="text-sm text-muted-foreground">{task.type}</p>
                        </div>
                      </div>
                      {log && (
                        <span className={`text-xs px-2 py-1 rounded ${
                          log.verification_status === 'approved' 
                            ? 'bg-green-100 text-green-800'
                            : log.verification_status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : log.verification_status === 'recalled'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {log.verification_status}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No tasks for today</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common actions you might need
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <a
              href={`/org/${orgSlug}/attendance`}
              className="block p-3 rounded-lg border hover:bg-accent transition-colors"
            >
              <p className="font-medium">Clock In/Out</p>
              <p className="text-sm text-muted-foreground">
                Manage your attendance
              </p>
            </a>
            <a
              href={`/org/${orgSlug}/tasks`}
              className="block p-3 rounded-lg border hover:bg-accent transition-colors"
            >
              <p className="font-medium">Submit Tasks</p>
              <p className="text-sm text-muted-foreground">
                Mark tasks as complete
              </p>
            </a>
            <a
              href={`/org/${orgSlug}/leaves`}
              className="block p-3 rounded-lg border hover:bg-accent transition-colors"
            >
              <p className="font-medium">Request Leave</p>
              <p className="text-sm text-muted-foreground">
                Submit a leave request
              </p>
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
