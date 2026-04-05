"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { TaskLogDialog } from "@/components/tasks/task-log-dialog";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import type { Task, TaskLog } from "@/lib/types/database";

export default function TasksPage() {
  const params = useParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskLogs, setTaskLogs] = useState<TaskLog[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const { data: userData } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    const { data: tasksData } = await supabase
      .from('tasks')
      .select('*')
      .eq('organization_id', userData?.organization_id)
      .or(`assigned_to.eq.${user.id},is_common_task.eq.true`)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    const { data: logsData } = await supabase
      .from('task_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today);

    setTasks(tasksData || []);
    setTaskLogs(logsData || []);
    setLoading(false);
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setDialogOpen(true);
  };

  const dailyTasks = tasks.filter(t => t.type === 'daily');
  const weeklyTasks = tasks.filter(t => t.type === 'weekly');
  const monthlyTasks = tasks.filter(t => t.type === 'monthly');

  const getTaskLog = (taskId: string) => {
    return taskLogs.find(log => log.task_id === taskId);
  };

  const renderTaskCard = (task: Task) => {
    const log = getTaskLog(task.id);
    
    return (
      <Card key={task.id} className="hover:shadow-md transition-shadow">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg">{task.title}</CardTitle>
              {task.description && (
                <CardDescription className="mt-2">
                  {task.description}
                </CardDescription>
              )}
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
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {log ? (
                <span className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${
                    log.status === 'completed' ? 'bg-green-500' : 'bg-yellow-500'
                  }`} />
                  {log.status === 'completed' ? 'Completed' : 'Pending'}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-gray-300" />
                  Not submitted
                </span>
              )}
            </div>
            <Button
              size="sm"
              onClick={() => handleTaskClick(task)}
              variant={log ? 'outline' : 'default'}
            >
              {log ? 'Update' : 'Submit'}
            </Button>
          </div>
          {log && log.comment && (
            <div className="mt-3 p-3 bg-muted rounded-md">
              <p className="text-sm font-medium mb-1">Comment:</p>
              <p className="text-sm text-muted-foreground">{log.comment}</p>
            </div>
          )}
          {log && log.reason && (
            <div className="mt-3 p-3 bg-muted rounded-md">
              <p className="text-sm font-medium mb-1">Reason:</p>
              <p className="text-sm text-muted-foreground">{log.reason}</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Tasks</h1>
        <p className="text-muted-foreground">
          Manage your daily, weekly, and monthly tasks
        </p>
      </div>

      <Tabs defaultValue="daily" className="space-y-6">
        <TabsList>
          <TabsTrigger value="daily">Daily ({dailyTasks.length})</TabsTrigger>
          <TabsTrigger value="weekly">Weekly ({weeklyTasks.length})</TabsTrigger>
          <TabsTrigger value="monthly">Monthly ({monthlyTasks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-4">
          {dailyTasks.length > 0 ? (
            dailyTasks.map(renderTaskCard)
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No daily tasks assigned
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="weekly" className="space-y-4">
          {weeklyTasks.length > 0 ? (
            weeklyTasks.map(renderTaskCard)
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No weekly tasks assigned
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="monthly" className="space-y-4">
          {monthlyTasks.length > 0 ? (
            monthlyTasks.map(renderTaskCard)
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No monthly tasks assigned
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {selectedTask && (
        <TaskLogDialog
          task={selectedTask}
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              fetchData();
            }
          }}
          date={today}
        />
      )}
    </div>
  );
}
