"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Leave } from "@/lib/types/database";

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchCalendarData();
  }, [currentMonth]);

  const fetchCalendarData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    const { data: leavesData } = await supabase
      .from('leaves')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .lte('start_date', format(monthEnd, 'yyyy-MM-dd'))
      .gte('end_date', format(monthStart, 'yyyy-MM-dd'));

    setLeaves(leavesData || []);
    setLoading(false);
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const isLeaveDay = (date: Date) => {
    return leaves.some(leave => {
      const leaveStart = parseISO(leave.start_date);
      const leaveEnd = parseISO(leave.end_date);
      return date >= leaveStart && date <= leaveEnd;
    });
  };

  const getLeaveForDay = (date: Date) => {
    return leaves.find(leave => {
      const leaveStart = parseISO(leave.start_date);
      const leaveEnd = parseISO(leave.end_date);
      return date >= leaveStart && date <= leaveEnd;
    });
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Calendar</h1>
        <p className="text-muted-foreground">
          View your leaves and important dates
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{format(currentMonth, 'MMMM yyyy')}</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={previousMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={nextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="text-center font-semibold text-sm p-2">
                {day}
              </div>
            ))}
            
            {Array.from({ length: monthStart.getDay() }).map((_, index) => (
              <div key={`empty-${index}`} className="p-2" />
            ))}
            
            {daysInMonth.map((day) => {
              const isLeave = isLeaveDay(day);
              const leave = getLeaveForDay(day);
              const today = isToday(day);
              
              return (
                <div
                  key={day.toISOString()}
                  className={`
                    p-2 border rounded-lg min-h-[80px] transition-colors
                    ${today ? 'border-primary border-2 bg-primary/5' : 'border-gray-200'}
                    ${isLeave ? 'bg-green-50' : 'bg-white'}
                    ${!isSameMonth(day, currentMonth) ? 'opacity-50' : ''}
                  `}
                >
                  <div className="text-sm font-medium mb-1">
                    {format(day, 'd')}
                  </div>
                  {isLeave && leave && (
                    <div className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded">
                      {leave.leave_type}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-primary rounded"></div>
              <span>Today</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-50 border border-gray-200 rounded"></div>
              <span>Leave</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
