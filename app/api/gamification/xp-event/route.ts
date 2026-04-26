import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  applyEnquiryClosedWonXp,
  applyMistakeXp,
  applyTrainingCompletedXp,
} from "@/lib/gamification/xp-events";

export const dynamic = "force-dynamic";

type Body = { kind?: string; resourceId?: string };

export async function POST(request: Request) {
  const supabaseAuth = await createClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const kind = body.kind;
  const resourceId = body.resourceId;
  if (!kind || !resourceId) {
    return NextResponse.json({ error: "kind and resourceId required" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const admin = createAdminClient(url, serviceKey);

  if (kind === "mistake") {
    const { data: m } = await admin.from("mistakes").select("added_by").eq("id", resourceId).maybeSingle();
    if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (m.added_by !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const r = await applyMistakeXp(admin, resourceId);
    if (!r.ok) return NextResponse.json({ error: r.error ?? "apply failed" }, { status: 500 });
    return NextResponse.json({ ok: true, duplicate: r.duplicate });
  }

  if (kind === "training_completed") {
    const { data: t } = await admin.from("trainings").select("user_id").eq("id", resourceId).maybeSingle();
    if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (t.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const r = await applyTrainingCompletedXp(admin, resourceId);
    if (!r.ok) return NextResponse.json({ error: r.error ?? "apply failed" }, { status: 500 });
    return NextResponse.json({ ok: true, duplicate: r.duplicate });
  }

  if (kind === "enquiry_closed_won") {
    const { data: e } = await admin.from("enquiries").select("owner_id").eq("id", resourceId).maybeSingle();
    if (!e) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (e.owner_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const r = await applyEnquiryClosedWonXp(admin, resourceId);
    if (!r.ok) return NextResponse.json({ error: r.error ?? "apply failed" }, { status: 500 });
    return NextResponse.json({ ok: true, duplicate: r.duplicate });
  }

  return NextResponse.json({ error: "Unknown kind" }, { status: 400 });
}
