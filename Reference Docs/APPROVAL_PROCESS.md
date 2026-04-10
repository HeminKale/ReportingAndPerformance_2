# Approval Process - End to End Flow

## Overview

This document explains how approval works across the system for:

- Task submissions
- Late clock-in requests
- Leave requests

Approvals can be processed from either:

- Manager Panel (`/org/{orgSlug}/manager`)
- Notifications page (`/org/{orgSlug}/notifications`) for actionable notifications

Both paths update the same database records, so they stay in sync.

---

## Roles Involved

- **Employee**: submits tasks, late clock-in requests, and leave requests.
- **Manager/Admin (as manager)**: approves or rejects pending requests for direct reports.

Manager visibility is based on direct reporting:

- Employee record `users.manager_id` must match the approver's user id.

---

## Common Approval Pattern

Every approval flow follows the same pattern:

1. Employee submits a request (status becomes `pending`).
2. Manager gets a notification.
3. Manager reviews and approves/rejects from:
   - Manager Panel, or
   - Notifications page (if action buttons are shown).
4. System updates source table status and audit fields.
5. Employee receives result via updated UI state and notifications.

---

## 1) Task Approval Flow

### Employee Submission

From Tasks page:

1. Employee opens action menu on a task row.
2. Clicks **Submit Task**.
3. Fills modal (Completed/Pending with required comment/reason).
4. On submit:
   - `task_logs` upsert runs.
   - `verification_status` is set to `pending`.
   - `submitted_at` is captured.
   - Manager notification is created if `manager_id` exists.

### Manager Notification Created

Notification fields:

- `type = task_verification`
- `title = Task Submitted for Review`
- `metadata.actionable = true`
- `metadata.resource_type = task_log`
- `metadata.resource_id = <task_log_id>`

### Manager Approval

Manager can approve/reject via:

- **Manager Panel -> Task Verifications**, or
- **Notifications page** (Approve/Reject buttons on actionable notification)

Approval updates:

- `task_logs.verification_status = approved | rejected`
- `task_logs.verified_by = <manager_id>`
- `task_logs.verified_at = <timestamp>`

On notification action path:

- Actioned notification is removed from current notification list.

### Employee Result

- Employee task status updates from `Pending Approval` to `Completed` or `Rejected`.
- Task placement in Current/History follows Tasks page lifecycle rules.

---

## 2) Late Clock-In Approval Flow

### Employee Submission

When employee clocks in after cutoff:

1. Late reason dialog is shown.
2. Submission creates `attendance` row with:
   - `is_late_request = true`
   - `approval_status = pending`
3. Manager notification created with:
   - `type = late_request`
   - actionable metadata:
     - `resource_type = attendance`
     - `resource_id = <attendance_id>`

### Manager Approval

From Manager Panel Attendance tab or Notifications actions:

- Approve/reject updates:
  - `attendance.approval_status = approved | rejected`
  - `attendance.approved_by = <manager_id>`
  - optional manager comment if provided via panel flow

---

## 3) Leave Approval Flow

### Employee Submission

On leave request:

1. Employee submits leave form.
2. `leaves.status = pending`.
3. Manager notification created with:
   - `type = leave_approval`
   - actionable metadata:
     - `resource_type = leave`
     - `resource_id = <leave_id>`

### Manager Approval

From Manager Panel Leaves tab or Notifications actions:

- Approve/reject updates:
  - `leaves.status = approved | rejected`
  - `leaves.approved_by = <manager_id>`
  - optional manager comment if provided via panel flow

---

## Manager Panel vs Notifications

### Manager Panel

- Primary review workspace.
- Shows pending queues by domain:
  - Tasks
  - Attendance
  - Leaves
- Supports richer review context.

### Notifications

- Alert + quick-action surface.
- Approve/reject directly for actionable manager notifications.
- Actioned items are removed from current notification list.

---

## Sync Guarantees

Both Manager Panel and Notifications update the same tables:

- `task_logs`
- `attendance`
- `leaves`

Because source-of-truth is shared, actions from either surface are reflected across the app.

---

## Troubleshooting Checklist

If manager cannot approve or employee status is not updating:

1. Confirm employee has correct `manager_id` in `users`.
2. Confirm request row exists with `pending` status in source table.
3. Confirm notification has actionable metadata (`resource_type`, `resource_id`).
4. Confirm manager is using:
   - Manager Panel action buttons, or
   - Notifications approve/reject buttons.
5. Refresh employee page after approval to verify updated state.

