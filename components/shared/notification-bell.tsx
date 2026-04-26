"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import {
  NOTIFICATIONS_BELL_REFRESH_EVENT,
} from "@/lib/notifications/refresh-bell";

interface NotificationBellProps {
  userId: string;
  orgSlug: string;
}

export function NotificationBell({ userId, orgSlug }: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const fetchUnreadCount = useCallback(async () => {
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    setUnreadCount(count ?? 0);
  }, [supabase, userId]);

  useEffect(() => {
    void fetchUnreadCount();

    const onAppRefresh = () => {
      void fetchUnreadCount();
    };
    window.addEventListener(NOTIFICATIONS_BELL_REFRESH_EVENT, onAppRefresh);

    const channel = supabase
      .channel(`notification-bell-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener(NOTIFICATIONS_BELL_REFRESH_EVENT, onAppRefresh);
      void supabase.removeChannel(channel);
    };
  }, [userId, supabase, fetchUnreadCount]);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      onClick={() => router.push(`/org/${orgSlug}/notifications`)}
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <Badge
          variant="destructive"
          className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0"
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </Badge>
      )}
    </Button>
  );
}
