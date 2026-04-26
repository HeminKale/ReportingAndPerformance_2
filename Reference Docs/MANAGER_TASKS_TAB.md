# Manager Panel — Tasks (Regular, Shared, History)

This document is the **canonical reference** for how task-related work is organized in the Manager Panel after the Tasks consolidation. It replaces older descriptions that referred to **"Today's Tasks"**, nested in-page tabs, and a separate **"Task Verifications"** tab.

| Area | Code (repo root: `ReportingAndPerformance_3/`) |
|------|------|
| Manager Tasks UI | `app/org/[orgSlug]/manager/page.tsx` |
| Shared numeric rollup | `components/manager/shared-numeric-tasks-accordion.tsx` |
| Shared grouping helpers | `lib/utils/shared-tasks.ts` |
| Task dialog (Frequency) | `components/shared/task-assignment-panel.tsx` |

---

## Navigation

1. In the **Manager Panel** left sidebar, select **Tasks** (internal tab value `manager-tasks`).
2. When **Tasks** is active, the sidebar shows indented items: **Regular**, **Shared**, and **History** (there is no second horizontal tab list in the main content for these three).
3. The main pane renders one view according to `tasksSubView`: `regular` | `shared` | `history`.
4. The **Tasks** row may show an amber **pending** pill: count of `task_logs` with `verification_status = 'pending'`, plus a neutral count for today's regular rows.

**There is no top-level "Task Verifications" tab.** Approvals happen under **Tasks → Regular**.

---

## Regular

**Purpose:** Same-day view of work **due today** for the team, derived from `teamTasks` with type rules (daily; weekly `day_of_week`; monthly `due_date` on `today`), with per-assignee status from today's `task_logs` when a log exists.

**Filters**

- Employee name (substring, case-insensitive)
- Task name (substring, case-insensitive)

**Frequency column**

- **Once** — `tasks` row has no `source_manager_periodic_task_id`.
- **Periodic** — row was materialized from a manager periodic template (`source_manager_periodic_task_id` set).

**Status**

- **Not Submitted** uses red badge styling (parallel tone to green for approved).
- **Pending approval:** chevron on the row expands **Approve** / **Reject** (same `actionDialog` + `handleAction` as the old verification tab; optional `manager_review_comment` on the log).

**Certificates**

- The "Number of certificates" chart block remains under **Regular** (collapsible).

---

## Shared

**Purpose:** Rollup for **numeric shared task groups** only.

**Task set:** `managedTeamTasks` — tasks assigned to users returned by `get_all_subordinates` for the current manager (same family as Task Assignment for that tree).

**Shared definition:** `identifySharedTasks(tasks, 2)` in `lib/utils/shared-tasks.ts` groups by `periodic:<template_id>` or `manual:<title>:<type>:<created_date>` and keeps groups with **at least two** assignees.

**Numeric-only:** the pane uses `identifySharedTasks(...).filter((g) => g.isNumeric)`. Non-numeric shared batches **do not** appear here; their `task_logs` still appear in **History**, and due rows can appear in **Regular**. The older matrix components `components/manager/shared-tasks-view.tsx` and `components/manager/shared-tasks-history-view.tsx` remain in the codebase but are **not** mounted on this manager flow.

**Filters**

- Employee name — filters rows in each accordion table.
- Task name — filters which **groups** (by title) are shown.

**UI**

- One `<details>` accordion per numeric shared **group**.
- **Period** select: **Current month** (columns: Employee, Today's count, count from month start through today, summing `numeric_value` on matching `task_logs`) or a **calendar year** (columns Jan–Dec, sum per month).
- Helpers: `findTaskRowForGroupMember`, `sumNumericLogsBetween`, `sumNumericLogsInMonth` in `lib/utils/shared-tasks.ts`.

---

## History

**Purpose:** Read-only list of **all** relevant `task_logs` for the manager's team, grouped by calendar day.

**Scope:** History is **not** "everything except shared numeric." It includes **numeric and non-numeric**, periodic and one-off, shared or not — every log row that passes the filters. Each assignee still has their own `task_id` on their log row.

**Filters**

- Employee name (`log.users.full_name`)
- Task name (`log.tasks.title`)
- **From** / **To** dates (inclusive). Same value in both fields = that single day.
- If both dates are empty: include logs with `getTaskDay(log) <= today` (no future days). If from/to are set, the log day must fall in that range (and still not after today).

`getTaskDay(log)` prefers `log.date`, else the calendar date of `log.created_at`.

---

## Task Assignment (separate sidebar entry)

Unchanged: opens **Task Assignment** with `TaskAssignmentPanel` in `components/shared/task-assignment-panel.tsx` (Current / History / Periodic for managers).

**Frequency (create/edit dialog):** read-only **Once** for new tasks and normal edits; **Periodic** when editing a row that has `source_manager_periodic_task_id`.

---

## Data: `task_logs`

`fetchData` in `app/org/[orgSlug]/manager/page.tsx` loads `task_logs` with `select *, tasks(*), users!user_id(*)` for all subordinate user IDs. History, pending counts, and Regular all use this pool.

---

## Related docs (may describe legacy UI)

- [`SHARED_TASKS_FEATURE.md`](SHARED_TASKS_FEATURE.md) — written for the older tab layout; see note at top of that file.
- [`APPROVAL_PROCESS.md`](APPROVAL_PROCESS.md) — task path: **Tasks → Regular**.
- [`MANAGER_PANEL_ENHANCEMENTS.md`](MANAGER_PANEL_ENHANCEMENTS.md) — older checklist.

**Prefer this document** for current Manager Panel Tasks behavior.
