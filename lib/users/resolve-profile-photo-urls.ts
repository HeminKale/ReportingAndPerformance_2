import type { SupabaseClient } from "@supabase/supabase-js";

const AVATAR_BUCKET = "employee-documents";
/** Match dashboard signed URL lifetime (7 days). */
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 7;

export type AvatarSource = { id: string; avatar_url: string | null };

/**
 * Build a map of user id → displayable photo URL from `users.avatar_url`
 * (storage path or legacy full URL). Requires storage SELECT for org profile photos.
 */
export async function resolveProfilePhotoUrls(
  supabase: SupabaseClient,
  users: AvatarSource[]
): Promise<Record<string, string>> {
  const map: Record<string, string> = {};

  await Promise.all(
    users.map(async (user) => {
      const raw = user.avatar_url?.trim();
      if (!raw) return;

      if (raw.startsWith("http://") || raw.startsWith("https://")) {
        map[user.id] = raw;
        return;
      }

      const { data, error } = await supabase.storage
        .from(AVATAR_BUCKET)
        .createSignedUrl(raw, SIGNED_URL_SECONDS);

      if (!error && data?.signedUrl) {
        map[user.id] = data.signedUrl;
      }
    })
  );

  return map;
}

export function dicebearAvatarUrl(seed: string) {
  return `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(seed)}`;
}
