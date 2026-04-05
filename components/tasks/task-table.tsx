"use client";

import { Fragment, useState } from "react";
import { format } from "date-fns";
import { ChevronDown, ChevronUp, Eye } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Task, TaskLog } from "@/lib/types/database";

interface TaskWithLog extends Task {
  taskLog?: TaskLog;
}

interface TaskTableProps {
  tasks: TaskWithLog[];
  onSubmit: (task: Task) => void;
  onView: (task: Task, taskLog?: TaskLog) => void;
}

export function TaskTable({ tasks, onSubmit, onView }: TaskTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (taskId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedRows(newExpanded);
  };

  const getStatusBadge = (status?: string) => {
    if (!status) return <Badge variant="outline">Not Submitted</Badge>;
    
    switch (status) {
      case 'completed':
        return <Badge className="bg-blue-100 text-blue-800">Completed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getApprovalBadge = (verificationStatus?: string) => {
    if (!verificationStatus) return <Badge variant="outline">-</Badge>;
    
    switch (verificationStatus) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending Review</Badge>;
      default:
        return <Badge variant="outline">{verificationStatus}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    const colors = {
      daily: 'bg-purple-100 text-purple-800',
      weekly: 'bg-blue-100 text-blue-800',
      monthly: 'bg-green-100 text-green-800',
    };
    return <Badge className={colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
      {type.charAt(0).toUpperCase() + type.slice(1)}
    </Badge>;
  };

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No tasks found
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]"></TableHead>
            <TableHead>Task Name</TableHead>
            <TableHead>Task Description</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Submitted At</TableHead>
            <TableHead>Created Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => {
            const isExpanded = expandedRows.has(task.id);
            const taskLog = task.taskLog;
            
            return (
              <Fragment key={task.id}>
                <TableRow className={isExpanded ? 'bg-muted/50' : ''}>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleRow(task.id)}
                      className="h-8 w-8 p-0"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                  <TableCell className="font-medium">
                    {task.title}
                    {task.is_numeric_task && taskLog?.numeric_value !== null && (
                      <span className="text-xs text-muted-foreground ml-2">
                        ({taskLog.numeric_value} {task.numeric_unit || 'units'})
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-md">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {task.description || '-'}
                    </p>
                  </TableCell>
                  <TableCell>{getStatusBadge(taskLog?.status)}</TableCell>
                  <TableCell>
                    {taskLog?.submitted_at ? (
                      <span className="text-sm">
                        {format(new Date(taskLog.submitted_at), 'HH:mm dd/MM/yyyy')}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(task.created_at), 'HH:mm dd/MM/yyyy')}
                    </span>
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow>
                    <TableCell colSpan={6} className="bg-muted/30">
                      <div className="py-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium mb-1">Full Description:</p>
                            <p className="text-sm text-muted-foreground">{task.description || 'No description'}</p>
                          </div>
                          {taskLog && (
                            <div>
                              <p className="text-sm font-medium mb-1">Manager Approval:</p>
                              {getApprovalBadge(taskLog.verification_status)}
                            </div>
                          )}
                        </div>
                        
                        {taskLog && (
                          <div className="space-y-2">
                            {taskLog.comment && (
                              <div>
                                <p className="text-sm font-medium mb-1">Comment:</p>
                                <p className="text-sm text-muted-foreground">{taskLog.comment}</p>
                              </div>
                            )}
                            {taskLog.reason && (
                              <div>
                                <p className="text-sm font-medium mb-1">Reason:</p>
                                <p className="text-sm text-muted-foreground">{taskLog.reason}</p>
                              </div>
                            )}
                            {taskLog.manager_review_comment && (
                              <div>
                                <p className="text-sm font-medium mb-1">Manager Review:</p>
                                <p className="text-sm text-muted-foreground">{taskLog.manager_review_comment}</p>
                              </div>
                            )}
                          </div>
                        )}
                        
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onView(task, taskLog)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                          {!taskLog && (
                            <Button
                              size="sm"
                              onClick={() => onSubmit(task)}
                            >
                              Submit Task
                            </Button>
                          )}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
