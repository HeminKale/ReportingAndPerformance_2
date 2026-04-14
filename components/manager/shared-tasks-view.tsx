"use client";

import React, { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import type { Task, TaskLog, User } from "@/lib/types/database";
import { identifySharedTasks, getCellValue, type SharedTaskGroup } from "@/lib/utils/shared-tasks";

export type SharedTasksViewProps = {
  tasks: Task[];
  taskLogs: TaskLog[];
  employees: User[];
  filterDate?: string;
};

export function SharedTasksView({ tasks, taskLogs, employees, filterDate }: SharedTasksViewProps) {
  const sharedTaskGroups = useMemo(() => {
    return identifySharedTasks(tasks, 2);
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
            No {label.toLowerCase()} shared tasks
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
                    {group.isNumeric && group.numericUnit && (
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
                  const value = getCellValue(group, employee, taskLogs, tasks, filterDate);
                  const isNA = value === "NA";
                  const isNotSubmitted = value === "Not Submitted";
                  const isCompleted = value === "Completed";
                  const isPending = value === "Pending";
                  const isNumeric = !isNA && !isNotSubmitted && !isCompleted && !isPending;

                  return (
                    <TableCell
                      key={`${employee.id}-${group.taskId}`}
                      className={`text-center ${
                        isNA
                          ? "text-muted-foreground italic"
                          : isNotSubmitted
                            ? "text-muted-foreground"
                            : isCompleted
                              ? "text-green-700 font-medium"
                              : isPending
                                ? "text-yellow-700 font-medium"
                                : isNumeric
                                  ? "text-blue-700 font-semibold"
                                  : ""
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
          <p className="text-lg font-semibold mb-2">No Shared Tasks</p>
          <p className="text-sm text-muted-foreground">
            Shared tasks are tasks assigned to 2 or more team members.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
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
