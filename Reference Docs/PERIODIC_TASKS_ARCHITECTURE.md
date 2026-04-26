# Periodic tasks — architecture and behavior

This document is the **canonical reference** for how manager periodic templates become employee `tasks`, how scheduling works, and what users should expect. Related docs: [Selective assignment](SELECTIVE_PERIODIC_TASK_ASSIGNMENT.md), [Daily → monthly rollup](DAILY_PERIODIC_MONTHLY_ROLLUP_LINK.md).

---

## Concepts

| Concept | Table / artifact | Role |
|--------|-------------------|------|
| **Template** | `manager_periodic_tasks` | Manager-defined schedule (daily / weekly / monthly), title, assignee rules, optional numeric + monthly link. |
| **Instance** | `tasks` | Real assignable row employees see. Created by **materialization** only. |
| **Dispatch log** | `manager_periodic_dispatches` | One row per `(manager_periodic_task_id, period_key)` so the same period is never inserted twice. |
| **Tag** | `tasks.source_manager_periodic_task_id` | Links instance back to the template (cron + instant path both set this). |

Saving a template **does not** by itself guarantee a row on the employee Tasks page until **materialization** runs for a matching **period**.

---

## Materialization engine (single code path)

Shared implementation:

- **`lib/cron/periodic-tasks-materialize.ts`** — `materializePeriodicTemplates(supabase, { templates, now?, onlyMaterializeIds? })`

Callers:

1. **`GET`/`POST` `/api/cron/periodic-tasks`** — `CRON_SECRET` (or `x-cron-secret`) auth, service-role Supabase, loads **all enabled** templates, materializes with **no** `onlyMaterializeIds` (full cron pass).
2. **`POST` `/api/manager/periodic-tasks/materialize`** — Session auth (manager/admin), template must belong to `auth.uid()` as `manager_id`. Service-role Supabase. Used **right after creating** an enabled template so the **current period** can appear immediately when it is due.

Both paths use the same rules: org timezone, `period_key`, members query, `tasks` insert, `manager_periodic_dispatches` insert.

**`onlyMaterializeIds` (bootstrap):** When set, only those template IDs are eligible for inserts in that run; other templates in the `templates` array are still present for resolution (e.g. daily numeric → `linked_monthly_periodic_id`). **`expandMaterializeSeedIds`** adds the linked **monthly template** id when a new **daily numeric** template references a monthly periodic template so monthly can run first in the same request when both are due.

---

## Timezone and “today”

All **period** decisions use **`organizations.timezone`** (fallback `UTC`) and `date-fns-tz` **`toZonedTime`** on the materialization `now` instant.

Employee UI “today” for submissions often uses the **browser local date** in places (e.g. `TaskLogDialog`); that can differ from org timezone near midnight. Cron/materialization is **org-local**.

---

## Period keys (idempotency)

| Template type | `period_key` | Materializes when (org-local) |
|---------------|--------------|-------------------------------|
| **Daily** | `YYYY-MM-DD` | Every calendar day (each day is a new key). |
| **Weekly** | `YYYY-Www` (ISO week) | Only on the configured **day of week** (JS: `0` = Sunday … `6` = Saturday). |
| **Monthly** | `YYYY-MM` | Only on the configured **day of month**, clamped to last day if needed (e.g. 31 → Feb 28/29). |

Processing order within one run: **monthly → weekly → daily** so daily rows can resolve `linked_monthly_periodic_id` after monthly instances exist.

---

## Scenarios (instant bootstrap + cron)

Assume template is **enabled** on create and **instant** `POST /api/manager/periodic-tasks/materialize` runs after save. **Edit** does not trigger instant materialize (only **create**).

1. **Daily periodic created (org-local “today”)**  
   - **Instant:** Inserts one `tasks` row per assignee for **today’s** `period_key`. Employees see it after refresh.  
   - **Tomorrow:** A **new** `tasks` row set is created on the next successful **cron** run when org-local date is tomorrow (new `period_key`). Each day is a **separate row** (same title, different `id` / `created_at`).  
   - **Every day:** Yes, **as long as** cron (or another scheduler) keeps calling `/api/cron/periodic-tasks` successfully and the template stays enabled.

2. **Today Sunday, weekly for Tuesday**  
   - **Instant:** No match (`cal.dow !== 2`) → **no rows**; toast explains current period not due.  
   - **First Tuesday:** Cron (or a later manual hit) creates rows for that ISO week.

3. **Today Sunday, weekly for Sunday**  
   - **Instant:** Match → rows for this **week** if dispatch not already logged.  
   - **Cron:** Skips same week once dispatch exists.

4. **Today 26th, monthly for the 29th**  
   - **Instant:** No match until org-local day is **29** (or month-end clamp) → **no rows** on the 26th.  
   - **On the 29th:** Materialization creates monthly instances; `period_key` is **`YYYY-MM`** (one dispatch per template per month).

5. **Today 26th, monthly for the 26th**  
   - **Instant:** Match → monthly `tasks` rows + dispatch for this month (if not already done).

