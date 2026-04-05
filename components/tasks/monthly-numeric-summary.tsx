"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { Calculator } from "lucide-react";
import type { Task, TaskLog } from "@/lib/types/database";

interface MonthlyNumericSummaryProps {
  dailyTask: Task;
  userId: string;
  month: string;
}

interface DailyValue {
  date: string;
  value: number;
  submitted_at: string;
}

export function MonthlyNumericSummary({ dailyTask, userId, month }: MonthlyNumericSummaryProps) {
  const [dailyValues, setDailyValues] = useState<DailyValue[]>([]);
  const [monthlyTotal, setMonthlyTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, [dailyTask.id, userId, month]);

  const fetchData = async () => {
    const monthStart = format(new Date(month), 'yyyy-MM-01');
    const monthEnd = format(new Date(new Date(month).getFullYear(), new Date(month).getMonth() + 1, 0), 'yyyy-MM-dd');

    const { data: logs } = await supabase
      .from('task_logs')
      .select('date, numeric_value, submitted_at')
      .eq('task_id', dailyTask.id)
      .eq('user_id', userId)
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .not('numeric_value', 'is', null)
      .order('date', { ascending: true });

    if (logs) {
      const values = logs.map(log => ({
        date: log.date,
        value: log.numeric_value!,
        submitted_at: log.submitted_at!,
      }));
      
      const total = values.reduce((sum, v) => sum + v.value, 0);
      
      setDailyValues(values);
      setMonthlyTotal(total);
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (dailyValues.length === 0) {
    return null;
  }

  return (
    <Card className="border-purple-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Monthly Summary: {dailyTask.title}
            </CardTitle>
            <CardDescription>
              Auto-calculated from daily submissions
            </CardDescription>
          </div>
          <Badge className="bg-purple-100 text-purple-800">
            Total: {monthlyTotal} {dailyTask.numeric_unit || 'units'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p className="text-sm font-medium">Daily Breakdown:</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {dailyValues.map((dv) => (
              <div 
                key={dv.date} 
                className="text-sm p-2 bg-muted rounded flex justify-between items-center"
              >
                <span className="text-muted-foreground">
                  {format(new Date(dv.date), 'MMM d')}
                </span>
                <span className="font-medium">
                  {dv.value}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            This total is automatically calculated and submitted to the linked monthly task
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
