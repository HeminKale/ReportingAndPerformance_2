/**
 * Dispatches manager periodic task templates into real `tasks` rows for each direct report.
 *
 * Schedule (recommended: at least hourly so org timezones line up with calendar days):
 * - Vercel: add to vercel.json `crons`: `{ "path": "/api/cron/periodic-tasks", "schedule": "0 * * * *" }`
 * - Or any scheduler: GET/POST with header `Authorization: Bearer <CRON_SECRET>`
 *
 * Example (local):
 *   curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/periodic-tasks
 *
 * Env: CRON_SECRET, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { getISOWeek, getISOWeekYear } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type PeriodicTask = {
  id: string;
  organization_id: string;
  manager_id: string;
  title: string;
  description: string | null;
  type: "daily" | "weekly" | "monthly";
  day_of_week: number | null;
  monthly_day: number | null;
  is_numeric_task: boolean;
  numeric_unit: string | null;
  linked_monthly_task_id: string | null;
  linked_monthly_periodic_id?: string | null;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function orgLocalCalendar(isoUtc: Date, timeZone: string) {
  const z = toZonedTime(isoUtc, timeZone);
  const y = z.getFullYear();
  const m = z.getMonth() + 1;
  const d = z.getDate();
  const dow = z.getDay();
  const dateStr = `${y}-${pad2(m)}-${pad2(d)}`;
  const lastDayOfMonth = new Date(y, z.getMonth() + 1, 0).getDate();
  return { z, y, m, d, dow, dateStr, lastDayOfMonth };
}

function periodKeyForTemplate(
  template: PeriodicTask,
  cal: ReturnType<typeof orgLocalCalendar>
): string | null {
  if (template.type === "daily") {
    return cal.dateStr;
  }
  if (template.type === "weekly") {
    if (template.day_of_week == null) return null;
    if (cal.dow !== template.day_of_week) return null;
    const wy = getISOWeekYear(cal.z);
    const w = getISOWeek(cal.z);
    return `${wy}-W${pad2(w)}`;
  }
  if (template.type === "monthly") {
    if (template.monthly_day == null) return null;
    const effective = Math.min(template.monthly_day, cal.lastDayOfMonth);
    if (cal.d !== effective) return null;
    return `${cal.y}-${pad2(cal.m)}`;
  }
  return null;
}

function monthlyDueDateString(cal: ReturnType<typeof orgLocalCalendar>, monthlyDay: number) {
  const effective = Math.min(monthlyDay, cal.lastDayOfMonth);
  return `${cal.y}-${pad2(cal.m)}-${pad2(effective)}`;
}

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (bearer && bearer === secret) return true;
  const header = request.headers.get("x-cron-secret");
  return header === secret;
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

async function handle(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const supabase = createClient(url, serviceKey);
  const now = new Date();

  const { data: templates, error: tErr } = await supabase
    .from("manager_periodic_tasks")
    .select("*")
    .eq("is_enabled", true);

  if (tErr) {
    return NextResponse.json({ error: tErr.message }, { status: 500 });
  }

  const list = (templates || []) as PeriodicTask[];
  /** Materialize monthlies before dailies so daily rows can resolve linked_monthly_periodic_id. */
  const typeRank: Record<PeriodicTask["type"], number> = { monthly: 0, weekly: 1, daily: 2 };
  list.sort((a, b) => typeRank[a.type] - typeRank[b.type]);

  const orgIds = [...new Set(list.map((t) => t.organization_id))];
  const { data: orgRows } = await supabase.from("organizations").select("id, timezone").in("id", orgIds);

  const tzByOrg: Record<string, string> = {};
  for (const o of orgRows || []) {
    tzByOrg[o.id] = o.timezone || "UTC";
  }

  let templatesProcessed = 0;
  let taskRowsCreated = 0;
  let skipped = 0;

  for (const template of list) {
    const tz = tzByOrg[template.organization_id] || "UTC";
    const cal = orgLocalCalendar(now, tz);
    const periodKey = periodKeyForTemplate(template, cal);
    if (!periodKey) {
      skipped++;
      continue;
    }

    const { data: existing } = await supabase
      .from("manager_periodic_dispatches")
      .select("id")
      .eq("manager_periodic_task_id", template.id)
      .eq("period_key", periodKey)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    const { data: members, error: mErr } = await supabase
      .from("users")
      .select("id")
      .eq("manager_id", template.manager_id)
      .eq("organization_id", template.organization_id);

    if (mErr || !members?.length) {
      skipped++;
      continue;
    }

    const dueDate =
      template.type === "monthly" && template.monthly_day != null
        ? monthlyDueDateString(cal, template.monthly_day)
        : null;

    const rows = await Promise.all(
      members.map(async (u) => {
        let linkedMonthlyTaskId: string | null = null;
        if (template.type === "daily" && template.is_numeric_task) {
          if (template.linked_monthly_task_id) {
            linkedMonthlyTaskId = template.linked_monthly_task_id;
          } else if (template.linked_monthly_periodic_id) {
            const monthlyTpl = list.find((t) => t.id === template.linked_monthly_periodic_id);
            if (monthlyTpl?.type === "monthly" && monthlyTpl.monthly_day != null) {
              const monthlyDue = monthlyDueDateString(cal, monthlyTpl.monthly_day);
              const { data: mtRow } = await supabase
                .from("tasks")
                .select("id")
                .eq("organization_id", template.organization_id)
                .eq("assigned_to", u.id)
                .eq("type", "monthly")
                .eq("source_manager_periodic_task_id", monthlyTpl.id)
                .eq("due_date", monthlyDue)
                .maybeSingle();
              linkedMonthlyTaskId = mtRow?.id ?? null;
            }
          }
        }

        return {
          organization_id: template.organization_id,
          title: template.title,
          description: template.description,
          type: template.type,
          day_of_week: template.type === "weekly" ? template.day_of_week : null,
          due_date: dueDate,
          assigned_by: template.manager_id,
          assigned_to: u.id,
          is_common_task: false,
          is_active: true,
          is_numeric_task: template.is_numeric_task,
          numeric_unit: template.is_numeric_task ? template.numeric_unit : null,
          linked_monthly_task_id: linkedMonthlyTaskId,
          source_manager_periodic_task_id: template.id,
        };
      })
    );

    const { error: insErr } = await supabase.from("tasks").insert(rows);
    if (insErr) {
      console.error("[cron/periodic-tasks] task insert failed", template.id, insErr);
      skipped++;
      continue;
    }

    const { error: dispErr } = await supabase.from("manager_periodic_dispatches").insert({
      manager_periodic_task_id: template.id,
      period_key: periodKey,
    });

    if (dispErr) {
      console.error("[cron/periodic-tasks] dispatch log failed", template.id, dispErr);
      skipped++;
      continue;
    }

    templatesProcessed++;
    taskRowsCreated += rows.length;
  }

  return NextResponse.json({
    ok: true,
    templatesProcessed,
    taskRowsCreated,
    skipped,
    at: now.toISOString(),
  });
}
