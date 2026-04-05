"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TaskLogDialog } from "@/components/tasks/task-log-dialog";
import { TaskTable } from "@/components/tasks/task-table";
import { MonthlyNumericSummary } from "@/components/tasks/monthly-numeric-summary";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import type { Task, TaskLog, User } from "@/lib/types/database";

export default function TasksPage() {
  const params = useParams();
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskLogs, setTaskLogs] = useState<TaskLog[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedTaskLog, setSelectedTaskLog] = useState<TaskLog | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const today = format(new Date(), 'yyyy-MM-dd');
  const currentMonth = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    if (!authUser) return;

    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    const { data: tasksData } = await supabase
      .from('tasks')
      .select('*')
      .eq('organization_id', userData?.organization_id)
      .or(`assigned_to.eq.${authUser.id},is_common_task.eq.true`)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    const { data: logsData } = await supabase
      .from('task_logs')
      .select('*')
      .eq('user_id', authUser.id)
      .eq('date', today);

    setUser(userData);
    setTasks(tasksData || []);
    setTaskLogs(logsData || []);
    setLoading(false);
  };

  const handleSubmit = (task: Task) => {
    setSelectedTask(task);
    setDialogOpen(true);
  };

  const handleView = (task: Task, taskLog?: TaskLog) => {
    setSelectedTask(task);
    setSelectedTaskLog(taskLog || null);
    setViewDialogOpen(true);
  };

  const dailyTasks = tasks.filter(t => t.type === 'daily').map(task => ({
    ...task,
    taskLog: taskLogs.find(log => log.task_id === task.id),
  }));

  const weeklyTasks = tasks.filter(t => t.type === 'weekly').map(task => ({
    ...task,
    taskLog: taskLogs.find(log => log.task_id === task.id),
  }));

  const monthlyTasks = tasks.filter(t => t.type === 'monthly').map(task => ({
    ...task,
    taskLog: taskLogs.find(log => log.task_id === task.id),
  }));

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

        <TabsContent value="daily" className="space-y-6">
          {dailyTasks.some(t => t.is_numeric_task && t.linked_monthly_task_id) && user && (
            <div className="space-y-4">
              {dailyTasks
                .filter(t => t.is_numeric_task && t.linked_monthly_task_id)
                .map(task => (
                  <MonthlyNumericSummary
                    key={task.id}
                    dailyTask={task}
                    userId={user.id}
                    month={currentMonth}
                  />
                ))}
            </div>
          )}
          <TaskTable 
            tasks={dailyTasks} 
            onSubmit={handleSubmit}
            onView={handleView}
          />
        </TabsContent>

        <TabsContent value="weekly">
          <TaskTable 
            tasks={weeklyTasks} 
            onSubmit={handleSubmit}
            onView={handleView}
          />
        </TabsContent>

        <TabsContent value="monthly">
          <TaskTable 
            tasks={monthlyTasks} 
            onSubmit={handleSubmit}
            onView={handleView}
          />
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

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Task Details</DialogTitle>
            <DialogDescription>
              View complete task information
            </DialogDescription>
          </DialogHeader>

          {selectedTask && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Task Name</p>
                <p className="text-sm">{selectedTask.title}</p>
              </div>

              {selectedTask.description && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Description</p>
                  <p className="text-sm">{selectedTask.description}</p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-muted-foreground">Type</p>
                <p className="text-sm capitalize">{selectedTask.type}</p>
              </div>

              {selectedTask.is_numeric_task && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Unit</p>
                  <p className="text-sm">{selectedTask.numeric_unit || 'units'}</p>
                </div>
              )}

              {selectedTaskLog && (
                <>
                  <div className="border-t pt-4">
                    <p className="text-sm font-semibold mb-2">Submission Details</p>
                    
                    {selectedTask.is_numeric_task ? (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Value</p>
                        <p className="text-sm">{selectedTaskLog.numeric_value} {selectedTask.numeric_unit || 'units'}</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Status</p>
                        <p className="text-sm capitalize">{selectedTaskLog.status}</p>
                      </div>
                    )}

                    {selectedTaskLog.submitted_at && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-muted-foreground">Submitted At</p>
                        <p className="text-sm">{format(new Date(selectedTaskLog.submitted_at), 'HH:mm dd/MM/yyyy')}</p>
                      </div>
                    )}

                    {selectedTaskLog.comment && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-muted-foreground">Comment</p>
                        <p className="text-sm">{selectedTaskLog.comment}</p>
                      </div>
                    )}

                    {selectedTaskLog.reason && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-muted-foreground">Reason</p>
                        <p className="text-sm">{selectedTaskLog.reason}</p>
                      </div>
                    )}

                    <div className="mt-2">
                      <p className="text-sm font-medium text-muted-foreground">Manager Approval</p>
                      <p className="text-sm capitalize">{selectedTaskLog.verification_status}</p>
                    </div>

                    {selectedTaskLog.manager_review_comment && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-muted-foreground">Manager Review</p>
                        <p className="text-sm">{selectedTaskLog.manager_review_comment}</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
