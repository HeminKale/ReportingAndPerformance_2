"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EmployeeCalendarPanel } from "@/components/calendar/employee-calendar-panel";

export default function CalendarPage() {
  const [subjectUserId, setSubjectUserId] = useState<string | null>(null);
  const [bootLoading, setBootLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!cancelled) {
        setSubjectUserId(authUser?.id ?? null);
        setBootLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (bootLoading) {
    return (
      <div className="option-surface min-h-screen p-6 md:p-8">
        <div className="mx-auto max-w-7xl space-y-4">
          <div className="h-8 w-1/4 rounded-lg bg-muted" />
          <div className="h-[min(70vh,640px)] rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }

  if (!subjectUserId) {
    return (
      <div className="option-surface min-h-screen p-6 md:p-8">
        <p className="text-muted-foreground">Sign in to view your calendar.</p>
      </div>
    );
  }

  return (
    <div className="option-surface flex min-h-screen flex-1 flex-col p-4 md:p-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-4">
        <h1 className="shrink-0 text-3xl font-bold tracking-tight">Calendar</h1>

        <div className="w-full min-h-[calc(100dvh-7.5rem)] flex-1 md:min-h-[calc(100dvh-6.5rem)]">
          <EmployeeCalendarPanel subjectUserId={subjectUserId} />
        </div>
      </div>
    </div>
  );
}
