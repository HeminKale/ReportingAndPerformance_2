import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckSquare, Clock, Flame, Sparkles, TrendingUp, ChevronDown, CheckCircle2, CircleDashed, Crown } from 'lucide-react';
import { format } from 'date-fns';
import { getCurrentTimeInTimezone } from '@/lib/utils/timezone';
import { rankForTotalXp, RANK_TIERS } from '@/lib/gamification/xp-rules';
import { DashboardSkyBg } from '@/components/dashboard/dashboard-sky-bg';
import { ScrollableCardList } from '@/components/dashboard/scrollable-card-list';
import { XpProgressBar } from '@/components/dashboard/xp-progress-bar';
import { TaskListItem } from '@/components/dashboard/task-list-item';
import { MonthlyCelebration } from '@/components/dashboard/monthly-celebration';

const morningMessages = [
  "Let's make today incredibly productive.",
  "Every small step counts towards your big goals.",
  "Believe you can and you're halfway there.",
  "Focus on being productive instead of busy.",
  "The secret of getting ahead is getting started."
];

const afternoonMessages = [
  "You're making great progress.",
  "Small daily improvements are the key to staggering long-term results.",
  "Stay focused, stay positive, stay strong.",
  "The day is what you make it! So why not make it a great one?",
  "Keep up the hard work, it will pay off."
];

