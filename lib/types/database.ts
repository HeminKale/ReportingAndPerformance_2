export type UserRole = 'admin' | 'manager' | 'employee';
export type TaskType = 'daily' | 'weekly' | 'monthly';
export type TaskStatus = 'completed' | 'pending';
export type VerificationStatus = 'pending' | 'approved' | 'rejected';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type LeaveDayType = 'full_day' | 'half_day';
export type LeaveCategory = 'vacation' | 'sick' | 'personal';
export type NotificationType = 'task_verification' | 'leave_approval' | 'late_request' | 'task_rejected' | 'general';
export type MistakeSeverity = 'low' | 'medium' | 'high';

/** Stored in DB enum `daily_performance_rating` */
export type DailyPerformanceRating =
  | 'very_poor'
  | 'poor'
  | 'average'
  | 'good'
  | 'very_good'
  | 'excellent';

export const DAILY_PERFORMANCE_OPTIONS: { value: DailyPerformanceRating; label: string }[] = [
  { value: 'very_poor', label: 'Very poor' },
  { value: 'poor', label: 'Poor' },
  { value: 'average', label: 'Average' },
  { value: 'good', label: 'Good' },
  { value: 'very_good', label: 'Very Good' },
  { value: 'excellent', label: 'Excellent' },
];

export const dailyPerformanceLabel = (v: DailyPerformanceRating) =>
  DAILY_PERFORMANCE_OPTIONS.find((o) => o.value === v)?.label ?? v;

export interface Organization {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  settings: {
    clock_in_cutoff: string;
    features: {
      leaderboard: boolean;
      mistakes: boolean;
      leaves: boolean;
    };
  };
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  organization_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  manager_id: string | null;
  timezone: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  type: TaskType;
  day_of_week: number | null;
  due_date: string | null;
  assigned_to: string | null;
  assigned_by: string;
  is_common_task: boolean;
  is_active: boolean;
  is_numeric_task: boolean;
  numeric_unit: string | null;
  linked_monthly_task_id: string | null;
  /** Set when this row was materialized from a manager_periodic_tasks template (cron). */
  source_manager_periodic_task_id?: string | null;
  created_at: string;
  updated_at: string;
}

/** Manager-owned template; cron materializes into `tasks` for each direct report */
export interface ManagerPeriodicTask {
  id: string;
  organization_id: string;
  manager_id: string;
  title: string;
  description: string | null;
  type: TaskType;
  day_of_week: number | null;
  monthly_day: number | null;
  is_numeric_task: boolean;
  numeric_unit: string | null;
  linked_monthly_task_id: string | null;
  /** Daily numeric only: link rollup to a monthly periodic template (resolved at cron). */
  linked_monthly_periodic_id?: string | null;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaskLog {
  id: string;
  organization_id: string;
  task_id: string;
  user_id: string;
  date: string;
  status: TaskStatus;
  comment: string | null;
  reason: string | null;
  verified_by: string | null;
  verification_status: VerificationStatus;
  verified_at: string | null;
  submitted_at: string | null;
  numeric_value: number | null;
  manager_review_comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: string;
  organization_id: string;
  user_id: string;
  date: string;
  clock_in_time: string | null;
  clock_out_time: string | null;
  is_late_request: boolean;
  late_reason: string | null;
  approval_status: ApprovalStatus;
  approved_by: string | null;
  manager_comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface Leave {
  id: string;
  organization_id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  type: LeaveDayType;
  leave_type: LeaveCategory;
  reason: string;
  status: ApprovalStatus;
  approved_by: string | null;
  manager_comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  organization_id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  metadata: Record<string, any>;
  created_at: string;
}

export interface Leaderboard {
  id: string;
  organization_id: string;
  user_id: string;
  month: string;
  rank: number;
  score: number;
  decided_by: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeaderboardDaily {
  id: string;
  organization_id: string;
  user_id: string;
  rating_date: string;
  performance: DailyPerformanceRating;
  comments: string | null;
  decided_by: string;
  created_at: string;
  updated_at: string;
}

export interface Mistake {
  id: string;
  organization_id: string;
  user_id: string;
  added_by: string;
  title: string;
  description: string;
  severity: MistakeSeverity;
  date: string;
  created_at: string;
  updated_at: string;
}

export interface Announcement {
  id: string;
  organization_id: string;
  title: string;
  content: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  organization_id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
}
