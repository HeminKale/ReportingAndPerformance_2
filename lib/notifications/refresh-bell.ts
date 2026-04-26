/** Dispatched on `window` when a screen updates notifications for the current user. */
export const NOTIFICATIONS_BELL_REFRESH_EVENT = "app:notifications-bell-refresh" as const;

/**
 * Tells the header `NotificationBell` to refetch unread count.
 * Use when rows change (e.g. `is_read` updates) in ways that may not fire
 * Realtime, or the client may miss the `postgres_changes` event.
 */
export function requestNotificationsBellRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(NOTIFICATIONS_BELL_REFRESH_EVENT));
}
