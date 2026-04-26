import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Mark unread notifications for this user that point at a specific resource
 * (task_log, attendance, leave) as read. Used when the manager approves from
 * Manager Panel so the bell count drops in sync with the notification inbox.
 */
export async function markResourceNotificationsRead(
  supabase: SupabaseClient,
  userId: string,
  resourceType: string,
  resourceId: string
): Promise<void> {
  const { data: rows, error: selErr } = await supabase
    .from("notifications")
    .select("id, metadata")
    .eq("user_id", userId)
    .eq("is_read", false);
  if (selErr) {
    console.warn("[markResourceNotificationsRead] select", selErr.message);
    return;
  }
  const wantType = resourceType;
  const wantId = String(resourceId);
  const ids = (rows || [])
    .filter((r) => {
      const m = r.metadata as Record<string, unknown> | null | undefined;
      if (m?.resource_type !== wantType) return false;
      const rid = m?.resource_id;
      if (rid == null) return false;
      return String(rid) === wantId;
    })
    .map((r) => r.id);
  if (ids.length === 0) return;
  const { error: upErr } = await supabase.from("notifications").update({ is_read: true }).in("id", ids);
  if (upErr) {
    console.warn("[markResourceNotificationsRead] update", upErr.message);
  }
}