const clockOutMessages = [
  "Great job today! Rest up and recharge.",
  "You've earned some well-deserved rest.",
  "Leave work at work. Enjoy your evening!",
  "A productive day ends with a peaceful evening.",
  "Tomorrow is another day, but tonight is yours."
];

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;

  const { data: userData } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  const userTimezone = userData?.timezone || 'Asia/Kolkata';
  const nowUserTime = getCurrentTimeInTimezone(userTimezone);
  const today = format(nowUserTime, 'yyyy-MM-dd');

  // Fetch tasks
  const { data: todayTasks } = await supabase
    .from('tasks')
    .select(`*, task_logs!left(*)`)
    .eq('organization_id', userData?.organization_id)
    .or(`assigned_to.eq.${user.id},is_common_task.eq.true`)
    .eq('is_active', true);

  // Fetch attendance
  const { data: attendance } = await supabase
    .from('attendance')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', today)
    .single();

  // Fetch task logs
  const { data: taskLogs } = await supabase
    .from('task_logs')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', today);

  // Fetch trainings
  const { data: trainings } = await supabase
    .from('trainings')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .order('date_completed', { ascending: false });

  // Fetch real profile photo from employee_documents
  const { data: profileDoc } = await supabase
    .from('employee_documents')
    .select('file_url')
    .eq('user_id', user.id)
    .eq('doc_type', 'photo')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Fetch top performer status from leaderboard
  // Get the most recent month's ranking
  const { data: leaderboardEntry } = await supabase
    .from('leaderboard')
    .select('rank, month')
    .eq('user_id', user.id)
    .order('month', { ascending: false })
    .limit(1)
    .maybeSingle();

  const isTopPerformer = leaderboardEntry?.rank === 1;
  const latestRankingMonth = leaderboardEntry?.month || '';

  // Fetch Gamification
  const { data: gamification } = await supabase
    .from('user_gamification')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  // Computations
  const completedTasks = taskLogs?.filter(log => log.status === 'completed').length || 0;
  const totalTasks = todayTasks?.length || 0;
  const completionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
  const currentHour = nowUserTime.getHours();
  
  // Seed for random messages
  const dateSeed = today.split('-').reduce((acc, part) => acc + parseInt(part, 10), 0);
  
  let greetingTime = "Good morning";
  let inspiringMessage = "";
  
  if (attendance?.clock_out_time) {
    greetingTime = currentHour < 17 ? "Good afternoon" : "Good evening";
    inspiringMessage = clockOutMessages[dateSeed % clockOutMessages.length];
  } else if (currentHour >= 5 && currentHour < 12) {
    greetingTime = "Good morning";
    inspiringMessage = "Ready to crush another day? " + morningMessages[dateSeed % morningMessages.length];
  } else if (currentHour >= 12 && currentHour < 17) {
    greetingTime = "Good afternoon";
    inspiringMessage = "Keep going, you are doing awesome. " + afternoonMessages[dateSeed % afternoonMessages.length];
  } else {
    greetingTime = currentHour >= 17 && currentHour < 21 ? "Good evening" : "Good night";
    inspiringMessage = "You've worked hard. " + clockOutMessages[(dateSeed + 1) % clockOutMessages.length];
  }

  const totalXp = gamification?.total_xp ?? 0;
  const { rankName, nextTier } = rankForTotalXp(totalXp);
  const currentRankBadge = RANK_TIERS.find(t => t.rankName === rankName)?.badgeName || "🌱 Starter";
  const streakDays = gamification?.current_streak ?? 0;
  const longestStreak = gamification?.longest_streak ?? 0;
  
  const earnedRankTiers = RANK_TIERS.filter(t => totalXp >= t.minXp);
  const nextGoalXp = nextTier?.minXp ?? RANK_TIERS[RANK_TIERS.length - 1]!.minXp;
  const xpProgressPct = nextTier && nextGoalXp > 0 ? Math.min(100, Math.round((totalXp / nextGoalXp) * 100)) : 100;

  const displayTasks = todayTasks || [];
  const profilePhotoUrl = profileDoc?.file_url || `https://api.dicebear.com/7.x/notionists/svg?seed=${userData?.full_name || 'Hero'}&backgroundColor=e2e8f0`;

  return (
    <div className="relative min-h-full pb-12">
      <MonthlyCelebration isTopPerformer={isTopPerformer} month={latestRankingMonth} />
      <DashboardSkyBg currentHour={currentHour} />
      
      <div className="mx-auto flex w-full max-w-[1600px] flex-col md:flex-row relative z-10 gap-8">
        {/* Left Column */}
        <div className="w-full md:w-[40%] px-4 md:pl-8 md:pr-4 pt-[25vh] flex flex-col gap-6">
          
          {/* Main Hero Card */}
          <div className="relative flex flex-col rounded-[2.5rem] bg-white/80 backdrop-blur-xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.08)] p-8 pt-16">
            
            {/* Circular Placeholder */}
            <div className="absolute top-0 left-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border-[6px] border-white bg-slate-100 shadow-xl backdrop-blur-sm">
              {isTopPerformer && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20 animate-bounce">
                  <Crown className="h-8 w-8 text-yellow-500 fill-yellow-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
                </div>
              )}
              <img 
                src={profilePhotoUrl} 
                alt="Profile" 
                className="h-full w-full object-cover"
              />
            </div>

            {/* Greeting & Profile Info */}
            <div className="text-center mb-6">
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">{greetingTime}, {userData?.full_name?.split(' ')[0] || "Hero"}</h2>
              <p className="text-sm text-slate-600 mt-2 font-medium italic">"{inspiringMessage}"</p>
            </div>

            {/* Gamification Stats inside Card */}
            <div className="grid gap-3 sm:grid-cols-2 mb-6">
              <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 p-4 border border-blue-100/50 text-center shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600/80">Rank</p>
                <p className="mt-1 text-xl font-extrabold text-blue-950">{rankName}</p>
                <p className="text-xs text-blue-700/80 mt-1">{currentRankBadge}</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 p-4 border border-emerald-100/50 text-center shadow-sm">
                <CheckSquare className="mx-auto h-4 w-4 text-emerald-500 mb-1" />
                <p className="text-xl font-extrabold text-emerald-950">{completionPct}%</p>
                <p className="text-[10px] uppercase font-bold text-emerald-700/70">Completion</p>
              </div>
            </div>

            {/* XP Progress */}
            <XpProgressBar 
              totalXp={totalXp} 
              nextGoalXp={nextGoalXp} 
              xpProgressPct={xpProgressPct} 
              nextTierExists={!!nextTier} 
            />
            
            {/* Streak Split Card */}
            <div className="flex bg-slate-50 border border-slate-100 rounded-xl overflow-hidden shadow-sm">
              <div className="flex-1 py-3 text-center border-r border-slate-200">
                <p className="text-lg font-black text-slate-800">{streakDays}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Current Streak</p>
              </div>
              <div className="flex-1 py-3 text-center">
                <p className="text-lg font-black text-slate-800">{longestStreak}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Longest Streak</p>
              </div>
            </div>
          </div>

          {/* Badges Card */}
          <div className="flex flex-col rounded-[2rem] bg-white/80 backdrop-blur-xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.08)] p-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-4 text-center">Badges</h3>
            <div className="grid grid-cols-4 gap-3">
              {earnedRankTiers.map((tier) => (
                <div key={tier.id} className="flex flex-col items-center gap-1 group">
                  <div className="h-12 w-12 flex items-center justify-center rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 shadow-sm text-2xl transition-transform group-hover:scale-110">
                    {tier.badgeName.split(' ')[0]}
                  </div>
                  <span className="text-[9px] font-bold text-slate-500 text-center leading-tight">{tier.rankName}</span>
                </div>
              ))}
              {earnedRankTiers.length === 0 && (
                <p className="col-span-4 text-xs text-center text-slate-400">Complete tasks to earn badges!</p>
              )}
            </div>
          </div>

          {/* Daily Quests Card */}
          <div className="flex flex-col rounded-[2rem] bg-white/80 backdrop-blur-xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.08)] p-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" /> Daily Quests
            </h3>
            <div className="flex flex-col gap-3">
              
              <div className="relative rounded-xl border border-blue-100 bg-blue-50/50 p-4 shadow-sm">
                <div className="absolute top-2 right-2 bg-white rounded-full px-2 py-0.5 text-[10px] font-bold text-blue-600 shadow-sm">+8 XP</div>
                <p className="font-semibold text-blue-900 text-sm">Complete today's tasks</p>
                <div className="mt-2 flex items-center gap-1.5">
                   {completionPct === 100 ? (
                     <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /><span className="text-xs font-bold text-emerald-600">Completed</span></>
                   ) : (
                     <><CircleDashed className="h-3.5 w-3.5 text-blue-400" /><span className="text-xs font-bold text-blue-500">In Progress</span></>
                   )}
                </div>
              </div>

              <div className="relative rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 shadow-sm">
                <div className="absolute top-2 right-2 bg-white rounded-full px-2 py-0.5 text-[10px] font-bold text-emerald-600 shadow-sm">+5 XP</div>
                <p className="font-semibold text-emerald-900 text-sm">Timely clock in</p>
                <div className="mt-2 flex items-center gap-1.5">
                   {attendance?.clock_in_time ? (
                     <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /><span className="text-xs font-bold text-emerald-600">Completed</span></>
                   ) : (
                     <><CircleDashed className="h-3.5 w-3.5 text-emerald-400" /><span className="text-xs font-bold text-emerald-500">Pending</span></>
                   )}
                </div>
              </div>

              <div className="relative rounded-xl border border-fuchsia-100 bg-fuchsia-50/50 p-4 shadow-sm">
                <div className="absolute top-2 right-2 bg-white rounded-full px-2 py-0.5 text-[10px] font-bold text-fuchsia-600 shadow-sm">+10 XP</div>
                <p className="font-semibold text-fuchsia-900 text-sm">Zero mistakes</p>
                <div className="mt-2 flex items-center gap-1.5">
                   <CircleDashed className="h-3.5 w-3.5 text-fuchsia-400" /><span className="text-xs font-bold text-fuchsia-500">Evaluating at EOD</span>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Right Column (Rest of Content) */}
        <div className="w-full md:w-[60%] px-4 md:pl-4 md:pr-8 pt-[32vh] pb-12 flex flex-col gap-6">
           
           {/* Trainings Completed (Top Right) */}
           <Card className="rounded-[2.5rem] border-white/40 shadow-xl bg-white/70 backdrop-blur-md">
             <CardHeader className="px-8 pt-8">
               <CardTitle>Trainings Completed</CardTitle>
               <CardDescription>
                 Your continuous learning progress
               </CardDescription>
             </CardHeader>
             <CardContent className="px-8 pb-8">
                {trainings && trainings.length > 0 ? (
                  <ScrollableCardList maxHeight="300px">
                    {trainings.map((t) => (
                      <div key={t.id} className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm transition-all hover:border-blue-100 hover:shadow-md">
                        <div>
                          <p className="font-semibold text-slate-800">{t.name}</p>
                          <p className="text-xs font-medium text-slate-500">Completed on {t.date_completed ? format(new Date(t.date_completed), 'MMM d, yyyy') : 'N/A'}</p>
                        </div>
                        <TrendingUp className="h-5 w-5 flex-shrink-0 text-slate-300 group-hover:text-blue-500 transition-colors" />
                      </div>
                    ))}
                  </ScrollableCardList>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
                    <p className="text-sm font-medium text-slate-500">No trainings completed yet.</p>
                  </div>
                )}
             </CardContent>
           </Card>

           {/* Today's Tasks (Bottom Right) */}
           <Card className="rounded-[2.5rem] border-white/40 shadow-xl bg-white/70 backdrop-blur-md">
             <CardHeader className="px-8 pt-8">
               <CardTitle>Today's Tasks</CardTitle>
               <CardDescription>
                 {format(new Date(), 'MMMM d, yyyy')}
               </CardDescription>
             </CardHeader>
             <CardContent className="px-8 pb-8">
                {displayTasks.length > 0 ? (
                  <ScrollableCardList maxHeight="400px">
                    {displayTasks.map((task) => {
                      const log = taskLogs?.find(l => l.task_id === task.id);
                      const isCompleted = log?.status === 'completed';
                      const isApproved = log?.verification_status === 'approved';
                      const isSubmitted = isCompleted && log?.verification_status === 'pending';
                      
                      let dotColor = "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]";
                      if (isApproved) dotColor = "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]";
                      else if (isSubmitted) dotColor = "bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.5)]";

                      return (
                        <TaskListItem key={task.id} task={task} log={log} dotColor={dotColor} />
                      );
                    })}
                  </ScrollableCardList>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
                    <p className="text-sm font-medium text-slate-500">No tasks for today. Enjoy the day!</p>
                  </div>
                )}
             </CardContent>
           </Card>
           
        </div>
      </div>
    </div>
  );
}
