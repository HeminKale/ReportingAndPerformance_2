# Calendar Feature (Employee View)

This document describes the **Calendar** page at `/org/[orgSlug]/calendar`: how it loads data, how each day is computed, and how it relates to leaves, tasks, and attendance.

## Source files

| File | Role |
|------|------|
| [`app/org/[orgSlug]/calendar/page.tsx`](../app/org/[orgSlug]/calendar/page.tsx) | Client page: data fetch, month grid, day cells, legend |
| [`app/org/[orgSlug]/calendar/calendar-utils.ts`](../app/org/[orgSlug]/calendar/calendar-utils.ts) | Pure helpers: due-day rules, log keys, incomplete labels, local time comparisons |

## What the calendar shows

For the signed-in employee, each day in the visible month can show:

1. **Approved leave** (only): if the day falls inside an approved leave range, **only** the leave stripe is shown. Clock-in/out and task stripes are hidden that day.
2. Otherwise, in vertical order:
   - **Clock-in** time (if an `attendance` row exists for that date)
   - **Incomplete tasks** summary (only when count is positive)
   - **Completed tasks** summary (only when count is positive)
   - **Clock-out** time (if `clock_out_time` is set)

## Data loading

All queries run in the browser via Supabase (`createClient()`), scoped to the current user and organization (RLS applies).

1. **`users`** – profile for `auth.uid()` (for `organization_id`, `timezone`).
2. **`organizations`** – `settings.clock_in_cutoff` (string like `09:15`; fallback `09:15` if missing).
3. **`tasks`** – same eligibility as the Tasks page:
   - `organization_id` matches the user’s org
   - `is_active = true`
   - `assigned_to = user` **or** `is_common_task = true`
4. **`task_logs`** – for that user, `task_id` in the loaded task ids, and `date` between the first and last day of the visible month (inclusive).
5. **`attendance`** – for that user, `date` in the same inclusive range.
6. **`leaves`** – approved only, overlapping the month:
   - `start_date <= last_day_of_month`
   - `end_date >= first_day_of_month`  
   (So cross-month leaves appear in every month they touch.)

## Task “due on this calendar day”

A task is **due** on day `D` only if:

- **`tasks.created_at`** (date part) is **on or before** `D` (tasks do not appear before they existed).
- Plus type-specific rules (calendar-specific; not the same as “due today” on the Manager Panel):
  - **Daily**: only on the **calendar date of `created_at`** (`yyyy-MM-dd` matches `D`). Status for that task is shown **only** that day, not on following days.
  - **Weekly**: only on days where `tasks.day_of_week === D.getDay()` (JavaScript: Sunday = 0), and still `D >=` created date. Each matching weekday in the month gets a stripe when that task is in scope.
  - **Monthly**: only on **`tasks.due_date`** when it equals `D` (`yyyy-MM-dd`), and still `D >=` created date. One stripe per month for that due date.

## Task status per day (historical snapshot)

Status for a given calendar day uses the **`task_logs` row for that business day**:

- Lookup key: `(task_id, date)` where `date` is `D` formatted as `yyyy-MM-dd`.
- This matches how submissions are stored from [`components/tasks/task-log-dialog.tsx`](../components/tasks/task-log-dialog.tsx) (`date` is the selected business day).

**Important:** If a task was pending on April 2 but later completed on April 4, **April 2** still reflects the log for `date = April 2` (e.g. still pending). Later days use their own `task_logs.date` rows.

### Completed vs incomplete (calendar counts)

- **Completed** (green stripe, included in “Completed: N”):  
  `task_logs.status === 'completed'` **and** `task_logs.verification_status === 'approved'`.

- **Incomplete** (red stripe): any due task on `D` that does **not** satisfy the completed rule above, including:
  - no log for that day
  - `status === 'pending'`
  - submitted as completed but `verification_status === 'pending'` (“pending approval”)
  - `verification_status === 'rejected'`

**Incomplete stripe label:**

- If every incomplete task shares the same “kind”, the stripe shows that label and count (for example `Pending approval: 2`, `Not submitted: 1`).
- If kinds are mixed, the stripe shows `Incomplete: N` and the hover panel lists each task.

Kinds map to labels in `calendar-utils.ts` (`INCOMPLETE_LABELS`).

## Attendance stripe colors

Times are formatted in the user’s **`users.timezone`** via [`lib/utils/timezone.ts`](../lib/utils/timezone.ts) (`formatInUserTimezone`).

- **Clock-in**
  - **Green** if local time of `clock_in_time` is **not after** `organizations.settings.clock_in_cutoff` (default `09:15`).
  - **Red** if local clock-in is **after** that cutoff.

- **Clock-out** (only evaluated when `clock_out_time` is present)
  - **Red** if either:
    - local clock-out is **strictly before** `17:00`, or
    - **any task due that day** is still **incomplete** (same incomplete definition as the task stripes).  
    This mirrors the idea behind clock-out validation on the Attendance page (incomplete daily work blocks clock-out), extended to all task types that are due that day.
  - **Green** otherwise.

## Hover panels

Hovering the **incomplete** or **completed** task stripe opens a small panel (positioned under the stripe) listing:

- Task title  
- A **daily / weekly / monthly** badge (`Badge` + task `type`)

The panel uses scroll when there are many tasks (`max-height` + `overflow-y-auto`). A short hide delay allows moving the pointer onto the panel without it disappearing immediately.

## UI and layout

- Page uses a wide max width (`max-w-[1600px]`) and taller day cells (`min-h-[140px]`) so stripes fit.
- Card/content use `overflow-visible` so hover panels are not clipped.
- Legend explains today, leave-only behavior, green/red meanings, and task hover behavior.

## Related features

- **Leaves**: [`app/org/[orgSlug]/leaves/page.tsx`](../app/org/[orgSlug]/leaves/page.tsx) – requests; calendar only shows **approved** leaves.
- **Tasks**: [`app/org/[orgSlug]/tasks/page.tsx`](../app/org/[orgSlug]/tasks/page.tsx) – task list and lifecycle; calendar reuses the same task query filter.
- **Attendance**: [`app/org/[orgSlug]/attendance/page.tsx`](../app/org/[orgSlug]/attendance/page.tsx) – clock-in/out source data for the calendar.
- **Approvals**: [`APPROVAL_PROCESS.md`](APPROVAL_PROCESS.md) – how logs and leaves become approved.

## Troubleshooting

- **Leave spans two months but only one month showed before**: the calendar uses an **overlap** filter on `leaves` (see above). If something still looks wrong, verify `start_date` / `end_date` and `status = approved` in the database.
- **Task counts do not match the Tasks page**: the calendar counts **per calendar day** and **per `task_logs.date`**; the Tasks page groups and filters differently (e.g. “current” vs “history”). Compare the same date and the same task’s log row for that `date`.
- **Daily task only appears on one day**: by design, **daily** tasks are scoped to the **`created_at` date** on the calendar. A `task_logs` row for another `date` does not move that stripe; status for the daily task is read from the log where `task_logs.date` equals the **creation date** (the cell where the task is shown).
- **Clock-in color unexpected**: confirm `users.timezone` and `organizations.settings.clock_in_cutoff`.

---

**Last updated:** April 2026  