---

## Employee experience

- **Tasks page** loads `tasks` for `assigned_to = me` (and common tasks). Periodic instances are normal `tasks` rows.  
- **Daily tab over time** may show **multiple rows** with the same title (one per materialized day).  
- **Calendar** due logic: see `lib/calendar/calendar-utils.ts` (`taskDueOnDay`).

---

## Vercel cron and Hobby plan

- **`vercel.json`** registers `/api/cron/periodic-tasks`.  
- **Hobby:** Vercel allows **at most one cron invocation per day**; the repo uses a **daily** schedule (default **`0 6 * * *`** — 06:00 UTC). Hourly expressions **fail** deploy on Hobby.  
- **Pro:** You may switch to hourly (e.g. `0 * * * *`) for tighter alignment with org-local “day” boundaries.  
- **Production only:** Vercel Cron runs against **production** deployments (not preview).  
- **`CRON_SECRET`:** Generate (e.g. `openssl rand -hex 32`), set in Vercel env; Vercel sends `Authorization: Bearer <CRON_SECRET>` on cron invocations. Same variable must match what the route checks.  
- **`SUPABASE_SERVICE_ROLE_KEY`** and **`NEXT_PUBLIC_SUPABASE_URL`:** Required on the server for cron and for **`/api/manager/periodic-tasks/materialize`**.

### Deployment protection (SSO / password) and bypass for automation

If the browser shows **“Authentication Required”** (Vercel) when opening the deployment, **unauthenticated** `curl` to `/api/cron/periodic-tasks` is blocked **before** your Next.js code runs. `CRON_SECRET` alone cannot fix that.

**Option A — [Protection bypass for automation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation)** (Vercel Dashboard → project → *Deployment Protection* / *Advanced* → add a bypass secret)

1. Create a bypass secret in the dashboard (Vercel may expose it as the system env **`VERCEL_AUTOMATION_BYPASS_SECRET`** on deployments—see [system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables#VERCEL_AUTOMATION_BYPASS_SECRET)).
2. For **manual `curl` or external schedulers** hitting a **protected** production URL, send **both**:
   - **`x-vercel-protection-bypass: <your-bypass-secret>`** (header or query param—[docs](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation))
   - **`Authorization: Bearer <CRON_SECRET>`** (your app’s check—[cron docs](https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs))

**Example `curl` (protected production):**

```bash
curl -s \
  -H "x-vercel-protection-bypass: $VERCEL_AUTOMATION_BYPASS_SECRET" \
  -H "Authorization: Bearer $CRON_SECRET" \
  'https://YOUR-PROJECT.vercel.app/api/cron/periodic-tasks'
```

Replace the first variable with the **same** secret value shown in the dashboard (or export it locally for testing). Query-param style is also supported if a tool cannot set headers:

`.../api/cron/periodic-tasks?x-vercel-protection-bypass=YOUR_SECRET`

**Option B — `vercel curl`** (CLI logged into the team): [Vercel CLI curl](https://vercel.com/docs/cli/curl) can reach protected deployments without hand-assembling the bypass.

**Option C — Do not protect production** (or only protect preview): simplest for cron, but weaker access control.

**Vercel-managed Cron:** After enabling bypass automation, confirm in **Cron Jobs → View logs** that invocations return **200** and JSON `{ "ok": true, ... }`. If they still show the auth HTML page, ensure bypass is enabled for the project and redeploy if Vercel requires it after rotating secrets.

**Plan note:** Protection bypass for automation is part of Vercel’s **Advanced Deployment Protection** offering; availability depends on your Vercel plan. If the UI shows an upgrade gate, use **Option B/C** or an external scheduler until bypass is available.

---

## Local development

`next dev` does **not** schedule cron. To materialize locally:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/periodic-tasks"
```

`.env.local` must define `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, and `NEXT_PUBLIC_SUPABASE_URL`.

---

## Failure modes (operations)

| Symptom | Likely cause |
|---------|----------------|
| No new daily rows | Cron not scheduled, wrong env, deployment protection, or template disabled / no assignees. |
| Duplicate rows same period | Rare: `tasks` insert succeeded but `manager_periodic_dispatches` insert failed; retry may insert again. Check server logs. |
| Instant assign failed but template saved | `materialize` API error (env, auth, network); cron may still fill later when due. |

---

## File index

| Area | Path |
|------|------|
| Materialize logic | `lib/cron/periodic-tasks-materialize.ts` |
| Cron route | `app/api/cron/periodic-tasks/route.ts` |
| Instant bootstrap API | `app/api/manager/periodic-tasks/materialize/route.ts` |
| Manager UI (create + fetch materialize) | `components/shared/manager-periodic-tasks-tab.tsx` |
| Vercel schedule | `vercel.json` |
| Schema + dispatch table | `supabase/migrations/20260411120000_manager_periodic_tasks.sql` |

---

*Last updated: adds Vercel **protection bypass for automation** (`x-vercel-protection-bypass` + `CRON_SECRET`), `vercel curl`, and plan notes.*
