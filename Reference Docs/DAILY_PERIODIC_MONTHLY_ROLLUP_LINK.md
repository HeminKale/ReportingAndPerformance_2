# Daily periodic numeric → monthly rollup link

## Purpose

Managers can define **daily numeric** periodic templates that roll up into a **monthly** target. There are two ways to express that target:

1. **Fixed task row** — `linked_monthly_task_id` points at a concrete row in `tasks` (existing behavior).
2. **Monthly periodic template** — `linked_monthly_periodic_id` points at a `manager_periodic_tasks` row of type `monthly`. The cron job resolves that to the correct per-employee `tasks.id` when it materializes each day’s row.

The app keeps **at most one** of these links set; the UI enforces mutual exclusion.

## Database

Migration file in the repo:

- `supabase/migrations/20260412100000_periodic_monthly_template_link.sql`

It adds:

| Table | Column | Meaning |
|--------|--------|--------|
| `tasks` | `source_manager_periodic_task_id` | UUID FK to `manager_periodic_tasks`. Set on every task row created by the periodic-tasks cron from a template. Used to find “this employee’s monthly row for this template and month.” |
| `manager_periodic_tasks` | `linked_monthly_periodic_id` | UUID FK to `manager_periodic_tasks` (the monthly template). Only meaningful for **daily + numeric** templates. Resolved at cron time into `tasks.linked_monthly_task_id`. |

Apply the migration in Supabase (CLI or SQL Editor) before relying on the new behavior.

## Cron (`/api/cron/periodic-tasks`)

**File:** `app/api/cron/periodic-tasks/route.ts`

1. **Processing order** — Enabled templates are sorted **monthly → weekly → daily** so that, within a single run, monthly rows are usually inserted before daily rows that might need to resolve a `linked_monthly_periodic_id`.

2. **Tagging** — Each inserted `tasks` row includes `source_manager_periodic_task_id = <that template’s id>` (daily, weekly, and monthly templates).

3. **Daily + numeric — `linked_monthly_task_id` on the template** — If set, the cron **copies it through** to every generated daily row (same as before). No lookup.

4. **Daily + numeric — `linked_monthly_periodic_id` on the template** — For each direct report, the cron looks up a `tasks` row where:

   - `organization_id` matches  
   - `assigned_to` = that user  
   - `type = 'monthly'`  
   - `source_manager_periodic_task_id` = the **monthly template’s** id  
   - `due_date` = this month’s effective due date (same calendar rules as monthly template `monthly_day`, including end-of-month clamping)

   If a row exists, its `id` is written to the new daily row’s `linked_monthly_task_id`. If not (e.g. before the monthly due day in the org timezone), `linked_monthly_task_id` stays **null** until a later cron run after the monthly task exists.

## Manager UI

**Files:**

- `app/org/[orgSlug]/manager/page.tsx` — Builds `monthlyPeriodicNumericLinkOptions` (enabled monthly numeric periodic templates for the current manager) and passes them into `TaskAssignmentPanel`.
- `components/shared/task-assignment-panel.tsx` — Prop `monthlyPeriodicLinkOptions` (optional; admin settings uses `[]`).
- `components/shared/manager-periodic-tasks-tab.tsx` — Single **“Link to monthly rollup”** control: grouped options for **monthly task rows** vs **monthly periodic templates**. Choosing one clears the other in the form; save sends the correct pair of DB columns.

**Types:** `lib/types/database.ts` — `Task.source_manager_periodic_task_id`, `ManagerPeriodicTask.linked_monthly_periodic_id`.

## Edge cases and expectations

- **Before monthly due date in the month** — Daily rows may be created with `linked_monthly_task_id` null until the monthly template has run for that period; later cron runs do not retroactively patch old daily rows unless you add separate logic.
- **Disabled monthly template** — It is not in the enabled template list the cron loads, but stored `linked_monthly_periodic_id` still references it; resolution uses the template id and `tasks` rows already created with that `source_manager_periodic_task_id`.
- **Both link columns set in DB (bad data)** — Cron prefers **`linked_monthly_task_id`** on the template over `linked_monthly_periodic_id`. The edit form prefers showing the task link if both exist.

## Manual verification

1. Run migration on Supabase.
2. Create an **enabled** monthly numeric periodic template (note `monthly_day`).
3. Create a **daily** numeric periodic template; link it to that **monthly periodic template** (not a raw task).
4. After the monthly due day (in org timezone), trigger the cron so the monthly tasks exist for each direct report.
5. On a daily run day, trigger the cron again and confirm new daily `tasks` rows have `linked_monthly_task_id` pointing at the correct monthly row per `assigned_to`.
6. Regression: a daily template with only **`linked_monthly_task_id`** set should still copy that UUID to generated rows unchanged.

## Related env and scheduling

- Cron auth: `CRON_SECRET` (Bearer or `x-cron-secret`).
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

Recommended schedule: at least hourly so org timezones align with calendar days (see comments in the cron route file).
