import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabaseAuth = await createClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { leaderboardId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const leaderboardId = body.leaderboardId;
  if (!leaderboardId || typeof leaderboardId !== "string") {
    return NextResponse.json({ error: "leaderboardId required" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const admin = createAdminClient(url, serviceKey);

  const { data: entry, error: entryErr } = await admin
    .from("leaderboard")
    .select("id, user_id, rank")
    .eq("id", leaderboardId)
    .maybeSingle();

  if (entryErr || !entry) {
    return NextResponse.json({ error: "Leaderboard entry not found" }, { status: 404 });
  }

  if (entry.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (entry.rank !== 1) {
    return NextResponse.json({ error: "Only top performer entries can be marked seen" }, { status: 400 });
  }

  const { error: updateErr } = await admin
    .from("leaderboard")
    .update({ celebration_seen_at: new Date().toISOString() })
    .eq("id", leaderboardId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
