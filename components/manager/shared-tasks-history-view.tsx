"use client";

import React, { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Task, TaskLog, User } from "@/lib/types/database";
import { identifySharedTasks, getHistoricalNumericValue, type SharedTaskGroup } from "@/lib/utils/shared-tasks";

export type SharedTasksHistoryViewProps = {
  tasks: Task[];
  taskLogs: TaskLog[];
  employees: User[];
};

export function SharedTasksHistoryView({ tasks, taskLogs, employees }: SharedTasksHistoryViewProps) {
  const [selectedDate, setSelectedDate] = useState("");

  const sharedTaskGroups = useMemo(() => {
    const allGroups = identifySharedTasks(tasks, 2);
    return allGroups.filter((g) => g.isNumeric);
  }, [tasks]);

  const dailyTasks = useMemo(
    () => sharedTaskGroups.filter((g) => g.type === "daily"),
    [sharedTaskGroups]
  );
  const weeklyTasks = useMemo(
    () => sharedTaskGroups.filter((g) => g.type === "weekly"),
    [sharedTaskGroups]
  );
  const monthlyTasks = useMemo(
    () => sharedTaskGroups.filter((g) => g.type === "monthly"),
    [sharedTaskGroups]
  );

  const sortedEmployees = useMemo(
    () => [...employees].sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [employees]
  );

  const renderTaskTable = (taskGroups: SharedTaskGroup[], label: string) => {
    if (taskGroups.length === 0) {
      return (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            No {label.toLowerCase()} numeric shared tasks
          </CardContent>
        </Card>
      );
    }

    if (!selectedDate) {
      return (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Select a date to view historical data
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-background z-10 min-w-[150px]">
                Employee
              </TableHead>
              {taskGroups.map((group) => (
                <TableHead key={group.taskId} className="min-w-[120px]">
                  <div className="flex flex-col">
                    <span className="font-medium truncate" title={group.title}>
                      {group.title}
                    </span>
                    {group.numericUnit && (
                      <span className="text-xs text-muted-foreground">({group.numericUnit})</span>
                    )}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedEmployees.map((employee) => (
              <TableRow key={employee.id}>
                <TableCell className="sticky left-0 bg-background z-10 font-medium">
                  {employee.full_name}
                  <span className="text-xs text-muted-foreground ml-2">({employee.role})</span>
                </TableCell>
                {taskGroups.map((group) => {
                  const value = getHistoricalNumericValue(
                    group,
                    employee,
                    taskLogs,
                    tasks,
                    selectedDate
                  );
                  const isNA = value === "NA";
                  const isEmpty = value === "-";

                  return (
                    <TableCell
                      key={`${employee.id}-${group.taskId}`}
                      className={`text-center ${
                        isNA
                          ? "text-muted-foreground italic"
                          : isEmpty
                            ? "text-muted-foreground"
                            : "text-blue-700 font-semibold"
                      }`}
                    >
                      {value}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  if (sharedTaskGroups.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-lg font-semibold mb-2">No Numeric Shared Tasks</p>
          <p className="text-sm text-muted-foreground">
            History view shows only numeric shared tasks assigned to 2 or more team members.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Label htmlFor="history-date" className="whitespace-nowrap">
          Select Date:
        </Label>
        <Input
          id="history-date"
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-44"
        />
        {selectedDate && (
          <p className="text-sm text-muted-foreground">
            {dailyTasks.length > 0 && "Daily: shows value for this date. "}
            {weeklyTasks.length > 0 && "Weekly: shows total for the week containing this date. "}
            {monthlyTasks.length > 0 && "Monthly: shows total for the month containing this date."}
          </p>
        )}
      </div>

      <details className="rounded-lg border" open={dailyTasks.length > 0}>
        <summary className="cursor-pointer list-none px-4 py-3 font-medium hover:bg-muted/50">
          Daily Tasks ({dailyTasks.length})
        </summary>
        <div className="border-t p-4">{renderTaskTable(dailyTasks, "Daily")}</div>
      </details>

      <details className="rounded-lg border">
        <summary className="cursor-pointer list-none px-4 py-3 font-medium hover:bg-muted/50">
          Weekly Tasks ({weeklyTasks.length})
        </summary>
        <div className="border-t p-4">{renderTaskTable(weeklyTasks, "Weekly")}</div>
      </details>

      <details className="rounded-lg border">
        <summary className="cursor-pointer list-none px-4 py-3 font-medium hover:bg-muted/50">
          Monthly Tasks ({monthlyTasks.length})
        </summary>
        <div className="border-t p-4">{renderTaskTable(monthlyTasks, "Monthly")}</div>
      </details>
    </div>
  );
}
