"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Organization } from "@/lib/types/database";

export function useOrganization(orgSlug: string) {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchOrganization = async () => {
      const { data } = await supabase
        .from('organizations')
        .select('*')
        .eq('slug', orgSlug)
        .single();
      
      setOrganization(data);
      setLoading(false);
    };

    fetchOrganization();
  }, [orgSlug]);

  return { organization, loading };
}
