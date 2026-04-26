import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { runDailyGamificationClose } from "@/lib/gamification/daily-close";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabaseAuth = await createClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { attendanceId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const attendanceId = body.attendanceId;
  if (!attendanceId || typeof attendanceId !== "string") {
    return NextResponse.json({ error: "attendanceId required" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const admin = createAdminClient(url, serviceKey);

  const { data: att, error: aErr } = await admin.from("attendance").select("*").eq("id", attendanceId).maybeSingle();
  if (aErr || !att) {
    return NextResponse.json({ error: "Attendance not found" }, { status: 404 });
  }
  if (att.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!att.clock_in_time || !att.clock_out_time) {
    return NextResponse.json({ error: "Clock in/out must be complete" }, { status: 400 });
  }

  const { data: profile } = await admin.from("users").select("timezone").eq("id", user.id).maybeSingle();
  const timezone = profile?.timezone || "Asia/Kolkata";

  const result = await runDailyGamificationClose(admin, {
    userId: att.user_id,
    organizationId: att.organization_id,
    attendanceId: att.id,
    dateStr: att.date,
    timezone,
    clockInTime: att.clock_in_time,
    clockOutTime: att.clock_out_time,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    skipped: result.skipped,
    duplicate: result.duplicate,
    streakOk: result.streakOk,
    xpDelta: result.xpDelta,
  });
}
