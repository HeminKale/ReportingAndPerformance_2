import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  expandMaterializeSeedIds,
  materializePeriodicTemplates,
  type PeriodicTaskTemplate,
} from "@/lib/cron/periodic-tasks-materialize";

export const dynamic = "force-dynamic";

/**
 * Materialize the current period for a periodic template the manager just saved (create),
 * so employees see tasks immediately. Idempotent with cron via `manager_periodic_dispatches`.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const templateId = typeof body?.templateId === "string" ? body.templateId : null;
    if (!templateId) {
      return NextResponse.json({ error: "templateId required" }, { status: 400 });
    }

    const supabaseAuth = await createClient();
    const {
      data: { user: authUser },
    } = await supabaseAuth.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: caller } = await supabaseAuth
      .from("users")
      .select("id, role")
      .eq("id", authUser.id)
      .single();

    if (!caller || (caller.role !== "manager" && caller.role !== "admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const supabase = createServiceClient(url, serviceKey);

    const { data: target, error: tErr } = await supabase
      .from("manager_periodic_tasks")
      .select("*")
      .eq("id", templateId)
      .maybeSingle();

    if (tErr || !target) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    if (target.manager_id !== authUser.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!target.is_enabled) {
      return NextResponse.json({
        ok: true,
        templatesProcessed: 0,
        taskRowsCreated: 0,
        skipped: 0,
        message: "Template disabled; nothing to materialize",
      });
    }

    const { data: contextRows, error: cErr } = await supabase
      .from("manager_periodic_tasks")
      .select("*")
      .eq("organization_id", target.organization_id)
      .eq("manager_id", target.manager_id)
      .eq("is_enabled", true);

    if (cErr) {
      return NextResponse.json({ error: cErr.message }, { status: 500 });
    }

    const templates = (contextRows || []) as PeriodicTaskTemplate[];
    const seedFull = expandMaterializeSeedIds(target as PeriodicTaskTemplate);
    const seed = new Set([...seedFull].filter((id) => templates.some((t) => t.id === id)));
    seed.add(target.id);

    const result = await materializePeriodicTemplates(supabase, {
      templates,
      now: new Date(),
      onlyMaterializeIds: seed,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
