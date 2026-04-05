import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckSquare, Clock, AlertCircle, TrendingUp } from 'lucide-react';
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

  const { data: pendingVerifications } = await supabase
    .from('task_logs')
    .select('*')
    .eq('user_id', user.id)
    .eq('verification_status', 'pending');

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {userData?.full_name}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
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
