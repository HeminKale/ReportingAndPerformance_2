"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { Megaphone, ChevronDown, ChevronUp, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { Announcement } from "@/lib/types/database";

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const supabase = createClient();

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: userData } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    const { data } = await supabase
      .from("announcements")
      .select("*")
      .eq("organization_id", userData?.organization_id)
      .order("created_at", { ascending: false });

    setAnnouncements((data as Announcement[]) || []);
    setLoading(false);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = announcements.filter((a) => {
    const q = searchTerm.toLowerCase();
    return (
      a.title.toLowerCase().includes(q) ||
      a.content.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Megaphone className="h-8 w-8 text-primary" />
          Announcements
        </h1>
        <p className="text-muted-foreground mt-1">Stay up to date with the latest news from your organisation.</p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search announcements…"
          className="pl-9"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border p-6 animate-pulse space-y-3">
              <div className="h-5 bg-muted rounded w-1/3" />
              <div className="h-4 bg-muted rounded w-1/5" />
              <div className="h-3 bg-muted rounded w-full" />
              <div className="h-3 bg-muted rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-16 text-center">
          <Megaphone className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
          <h3 className="text-lg font-semibold text-muted-foreground">
            {searchTerm ? "No announcements match your search" : "No announcements yet"}
          </h3>
          {!searchTerm && (
            <p className="text-sm text-muted-foreground mt-1">
              Check back later for updates from your admin.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((ann) => {
            const isExpanded = expandedIds.has(ann.id);
            return (
              <div
                key={ann.id}
                className="rounded-xl border bg-card transition-all hover:shadow-sm cursor-pointer"
                onClick={() => toggleExpand(ann.id)}
              >
                <div className="p-5">
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base leading-snug">{ann.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {format(new Date(ann.created_at), "dd MMM yyyy")}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-muted-foreground mt-0.5">
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </div>
                  </div>

                  {/* Preview when collapsed */}
                  {!isExpanded && (
                    <div
                      className="mt-3 text-sm text-muted-foreground line-clamp-2 prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: ann.content }}
                    />
                  )}

                  {/* Full content when expanded */}
                  {isExpanded && (
                    <div
                      className="mt-4 text-sm prose prose-sm max-w-none border-t pt-4"
                      dangerouslySetInnerHTML={{ __html: ann.content }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
