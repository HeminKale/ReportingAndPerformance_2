# Notifications and Bell

This document describes how in-app notifications work for employees and managers: database types, who receives what, how the header bell count stays accurate, and where the code lives.

## Overview

- **Storage:** `public.notifications` (Supabase/Postgres). Unread items use `is_read = false`.
- **Badge:** `components/shared/notification-bell.tsx` shows a count of **unread** rows for the signed-in `user_id`. It refetches when `postgres_changes` fires and when other code calls **`requestNotificationsBellRefresh()`** from `lib/notifications/refresh-bell.ts` (a `window` event). The explicit refresh is important because **UPDATE** on `is_read` may not always trigger Realtime if the `notifications` table is not in the `supabase_realtime` publication (enable in **Database → Publications** for best results; the in-app event keeps the badge correct either way after approves, mark read, etc.).
- **Inbox:** `app/org/[orgSlug]/notifications/page.tsx` lists recent notifications; actionable rows support Approve/Reject; non-actionable rows use a double-check control to mark read.
- **Deep links:** `link` and optional `metadata` (including `actionable` and a resource key) support navigation and manager in-app approvals.

Apply enum migrations in Supabase (see [Database: enum](#database-enum) before relying on new notification types in production.

---

## Database: enum

The column `notifications.type` uses Postgres enum `notification_type`.

**Base values (initial schema):** `task_verification`, `leave_approval`, `late_request`, `task_rejected`, `general`.

**Extended (migration `20260426000000_extend_notification_type.sql`):**

- `task_assigned` — employee notified when a task is assigned to them
- `mistake_logged` — employee notified when a manager records a mistake
- `mistake_rectified` — employee notified when a closure is accepted (rectified)

The migration uses `ALTER TYPE notification_type ADD VALUE IF NOT EXISTS '...'` (safe to re-run on PostgreSQL 9.1+ with that syntax; Supabase uses a recent major version).

---

## Resource metadata (actionable items)

For requests that a **manager** must act on, inserts include `metadata` so:

1. The **Notifications** page can show **Approve** / **Reject** when the viewer is a manager (or admin) and `metadata.actionable === true` and `resource_type` / `resource_id` are set.
2. **`markResourceNotificationsRead`** can find unread rows for the **current manager** and mark them read when the same work is done elsewhere (e.g. Manager Panel or Task review dialog).

Conventional shapes:

| `resource_type` | Meaning | Typical `resource_id` |
|-----------------|---------|------------------------|
| `task_log` | Task submission pending review | `task_logs.id` |
| `attendance` | Late/early clock approval | `attendance.id` |
| `leave` | Leave request pending | `leaves.id` |

Include `employee_id` where useful for routing or future use (e.g. leaves/attendance/task submission flows).

**Employee free text** for manager-facing requests is stored in `metadata.employee_comment` (and optional `metadata.employee_comment_label` for the modal title), set when the employee submits: task log (`task-log-dialog`), leave request (`leaves/page`), late clock-in and early clock-out (`attendance/page`). The notifications page shows **View comments** (same row as **View details**) which opens a dialog with that text.

**Manager outcome comments** (approve/reject) for **attendance** and **leave** are stored in `metadata.manager_comment` on the employee’s notification row (see `app/org/[orgSlug]/manager/page.tsx` `handleAction`). Task outcomes use the same field. The dialog title **“Manager comment”** is used when only that field is present (see `getCommentModalPayload` in the notifications page).

For a full checklist of **rejected clock-in UX**, **due date** fields, and **manager notification** wiring, see [ATTENDANCE_DUE_DATE_AND_OUTCOME_NOTIF.md](ATTENDANCE_DUE_DATE_AND_OUTCOME_NOTIF.md).

`resource_id` in JSONB may be stored as a string; the client helper normalizes with `String()` when matching.

**Helper:** `lib/notifications/mark-resource-read.ts` — `markResourceNotificationsRead(supabase, userId, resourceType, resourceId)`.

It selects unread rows for `userId`, filters by `metadata.resource_type` and `metadata.resource_id`, then sets `is_read: true` on all matches.

**Where it is used**

- `app/org/[orgSlug]/manager/page.tsx` — after approving/rejecting task logs, attendance, or leave from the Manager Panel dialog.
- `app/org/[orgSlug]/notifications/page.tsx` — after a successful in-app Approve/Reject (clears any duplicate or overlapping unread for the same resource).
- `components/tasks/manager-review-dialog.tsx` — after approve/reject from the Tasks page review flow (clears the manager’s “pending review” notification for that `task_log`).

Row inserts to **employees** (outcome of approval) are separate; see the manager page and related components for the exact messages and types.

---

## Notification types by scenario

| Type | Recipient | Trigger (code) |
|------|------------|----------------|
| `task_verification` | Manager (pending review) | `components/tasks/task-log-dialog.tsx` (employee submit) |
| `task_rejected` / `task_verification` (outcome) | Employee | `manager/page.tsx` `handleAction`, `manager-review-dialog.tsx` (wording and type follow existing patterns) |
| `late_request` | Manager | `app/org/.../attendance/page.tsx` (late/early request with actionable metadata) |
| `late_request` (outcome) | Employee | `manager/page.tsx` on attendance action |
| `leave_approval` | Manager and/or employee | `leaves/page.tsx` (request); `manager/page.tsx` (outcome) |
| `task_assigned` | Employee | `components/shared/task-assignment-panel.tsx` (after create; needs `orgSlug` for `link`) |
| `mistake_logged` / `mistake_rectified` | Employee | `app/org/.../manager/page.tsx` (create mistake / accept closure) |
| `general` | Varies | Any ad hoc use |

**Note:** Managers must have `orgSlug` on routes under `app/org/[orgSlug]/...` so `TaskAssignmentPanel` (and notification links) can build `/org/{orgSlug}/tasks` where applicable. The panel accepts an optional `orgSlug` prop or falls back to `useParams()`.

---

## UI behaviour

- **`notification-bell.tsx`:** Subscribes to `notifications` changes for the current `userId`, refetches unread count, routes to the notifications page on click.
- **Notifications page:** Hides items with `metadata.actioned === true` from the main list. Actionable rows: Approve/Reject. Non-actionable rows: double-check (muted when unread, primary when read) to call `markAsRead`.

---

## RLS and inserts

RLS and policies for `notifications` are defined in Supabase migrations (e.g. users can read/update their own; inserts use the “System can create notifications”-style policy where applicable). If inserts fail in a given environment, verify policies and the service role / anon usage for that call path.

---

## TypeScript

`lib/types/database.ts` — `NotificationType` and `Notification` should stay aligned with the Postgres `notification_type` enum.

---

## Optional / future work

- **Cron / periodic materialized tasks:** if assignees should get a `task_assigned` (or similar) when the cron creates rows, that would be a separate change in the cron path and is not covered by the base assignment panel flow alone.
- **Inbox vs Manager Panel parity for employee “outcome” messages:** if every approval must notify the employee identically, confirm that both the notifications page handler and the manager panel send the same inserts; adjust if product requires exact parity.

---

## Quick file map

| Concern | Location |
|--------|----------|
| Bell UI + count | `components/shared/notification-bell.tsx` |
| Inbox | `app/org/[orgSlug]/notifications/page.tsx` |
| Mark resource read | `lib/notifications/mark-resource-read.ts` |
| Bell badge refetch (same tab) | `lib/notifications/refresh-bell.ts` |
| Task assignment → `task_assigned` | `components/shared/task-assignment-panel.tsx` |
| Manager: mistakes, panel actions, inserts | `app/org/[orgSlug]/manager/page.tsx` |
| Task submit → manager review | `components/tasks/task-log-dialog.tsx` |
| Tasks page review | `components/tasks/manager-review-dialog.tsx` |
| Leave / attendance request → manager | `app/org/.../leaves/page.tsx`, `app/org/.../attendance/page.tsx` |
| Nav wiring | `components/shared/top-nav.tsx`, `components/shared/sidebar.tsx` |
| Enum migration | `supabase/migrations/20260426000000_extend_notification_type.sql` |
