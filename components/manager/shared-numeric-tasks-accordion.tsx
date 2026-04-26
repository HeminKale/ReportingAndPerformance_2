"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Task, TaskLog, User } from "@/lib/types/database";
import {
  identifySharedTasks,
  findTaskRowForGroupMember,
  sumNumericLogsBetween,
  sumNumericLogsInMonth,
  type SharedTaskGroup,
} from "@/lib/utils/shared-tasks";

const CURRENT_MONTH = "__current_month__";

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type SharedNumericTasksAccordionProps = {
  tasks: Task[];
  taskLogs: TaskLog[];
  employees: User[];
  /** yyyy-MM-dd */
  today: string;
  employeeNameFilter: string;
  taskNameFilter: string;
};

function SharedNumericTaskPanel({
  group,
  tasks,
  taskLogs,
  employees,
  today,
  yearOptions,
}: {
  group: SharedTaskGroup;
  tasks: Task[];
  taskLogs: TaskLog[];
  employees: User[];
  today: string;
  yearOptions: number[];
}) {
  const [periodMode, setPeriodMode] = useState(CURRENT_MONTH);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIdx = now.getMonth();

  const isCurrentMonth = periodMode === CURRENT_MONTH;
  const selectedYear = isCurrentMonth ? currentYear : Number.parseInt(periodMode, 10);

  const rows = useMemo(() => {
    const monthStartStr = format(new Date(currentYear, currentMonthIdx, 1), "yyyy-MM-dd");
    return employees
      .map((emp) => {
        const taskRow = findTaskRowForGroupMember(group, emp.id, tasks);
        if (!taskRow) return null;
        if (isCurrentMonth) {
          const todayCount = sumNumericLogsBetween(taskLogs, taskRow.id, emp.id, today, today);
          const countTillDate = sumNumericLogsBetween(taskLogs, taskRow.id, emp.id, monthStartStr, today);
          return {
            employee: emp,
            taskRow,
            todayCount,
            countTillDate,
            monthTotals: null as number[] | null,
          };
        }
        const monthTotals = MONTH_SHORT.map((_, idx) =>
          sumNumericLogsInMonth(taskLogs, taskRow.id, emp.id, selectedYear, idx)
        );
        return {
          employee: emp,
          taskRow,
          todayCount: 0,
          countTillDate: 0,
          monthTotals,
        };
      })
      .filter(Boolean) as {
      employee: User;
      taskRow: Task;
      todayCount: number;
      countTillDate: number;
      monthTotals: number[] | null;
    }[];
  }, [
    employees,
    group,
    isCurrentMonth,
    currentYear,
    currentMonthIdx,
    selectedYear,
    taskLogs,
    tasks,
    today,
  ]);

  return (
    <details className="rounded-lg border bg-card">
      <summary className="cursor-pointer list-none px-4 py-3 font-medium hover:bg-muted/50 flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate" title={group.title}>
            {group.title}
          </span>
          <span className="text-xs font-normal text-muted-foreground capitalize">
            {group.type}
            {group.numericUnit ? ` · ${group.numericUnit}` : ""}
          </span>
        </span>
        <span className="text-xs text-muted-foreground shrink-0">Expand</span>
      </summary>
      <div className="border-t p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="text-sm text-muted-foreground mr-auto">Period</span>
          <Select value={periodMode} onValueChange={setPeriodMode}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={CURRENT_MONTH}>Current month</SelectItem>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No assigned employees match the filters.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-10 min-w-[140px] bg-background">Employee</TableHead>
                  {isCurrentMonth ? (
                    <>
                      <TableHead className="text-right">Today&apos;s count</TableHead>
                      <TableHead className="text-right">Count till date</TableHead>
                    </>
                  ) : (
                    MONTH_SHORT.map((label) => (
                      <TableHead key={label} className="text-right min-w-[72px]">
                        {label}
                      </TableHead>
                    ))
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ employee, todayCount, countTillDate, monthTotals }) => (
                  <TableRow key={employee.id}>
                    <TableCell className="sticky left-0 z-10 bg-background font-medium">
                      {employee.full_name}
                    </TableCell>
                    {isCurrentMonth ? (
                      <>
                        <TableCell className="text-right tabular-nums">{todayCount}</TableCell>
                        <TableCell className="text-right tabular-nums">{countTillDate}</TableCell>
                      </>
                    ) : (
                      monthTotals!.map((v, i) => (
                        <TableCell key={i} className="text-right tabular-nums text-sm">
                          {v}
                        </TableCell>
                      ))
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </details>
  );
}

export function SharedNumericTasksAccordion({
  tasks,
  taskLogs,
  employees,
  today,
  employeeNameFilter,
  taskNameFilter,
}: SharedNumericTasksAccordionProps) {
  const groups = useMemo(() => {
    const list = identifySharedTasks(tasks, 2).filter((g) => g.isNumeric);
    const term = taskNameFilter.trim().toLowerCase();
    if (!term) return list;
    return list.filter((g) => g.title.toLowerCase().includes(term));
  }, [tasks, taskNameFilter]);

  const employeesFiltered = useMemo(() => {
    const sorted = [...employees].sort((a, b) => a.full_name.localeCompare(b.full_name));
    const term = employeeNameFilter.trim().toLowerCase();
    if (!term) return sorted;
    return sorted.filter((e) => e.full_name.toLowerCase().includes(term));
  }, [employees, employeeNameFilter]);

  const yearOptions = useMemo(() => {
    const years = new Set<number>();
    years.add(new Date().getFullYear());
    for (const log of taskLogs) {
      if (log.date) years.add(new Date(`${log.date}T12:00:00`).getFullYear());
    }
    for (const t of tasks) {
      if (t.created_at) years.add(new Date(t.created_at).getFullYear());
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [taskLogs, tasks]);

  if (groups.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          No numeric shared tasks match the filters. Shared tasks need at least two assignees on the same batch or
          periodic template.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <SharedNumericTaskPanel
          key={`${group.periodicTaskId ?? "manual"}-${group.title}-${group.type}-${group.createdAt}`}
          group={group}
          tasks={tasks}
          taskLogs={taskLogs}
          employees={employeesFiltered}
          today={today}
          yearOptions={yearOptions}
        />
      ))}
    </div>
  );
}
