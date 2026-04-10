"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { format, startOfMonth } from "date-fns";
import { Trophy, Medal, Award, Star } from "lucide-react";
import type { User } from "@/lib/types/database";

interface LeaderboardEntry {
  id: string;
  user_id: string;
  month: string;
  rank: number;
  score: number;
  decided_by: string;
  notes: string | null;
  users: User;
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-6 p-6 rounded-xl border animate-pulse">
      <div className="h-12 w-12 rounded-full bg-muted flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-muted rounded w-1/3" />
        <div className="h-3 bg-muted rounded w-1/4" />
        <div className="h-2 bg-muted rounded w-full mt-2" />
      </div>
      <div className="h-8 w-16 bg-muted rounded" />
    </div>
  );
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const supabase = createClient();

  useEffect(() => {
    fetchLeaderboard();
  }, [selectedMonth]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: userData } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    const firstDay = `${selectedMonth}-01`;
    const { data } = await supabase
      .from('leaderboard')
      .select('*, users(*)')
      .eq('organization_id', userData?.organization_id)
      .eq('month', firstDay)
      .order('rank', { ascending: true });

    setLeaderboard((data as any) || []);
    setLoading(false);
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Trophy className="h-7 w-7 text-yellow-500" />;
      case 2: return <Medal className="h-7 w-7 text-slate-400" />;
      case 3: return <Award className="h-7 w-7 text-amber-600" />;
      default: return <span className="text-xl font-bold text-muted-foreground w-7 text-center">#{rank}</span>;
    }
  };

  const displayMonth = (() => {
    try { return format(new Date(`${selectedMonth}-01`), 'MMMM yyyy'); }
    catch { return selectedMonth; }
  })();

  const topEntry = leaderboard.find(e => e.rank === 1);
  const rest = leaderboard.filter(e => e.rank !== 1);

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Trophy className="h-8 w-8 text-yellow-500" />
            Leaderboard
          </h1>
          <p className="text-muted-foreground mt-1">Top performers for {displayMonth}</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="month"
            className="w-44"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="rounded-2xl border-2 border-yellow-200 p-8 animate-pulse space-y-4">
            <div className="h-6 bg-muted rounded w-1/4 mx-auto" />
            <div className="h-10 bg-muted rounded w-1/2 mx-auto" />
            <div className="h-4 bg-muted rounded w-2/3 mx-auto" />
          </div>
          {[1, 2, 3].map(i => <SkeletonRow key={i} />)}
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="space-y-4">
          {/* Skeleton empty state */}
          <div className="rounded-2xl border-2 border-dashed border-yellow-200 p-12 text-center space-y-4">
            <Trophy className="h-16 w-16 mx-auto text-yellow-200" />
            <h3 className="text-xl font-semibold text-muted-foreground">No ratings published yet</h3>
            <p className="text-sm text-muted-foreground">
              No ratings have been published for {displayMonth}. Ask your admin to enter and publish employee ratings.
            </p>
          </div>
          <div className="space-y-3 opacity-30 pointer-events-none">
            {[1, 2, 3].map(i => <SkeletonRow key={i} />)}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Employee of the Month hero banner */}
          {topEntry && (
            <div className="rounded-2xl border-2 border-yellow-400 bg-gradient-to-br from-yellow-50 via-amber-50 to-yellow-100 dark:from-yellow-950/30 dark:via-amber-950/20 dark:to-yellow-950/30 p-8 text-center shadow-lg">
              <div className="flex justify-center mb-3">
                <div className="relative">
                  <div className="h-20 w-20 rounded-full bg-yellow-200 dark:bg-yellow-800 flex items-center justify-center text-4xl font-bold text-yellow-700 dark:text-yellow-200">
                    {topEntry.users.full_name.charAt(0).toUpperCase()}
                  </div>
                  <Trophy className="h-7 w-7 text-yellow-500 absolute -top-2 -right-2" />
                </div>
              </div>
              <Badge className="mb-2 bg-yellow-400 text-yellow-900 hover:bg-yellow-400 text-xs tracking-wider uppercase font-semibold">
                ★ Employee of the Month
              </Badge>
              <h2 className="text-2xl font-bold mt-1">{topEntry.users.full_name}</h2>
              <div className="flex items-center justify-center gap-2 mt-2">
                <Badge variant="outline" className="text-lg px-3 py-1 border-yellow-400 text-yellow-700 dark:text-yellow-300 font-bold">
                  {topEntry.score}/10
                </Badge>
              </div>
              {/* Score bar */}
              <div className="mt-4 mx-auto max-w-xs">
                <div className="w-full bg-yellow-200 dark:bg-yellow-900 rounded-full h-3">
                  <div
                    className="bg-yellow-500 h-3 rounded-full transition-all duration-700"
                    style={{ width: `${(topEntry.score / 10) * 100}%` }}
                  />
                </div>
              </div>
              {topEntry.notes && (
                <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-4 italic max-w-md mx-auto">
                  &ldquo;{topEntry.notes}&rdquo;
                </p>
              )}
            </div>
          )}

          {/* Rest of the leaderboard */}
          {rest.map((entry) => {
            const initial = entry.users.full_name.charAt(0).toUpperCase();
            const rankBg =
              entry.rank === 2
                ? 'bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900/40 dark:to-slate-800/40 border-slate-300'
                : entry.rank === 3
                  ? 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-300'
                  : 'bg-card border-border';

            return (
              <Card key={entry.id} className={`border-2 ${rankBg} transition-all hover:shadow-md`}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-4">
                    {/* Avatar + rank icon */}
                    <div className="flex-shrink-0 flex flex-col items-center gap-1">
                      <div className="h-11 w-11 rounded-full bg-muted flex items-center justify-center text-lg font-bold">
                        {initial}
                      </div>
                      {getRankIcon(entry.rank)}
                    </div>

                    {/* Name + progress */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-base truncate">{entry.users.full_name}</p>
                      {entry.notes && (
                        <p className="text-xs text-muted-foreground italic mt-0.5 truncate">"{entry.notes}"</p>
                      )}
                      {/* Progress bar */}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all duration-700"
                            style={{ width: `${(entry.score / 10) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-8 text-right">{Math.round((entry.score / 10) * 100)}%</span>
                      </div>
                    </div>

                    {/* Score badge */}
                    <div className="flex-shrink-0 text-right">
                      <Badge variant="secondary" className="text-base px-3 py-1 font-bold">
                        {entry.score}<span className="text-muted-foreground font-normal">/10</span>
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
