"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EnquiriesTab } from "@/components/tasks/enquiries-tab";
import type { User } from "@/lib/types/database";

export default function EnquiriesPage() {
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
      <div className="option-panel rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">Enquiries</p>
        <p className="mt-1 text-sm text-slate-600">Track new and renewal enquiries.</p>
      </div>
      <EnquiriesTab user={user} />
    </div>
  );
}
