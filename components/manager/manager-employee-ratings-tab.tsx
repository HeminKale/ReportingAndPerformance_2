"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/lib/hooks/use-toast";
import { format, parse } from "date-fns";
import { Star, Trophy, Calendar as CalendarIconLucide } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { User, DailyPerformanceRating } from "@/lib/types/database";
import { DAILY_PERFORMANCE_OPTIONS } from "@/lib/types/database";

const NO_DAILY_PERFORMANCE_VALUE = "__no_daily_performance__";

type ManagerEmployeeRatingsTabProps = {
  currentUser: User;
  teamMembers: User[];
};

export function ManagerEmployeeRatingsTab({ currentUser, teamMembers }: ManagerEmployeeRatingsTabProps) {
  const { toast } = useToast();
  const supabase = createClient();
  const isAdmin = currentUser.role === "admin";

  /** For admins only: `null` until the org user list is loaded. Managers ignore this. */
  const [fetchedAdminUsers, setFetchedAdminUsers] = useState<User[] | null>(null);
  const orgUserListLoading = isAdmin && fetchedAdminUsers === null;

  const [ratingsMonth, setRatingsMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [ratingsEntries, setRatingsEntries] = useState<
    Array<{ userId: string; score: number | ""; notes: string }>
  >([]);
  const [publishingRatings, setPublishingRatings] = useState(false);

  const [ratingsSubTab, setRatingsSubTab] = useState<"monthly" | "daily">("monthly");
  const [ratingsDay, setRatingsDay] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [dailyRatingEntries, setDailyRatingEntries] = useState<
    Array<{ userId: string; performance: DailyPerformanceRating | ""; comments: string }>
  >([]);
  const [publishingDailyRatings, setPublishingDailyRatings] = useState(false);
  const [dailyCalendarOpen, setDailyCalendarOpen] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      setFetchedAdminUsers(null);
      return;
    }
    setFetchedAdminUsers(null);
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("organization_id", currentUser.organization_id)
        .order("full_name", { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error("[ManagerEmployeeRatingsTab] admin org users", error);
        setFetchedAdminUsers([]);
        return;
      }
      setFetchedAdminUsers((data as User[]) || []);
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, currentUser.organization_id, supabase]);

  const employees = useMemo(() => {
    if (isAdmin) {
      if (fetchedAdminUsers === null) return [];
      return fetchedAdminUsers.filter((u) => u.role !== "admin");
    }
    return teamMembers.filter((u) => u.role !== "admin");
  }, [isAdmin, teamMembers, fetchedAdminUsers]);

  const fetchRatings = useCallback(
    async (month: string, orgId: string, emps: User[]) => {
      const firstDay = `${month}-01`;
      const { data } = await supabase
        .from("leaderboard")
        .select("*")
        .eq("organization_id", orgId)
        .eq("month", firstDay);

      const ratingsByUser: Record<string, unknown> = {};
      for (const row of data || []) {
        const r = row as { user_id: string };
        ratingsByUser[r.user_id] = row;
      }

      setRatingsEntries(
        emps.map((u) => {
          const rec = ratingsByUser[u.id] as { score?: number; notes?: string | null } | undefined;
          return {
            userId: u.id,
            score: (rec?.score != null ? rec.score : "") as number | "",
            notes: rec?.notes ?? "",
          };
        })
      );
    },
    [supabase]
  );

  const fetchDailyRatings = useCallback(
    async (day: string, orgId: string, emps: User[]) => {
      const { data } = await supabase
        .from("leaderboard_daily")
        .select("*")
        .eq("organization_id", orgId)
        .eq("rating_date", day);

      const ratingsByUser: Record<string, { performance: DailyPerformanceRating; comments: string | null }> = {};
      for (const row of data || []) {
        const r = row as { user_id: string; performance: string; comments: string | null };
        ratingsByUser[r.user_id] = {
          performance: r.performance as DailyPerformanceRating,
          comments: r.comments,
        };
      }

      setDailyRatingEntries(
        emps.map((u) => ({
          userId: u.id,
          performance: ratingsByUser[u.id]?.performance ?? "",
          comments: ratingsByUser[u.id]?.comments ?? "",
        }))
      );
    },
    [supabase]
  );

  useEffect(() => {
    if (orgUserListLoading) return;
    if (employees.length === 0) {
      setRatingsEntries([]);
      return;
    }
    void fetchRatings(ratingsMonth, currentUser.organization_id, employees);
  }, [currentUser.organization_id, employees, fetchRatings, orgUserListLoading, ratingsMonth]);

  useEffect(() => {
    if (orgUserListLoading) return;
    if (employees.length === 0) {
      setDailyRatingEntries([]);
      return;
    }
    void fetchDailyRatings(ratingsDay, currentUser.organization_id, employees);
  }, [currentUser.organization_id, employees, fetchDailyRatings, orgUserListLoading, ratingsDay]);

  const handlePublishRatings = async () => {
    const validEntries = ratingsEntries.filter((e) => e.score !== "" && Number(e.score) > 0);
    if (validEntries.length === 0) {
      toast({ title: "No ratings entered", description: "Enter at least one score before publishing.", variant: "destructive" });
      return;
    }

    setPublishingRatings(true);
    try {
      const firstDay = `${ratingsMonth}-01`;
      const sorted = [...validEntries].sort((a, b) => Number(b.score) - Number(a.score));
      const rows = sorted.map((e, i) => ({
        user_id: e.userId,
        organization_id: currentUser.organization_id,
        month: firstDay,
        score: Number(e.score),
        rank: i + 1,
        notes: e.notes || null,
        decided_by: currentUser.id,
      }));

      const { error } = await supabase.from("leaderboard").upsert(rows, { onConflict: "user_id,month" });
      if (error) throw error;
      toast({ title: "Ratings published!", description: "Leaderboard has been updated." });
      void fetchRatings(ratingsMonth, currentUser.organization_id, employees);
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast({ title: "Error", description: err?.message || "Failed to publish", variant: "destructive" });
    } finally {
      setPublishingRatings(false);
    }
  };

  const handlePublishDailyRatings = async () => {
    const validEntries = dailyRatingEntries.filter((e) => e.performance !== "");
    if (validEntries.length === 0) {
      toast({
        title: "No daily ratings selected",
        description: "Choose a performance level for at least one employee before publishing.",
        variant: "destructive",
      });
      return;
    }

    setPublishingDailyRatings(true);
    try {
      const rows = validEntries.map((e) => ({
        user_id: e.userId,
        organization_id: currentUser.organization_id,
        rating_date: ratingsDay,
        performance: e.performance,
        comments: e.comments.trim() || null,
        decided_by: currentUser.id,
      }));
      const { error } = await supabase
        .from("leaderboard_daily")
        .upsert(rows, { onConflict: "organization_id,user_id,rating_date" });
      if (error) throw error;
      toast({ title: "Daily ratings published!", description: "The daily leaderboard has been updated." });
      void fetchDailyRatings(ratingsDay, currentUser.organization_id, employees);
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast({ title: "Error", description: err?.message || "Failed to publish", variant: "destructive" });
    } finally {
      setPublishingDailyRatings(false);
    }
  };

  if (orgUserListLoading) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-muted-foreground">Loading organisation members…</CardContent>
      </Card>
    );
  }

  const desc =
    isAdmin
      ? "Monthly scores (1–10) and daily performance apply to all non-admin members in your organisation."
      : "Monthly scores (1–10) and daily performance apply to your direct and indirect reports (admins are excluded from being rated).";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Employee ratings
        </CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <Tabs value={ratingsSubTab} onValueChange={(v) => setRatingsSubTab(v as "monthly" | "daily")}>
        <div className="px-6 pb-2">
          <TabsList>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="daily">Daily</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="monthly" className="space-y-0 mt-0">
          <CardContent className="pt-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 mb-4">
              <div className="flex items-center gap-3">
                <Label htmlFor="ratingsMonth" className="whitespace-nowrap">Month</Label>
                <Input
                  id="ratingsMonth"
                  type="month"
                  className="w-44"
                  value={ratingsMonth}
                  onChange={(e) => setRatingsMonth(e.target.value)}
                />
              </div>
            </div>
            {employees.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {isAdmin
                  ? "No employees to rate in this organisation."
                  : "No one in your team to rate. Assign people under you in the org chart, or ask an admin."}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="w-36">Score (1–10)</TableHead>
                    <TableHead>Custom message / notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ratingsEntries.map((entry) => {
                    const emp = employees.find((u) => u.id === entry.userId);
                    if (!emp) return null;
                    return (
                      <TableRow key={entry.userId}>
                        <TableCell className="font-medium">{emp.full_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{emp.role}</Badge>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            max={10}
                            step={1}
                            placeholder="–"
                            className="w-20"
                            value={entry.score}
                            onChange={(e) => {
                              const val =
                                e.target.value === ""
                                  ? ("" as const)
                                  : Math.min(10, Math.max(1, parseInt(e.target.value, 10)));
                              setRatingsEntries((prev) =>
                                prev.map((r) => (r.userId === entry.userId ? { ...r, score: val } : r))
                              );
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            placeholder="Optional message shown on leaderboard…"
                            value={entry.notes}
                            onChange={(e) =>
                              setRatingsEntries((prev) =>
                                prev.map((r) => (r.userId === entry.userId ? { ...r, notes: e.target.value } : r))
                              )
                            }
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
          {employees.length > 0 && (
            <div className="px-6 pb-6 flex justify-end">
              <Button onClick={handlePublishRatings} disabled={publishingRatings} className="gap-2">
                <Trophy className="h-4 w-4" />
                {publishingRatings ? "Publishing…" : "Publish monthly ratings"}
              </Button>
            </div>
          )}
        </TabsContent>
        <TabsContent value="daily" className="space-y-0 mt-0">
          <CardContent className="pt-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 mb-4">
              <Popover open={dailyCalendarOpen} onOpenChange={setDailyCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-auto justify-start text-left font-normal">
                    <CalendarIconLucide className="mr-2 h-4 w-4" />
                    {format(parse(ratingsDay, "yyyy-MM-dd", new Date()), "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={parse(ratingsDay, "yyyy-MM-dd", new Date())}
                    onSelect={(d) => {
                      if (d) {
                        setRatingsDay(format(d, "yyyy-MM-dd"));
                        setDailyCalendarOpen(false);
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            {employees.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {isAdmin
                  ? "No employees to rate in this organisation."
                  : "No one in your team to rate. Assign people under you in the org chart, or ask an admin."}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="min-w-[180px]">Performance</TableHead>
                    <TableHead>Comments</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyRatingEntries.map((entry) => {
                    const emp = employees.find((u) => u.id === entry.userId);
                    if (!emp) return null;
                    return (
                      <TableRow key={entry.userId}>
                        <TableCell className="font-medium">{emp.full_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{emp.role}</Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={entry.performance === "" ? NO_DAILY_PERFORMANCE_VALUE : entry.performance}
                            onValueChange={(v) =>
                              setDailyRatingEntries((prev) =>
                                prev.map((r) =>
                                  r.userId === entry.userId
                                    ? {
                                        ...r,
                                        performance: v === NO_DAILY_PERFORMANCE_VALUE ? "" : (v as DailyPerformanceRating),
                                      }
                                    : r
                                )
                              )
                            }
                          >
                            <SelectTrigger className="w-full max-w-[220px]">
                              <SelectValue placeholder="Select level" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NO_DAILY_PERFORMANCE_VALUE}>—</SelectItem>
                              {DAILY_PERFORMANCE_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            placeholder="Optional comments…"
                            value={entry.comments}
                            onChange={(e) =>
                              setDailyRatingEntries((prev) =>
                                prev.map((r) => (r.userId === entry.userId ? { ...r, comments: e.target.value } : r))
                              )
                            }
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
          {employees.length > 0 && (
            <div className="px-6 pb-6 flex justify-end">
              <Button onClick={handlePublishDailyRatings} disabled={publishingDailyRatings} className="gap-2">
                <Star className="h-4 w-4" />
                {publishingDailyRatings ? "Publishing…" : "Publish daily ratings"}
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
}
