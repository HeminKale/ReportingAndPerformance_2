"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TrainingsTab } from "@/components/tasks/trainings-tab";
import type { User } from "@/lib/types/database";

export default function TrainingsPage() {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setLoading(false);
        return;
      }
      const { data: userData } = await supabase.from("users").select("*").eq("id", authUser.id).single();
      setUser(userData as User);
      setLoading(false);
    };
    void load();
  }, []);

  if (loading) {
    return (
      <div className="p-6 md:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-1/4 rounded bg-slate-200" />
          <div className="h-64 rounded bg-slate-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="option-surface space-y-4 p-6 md:p-8">
      <h1 className="text-2xl font-bold text-slate-900">Trainings</h1>

      <TrainingsTab user={user} />
    </div>
  );
}
