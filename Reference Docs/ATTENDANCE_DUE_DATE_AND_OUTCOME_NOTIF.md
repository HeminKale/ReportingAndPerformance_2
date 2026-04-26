# Attendance rejection, manager outcome notifications, and task due dates

This document records the implementation that matches the product plan: rejected late/early requests, manager comments on clock-in/clock-out and leave **outcome** notifications, and **due date** for one-off **weekly** and **monthly** tasks (not **daily**).

## 1. Rejected late/early (employee UI)

**File:** `app/org/[orgSlug]/attendance/page.tsx`

| Requirement | Implementation |
|-------------|----------------|
| Do not treat rejected request as a normal “success” clock-in | Uses amber **Attendance not accepted** block with `AlertTriangle` when `is_late_request && approval_status === 'rejected'`. |
| Block clock out | `clockOutDisabledByApproval` disables the button for **pending** or **rejected** late/early. |
| Server-side guard | `handleClockOut` returns early if `is_late_request && approval_status === 'rejected'`. |
| Show employee and manager text | **Your request:** `late_reason` (when present). **Manager comment:** `manager_comment` (when present). |

**Not implemented (optional / future):** Clearing `clock_in_time` / `clock_out_time` in the database when a manager rejects; **recall** action in the manager panel to reset the day and allow a new request. Both were described as optional or follow-up in the plan.

## 2. Manager outcome → employee notifications

**File:** `app/org/[orgSlug]/manager/page.tsx` — `handleAction` for `attendance` and `leave`

| Field | Attendance | Leave |
|--------|------------|--------|
| `link` | `/org/{orgSlug}/attendance` | `/org/{orgSlug}/leaves` |
| `metadata` | `actionable: false`, `resource_type: "attendance"`, `resource_id`, `manager_comment` | same pattern with `resource_type: "leave"` |
| Titles / copy | Distinguishes **early clock-out** vs **late clock-in** when the row has both `clock_in_time` and `clock_out_time` (early path) | `Leave … Approved` / `Rejected` |

`requestNotificationsBellRefresh()` runs after the employee notification insert so the **bell** count can update without relying on Realtime alone.

**Consumer:** `app/org/[orgSlug]/notifications/page.tsx` — `getCommentModalPayload` reads `metadata.manager_comment` and shows **View comments** (alongside **View details** when `link` is set).

**Styling:** `getNotificationColor` includes `task_approved`, `task_rejected`, `task_recalled`, and the other types used in-app (see migration `20260426120000_task_recalled_notification_types.sql` if you extend the enum in Supabase).

## 3. Task due date (once, non-daily)

**Data:** `tasks.due_date` (nullable date). No extra migration if the column already exists from the initial schema.

**File:** `components/shared/task-assignment-panel.tsx`

- **Form:** **Due date** (required) for **weekly** and **monthly**; hidden for **daily**; `dueDate` is cleared when switching type to **daily** (`onValueChange` on type select).
- **Validation:** `validateBeforeSave` requires a non-empty due date for weekly and monthly.
- **Persist:** Create/update set `due_date` for weekly+monthly; set `null` for daily.
- **Manager lists:** **Due** column in current/history/admin group tables; helper `taskDueCellText` shows **—** for daily.
- **Expanded task detail** shows `Due: {date}` when `due_date` is set and `type !== 'daily'`.

**File:** `components/tasks/task-table.tsx` (Tasks tab / top nav)

- **Due** column after **Task description**; **—** for daily; formatted date for weekly/monthly when `due_date` is set.
- Empty state `colSpan` matches column count (7).

## 4. Verification checklist

- [x] After manager rejects a late/early line, employee sees a clear non-success state, clock out is disabled (when not yet clocked out), and `late_reason` / `manager_comment` are visible on the day card.
- [x] Employee notification after approve/reject for attendance/leave includes `link` and `metadata.manager_comment`; **View comments** works in the notifications inbox.
- [x] Weekly and monthly (once) tasks require and store **due date**; daily does not show a meaningful due in the task tables.
- [x] Bell refresh after manager inserts to employees (`requestNotificationsBellRefresh`).

## 5. Files touched (reference)

| Area | Files |
|------|--------|
| Attendance today card | `app/org/[orgSlug]/attendance/page.tsx` |
| Manager approvals → notifications | `app/org/[orgSlug]/manager/page.tsx` |
| Bell refresh helper | `lib/notifications/refresh-bell.ts` (used from manager) |
| Task assignment + org tables | `components/shared/task-assignment-panel.tsx` |
| Employee task table | `components/tasks/task-table.tsx` |
| Inbox / comments modal | `app/org/[orgSlug]/notifications/page.tsx` |
| Broader notif + bell | `Reference Docs/NOTIFICATIONS_AND_BELL.md` |
