import type { Task, TaskLog, User } from "@/lib/types/database";

export type SharedTaskGroup = {
  taskId: string;
  title: string;
  type: "daily" | "weekly" | "monthly";
  isNumeric: boolean;
  numericUnit: string | null;
  assignedUserIds: string[];
  periodicTaskId?: string | null;
  createdAt: string;
};

export function identifySharedTasks(
  tasks: Task[],
  minAssignees: number = 2
): SharedTaskGroup[] {
  const groups = new Map<string, Task[]>();

  for (const task of tasks) {
    let groupKey: string;

    if (task.source_manager_periodic_task_id) {
      groupKey = `periodic:${task.source_manager_periodic_task_id}`;
    } else {
      const createdDate = new Date(task.created_at).toISOString().split("T")[0];
      groupKey = `manual:${task.title}:${task.type}:${createdDate}`;
    }

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(task);
  }

  const sharedGroups: SharedTaskGroup[] = [];

  for (const [groupKey, groupTasks] of groups.entries()) {
    if (groupTasks.length >= minAssignees) {
      const representative = groupTasks[0];
      const assignedUserIds = groupTasks
        .map((t) => t.assigned_to)
        .filter((id): id is string => id !== null);

      sharedGroups.push({
        taskId: representative.id,
        title: representative.title,
        type: representative.type,
        isNumeric: representative.is_numeric_task,
        numericUnit: representative.numeric_unit,
        assignedUserIds,
        periodicTaskId: representative.source_manager_periodic_task_id || null,
        createdAt: representative.created_at,
      });
    }
  }

  return sharedGroups;
}

export function getCellValue(
  taskGroup: SharedTaskGroup,
  employee: User,
  taskLogs: TaskLog[],
  tasks: Task[],
  date?: string
): string {
  const isAssigned = taskGroup.assignedUserIds.includes(employee.id);

  if (!isAssigned) {
    return "NA";
  }

  const employeeTask = tasks.find(
    (t) =>
      t.title === taskGroup.title &&
      t.type === taskGroup.type &&
      t.assigned_to === employee.id &&
      (taskGroup.periodicTaskId
        ? t.source_manager_periodic_task_id === taskGroup.periodicTaskId
        : new Date(t.created_at).toISOString().split("T")[0] ===
          new Date(taskGroup.createdAt).toISOString().split("T")[0])
  );

  if (!employeeTask) {
    return "NA";
  }

  const relevantLog = taskLogs.find(
    (log) =>
      log.task_id === employeeTask.id &&
      log.user_id === employee.id &&
      (!date || log.date === date)
  );

  if (!relevantLog) {
    return "Not Submitted";
  }

  if (taskGroup.isNumeric) {
    if (relevantLog.numeric_value != null) {
      return relevantLog.numeric_value.toString();
    }
  }

  return relevantLog.status === "completed" ? "Completed" : "Pending";
}

export function getHistoricalNumericValue(
  taskGroup: SharedTaskGroup,
  employee: User,
  taskLogs: TaskLog[],
  tasks: Task[],
  targetDate: string
): string {
  const isAssigned = taskGroup.assignedUserIds.includes(employee.id);

  if (!isAssigned) {
    return "NA";
  }

  const employeeTask = tasks.find(
    (t) =>
      t.title === taskGroup.title &&
      t.type === taskGroup.type &&
      t.assigned_to === employee.id &&
      (taskGroup.periodicTaskId
        ? t.source_manager_periodic_task_id === taskGroup.periodicTaskId
        : new Date(t.created_at).toISOString().split("T")[0] ===
          new Date(taskGroup.createdAt).toISOString().split("T")[0])
  );

  if (!employeeTask) {
    return "NA";
  }

  const target = new Date(targetDate);
  let relevantLogs: TaskLog[] = [];

  if (taskGroup.type === "daily") {
    relevantLogs = taskLogs.filter(
      (log) =>
        log.task_id === employeeTask.id &&
        log.user_id === employee.id &&
        log.date === targetDate
    );
  } else if (taskGroup.type === "weekly") {
    const startOfWeek = new Date(target);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    relevantLogs = taskLogs.filter((log) => {
      if (log.task_id !== employeeTask.id || log.user_id !== employee.id) {
        return false;
      }
      const logDate = new Date(log.date);
      return logDate >= startOfWeek && logDate <= endOfWeek;
    });
  } else if (taskGroup.type === "monthly") {
    const year = target.getFullYear();
    const month = target.getMonth();
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0);

    relevantLogs = taskLogs.filter((log) => {
      if (log.task_id !== employeeTask.id || log.user_id !== employee.id) {
        return false;
      }
      const logDate = new Date(log.date);
      return logDate >= startOfMonth && logDate <= endOfMonth;
    });
  }

  if (relevantLogs.length === 0) {
    return "-";
  }

  const total = relevantLogs.reduce((sum, log) => {
    return sum + (log.numeric_value || 0);
  }, 0);

  return total.toString();
}
