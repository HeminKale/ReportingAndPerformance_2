/**
 * Dispatches manager periodic task templates into real `tasks` rows for each direct report.
 *
 * Schedule:
 * - Vercel Hobby: at most **once per day** (see `vercel.json`; default `0 6 * * *` = 06:00 UTC daily). Hobby rejects hourly crons.
 * - Vercel Pro / other hosts: can use hourly (e.g. `0 * * * *`) for tighter alignment with each org's calendar day.
 * - Vercel: see `vercel.json` in the app root (`crons` → this path). Crons run on production only.
 * - CRON_SECRET: generate locally (e.g. `openssl rand -hex 32`), set in Vercel → Env → Production; Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
 * - Or any scheduler: GET/POST with header `Authorization: Bearer <CRON_SECRET>`
 *
 * Protected Vercel deployments (SSO): add header `x-vercel-protection-bypass: <secret>` from
 * Dashboard → Protection bypass for automation. See Reference Docs/PERIODIC_TASKS_ARCHITECTURE.md.
 *
 * Immediate assign on create: POST `/api/manager/periodic-tasks/materialize` (session) after save.
 *
 * Example (local):
 *   curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/periodic-tasks
 *
 * Example (protected production — both headers):
 *   curl -s -H "x-vercel-protection-bypass: $VERCEL_AUTOMATION_BYPASS_SECRET" -H "Authorization: Bearer $CRON_SECRET" 'https://YOUR.vercel.app/api/cron/periodic-tasks'
 *
 * Env: CRON_SECRET, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { materializePeriodicTemplates, type PeriodicTaskTemplate } from "@/lib/cron/periodic-tasks-materialize";

export const dynamic = "force-dynamic";

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

  const list = (templates || []) as PeriodicTaskTemplate[];

  const { templatesProcessed, taskRowsCreated, skipped } = await materializePeriodicTemplates(supabase, {
    templates: list,
    now,
  });

  return NextResponse.json({
    ok: true,
    templatesProcessed,
    taskRowsCreated,
    skipped,
    at: now.toISOString(),
  });
}
