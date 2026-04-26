"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { EmployeeCalendarPanel } from "@/components/calendar/employee-calendar-panel";
import type { Leave, User } from "@/lib/types/database";
import { dayKey } from "@/lib/calendar/calendar-utils";
import {
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const SELECT_NONE = "__none__";

export type LeaveWithUser = Leave & { users?: { full_name: string | null } | null };

function firstNameFromFullName(fullName: string | null | undefined): string {
  const t = fullName?.trim();
  if (!t) return "?";
  return t.split(/\s+/)[0] ?? "?";
}

function leaveOverlapsDay(leave: Leave, dayStr: string): boolean {
  return leave.start_date <= dayStr && leave.end_date >= dayStr;
}

function TeamLeavesDayCell({
  day,
  currentMonth,
  leaves,
}: {
  day: Date;
  currentMonth: Date;
  leaves: LeaveWithUser[];
}) {
  const dateStr = dayKey(day);
  const active = leaves.filter((l) => leaveOverlapsDay(l, dateStr));
  active.sort((a, b) => {
    const an = (a.users?.full_name || "").localeCompare(b.users?.full_name || "");
    if (an !== 0) return an;
    return a.id.localeCompare(b.id);
  });

  return (
    <div
      className={cn(
        "relative z-0 flex flex-col border rounded-lg p-2 min-h-[140px] transition-colors overflow-visible hover:z-50",
        isToday(day) ? "border-primary border-2 bg-primary/5" : "border-border",
        "bg-card",
        !isSameMonth(day, currentMonth) && "opacity-50"
      )}
    >
      <div className="text-sm font-semibold mb-1.5 shrink-0">{format(day, "d")}</div>
      <div className="flex flex-col gap-0.5 flex-1 min-h-0 overflow-y-auto">
        {active.length === 0 ? (
          <span className="text-[11px] text-muted-foreground">—</span>
        ) : (
          active.map((leave) => {
            const approved = leave.status === "approved";
            return (
              <div
                key={leave.id}
                className={cn(
                  "text-[10px] leading-tight px-1.5 py-0.5 rounded font-medium truncate border",
                  approved
                    ? "bg-green-100/90 text-green-900 border-green-200/80"
                    : "bg-red-100/90 text-red-900 border-red-200/80"
                )}
                title={`${leave.users?.full_name ?? "Employee"} · ${leave.leave_type} · ${leave.status}`}
              >
                {firstNameFromFullName(leave.users?.full_name)}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function ManagerCalendarTab({ teamMembers }: { teamMembers: User[] }) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [teamLeaves, setTeamLeaves] = useState<LeaveWithUser[]>([]);
  const [loadingLeaves, setLoadingLeaves] = useState(false);
  const supabase = createClient();

  const teamIds = useMemo(() => teamMembers.map((m) => m.id), [teamMembers]);

  useEffect(() => {
    if (selectedEmployeeId) {
      setTeamLeaves([]);
      setLoadingLeaves(false);
      return;
    }

    let cancelled = false;
    (async () => {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      const from = format(monthStart, "yyyy-MM-dd");
      const to = format(monthEnd, "yyyy-MM-dd");

      if (teamIds.length === 0) {
        if (!cancelled) {
          setTeamLeaves([]);
          setLoadingLeaves(false);
        }
        return;
      }

      setLoadingLeaves(true);
      const { data, error } = await supabase
        .from("leaves")
        .select("*, users!user_id(full_name)")
        .in("user_id", teamIds)
        .lte("start_date", to)
        .gte("end_date", from);

      if (error) console.error("[ManagerCalendarTab] leaves fetch:", error);
      if (!cancelled) {
        setTeamLeaves((data || []) as LeaveWithUser[]);
        setLoadingLeaves(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentMonth, teamIds, selectedEmployeeId]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const bumpMonth = (delta: number) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + delta, 1));
  };

  return (
    <Card className="overflow-visible shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            <CardTitle className="text-xl shrink-0">{format(currentMonth, "MMMM yyyy")}</CardTitle>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="icon" type="button" onClick={() => bumpMonth(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" type="button" onClick={() => bumpMonth(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Select
            value={selectedEmployeeId || SELECT_NONE}
            onValueChange={(v) => setSelectedEmployeeId(v === SELECT_NONE ? "" : v)}
          >
            <SelectTrigger className="w-full lg:w-[280px] lg:ml-auto shrink-0">
              <SelectValue placeholder="Employee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SELECT_NONE}>All team (leaves only)</SelectItem>
              {teamMembers.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-muted-foreground font-normal pt-1">
          {selectedEmployeeId
            ? "Full calendar for the selected employee (same as their Calendar page)."
            : "All leave requests from your team that overlap this month. Green = approved, red = pending or rejected."}
        </p>
      </CardHeader>
      <CardContent className="overflow-visible pt-0">
        {teamMembers.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6">
            No team members in your hierarchy. The calendar will populate when you have direct or indirect reports.
          </p>
        ) : selectedEmployeeId ? (
          <EmployeeCalendarPanel
            subjectUserId={selectedEmployeeId}
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            embedded
          />
        ) : loadingLeaves ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading leaves…</div>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-2 md:gap-3">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div
                  key={d}
                  className="text-center font-semibold text-xs md:text-sm py-2 text-muted-foreground"
                >
                  {d}
                </div>
              ))}
              {Array.from({ length: monthStart.getDay() }).map((_, index) => (
                <div key={`empty-${index}`} className="min-h-[140px]" aria-hidden />
              ))}
              {daysInMonth.map((day) => (
                <TeamLeavesDayCell
                  key={dayKey(day)}
                  day={day}
                  currentMonth={currentMonth}
                  leaves={teamLeaves}
                />
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs md:text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-primary rounded shrink-0" />
                <span>Today</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-3 bg-green-100/90 border border-green-200/80 rounded shrink-0" />
                <span>Approved leave (first name on band)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-3 bg-red-100/90 border border-red-200/80 rounded shrink-0" />
                <span>Pending or rejected leave</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
