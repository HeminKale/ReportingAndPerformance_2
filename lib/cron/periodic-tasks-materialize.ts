import type { SupabaseClient } from "@supabase/supabase-js";
import { getISOWeek, getISOWeekYear } from "date-fns";
import { toZonedTime } from "date-fns-tz";

export type PeriodicTaskTemplate = {
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
  assigned_user_ids?: string[] | null;
  is_enabled?: boolean;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function orgLocalCalendar(isoUtc: Date, timeZone: string) {
  const z = toZonedTime(isoUtc, timeZone);
  const y = z.getFullYear();
  const m = z.getMonth() + 1;
  const d = z.getDate();
  const dow = z.getDay();
  const dateStr = `${y}-${pad2(m)}-${pad2(d)}`;
  const lastDayOfMonth = new Date(y, z.getMonth() + 1, 0).getDate();
  return { z, y, m, d, dow, dateStr, lastDayOfMonth };
}

export function periodKeyForTemplate(
  template: PeriodicTaskTemplate,
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

export function monthlyDueDateString(cal: ReturnType<typeof orgLocalCalendar>, monthlyDay: number) {
  const effective = Math.min(monthlyDay, cal.lastDayOfMonth);
  return `${cal.y}-${pad2(cal.m)}-${pad2(effective)}`;
}

const typeRank: Record<PeriodicTaskTemplate["type"], number> = { monthly: 0, weekly: 1, daily: 2 };

function sortTemplatesForDispatch(list: PeriodicTaskTemplate[]) {
  return [...list].sort((a, b) => typeRank[a.type] - typeRank[b.type]);
}

/** Include monthly template id when a daily numeric row needs it materialized first. */
export function expandMaterializeSeedIds(target: PeriodicTaskTemplate): Set<string> {
  const s = new Set<string>([target.id]);
  if (target.type === "daily" && target.is_numeric_task && target.linked_monthly_periodic_id) {
    s.add(target.linked_monthly_periodic_id);
  }
  return s;
}

export type MaterializePeriodicResult = {
  templatesProcessed: number;
  taskRowsCreated: number;
  skipped: number;
};

/**
 * Materialize enabled periodic templates into `tasks` + `manager_periodic_dispatches`.
 * When `onlyMaterializeIds` is set, only those template rows are considered for insert (others in `templates` are only used for e.g. linked_monthly_periodic resolution).
 */
export async function materializePeriodicTemplates(
  supabase: SupabaseClient,
  options: {
    templates: PeriodicTaskTemplate[];
    now?: Date;
    onlyMaterializeIds?: Set<string>;
  }
): Promise<MaterializePeriodicResult> {
  const now = options.now ?? new Date();
  const only = options.onlyMaterializeIds;

  const list = sortTemplatesForDispatch(
    options.templates.filter((t) => t.is_enabled !== false)
  );

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
    if (only && !only.has(template.id)) {
      continue;
    }

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

    let members: { id: string }[];

    if (template.assigned_user_ids && template.assigned_user_ids.length > 0) {
      const { data: assignedMembers, error: mErr } = await supabase
        .from("users")
        .select("id")
        .in("id", template.assigned_user_ids)
        .eq("manager_id", template.manager_id)
        .eq("organization_id", template.organization_id);

      if (mErr || !assignedMembers?.length) {
        skipped++;
        continue;
      }
      members = assignedMembers;
    } else {
      const { data: allMembers, error: mErr } = await supabase
        .from("users")
        .select("id")
        .eq("manager_id", template.manager_id)
        .eq("organization_id", template.organization_id);

      if (mErr || !allMembers?.length) {
        skipped++;
        continue;
      }
      members = allMembers;
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
      console.error("[periodic-tasks-materialize] task insert failed", template.id, insErr);
      skipped++;
      continue;
    }

    const { error: dispErr } = await supabase.from("manager_periodic_dispatches").insert({
      manager_periodic_task_id: template.id,
      period_key: periodKey,
    });

    if (dispErr) {
      console.error("[periodic-tasks-materialize] dispatch log failed", template.id, dispErr);
      skipped++;
      continue;
    }

    templatesProcessed++;
    taskRowsCreated += rows.length;
  }

  return { templatesProcessed, taskRowsCreated, skipped };
}
