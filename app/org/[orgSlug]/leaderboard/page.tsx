"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { format, startOfMonth } from "date-fns";
import { Trophy, Medal, Award } from "lucide-react";
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

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const supabase = createClient();

  useEffect(() => {
    fetchLeaderboard();
  }, [selectedMonth]);

  const fetchLeaderboard = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const { data: userData } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    const { data } = await supabase
      .from('leaderboard')
      .select('*, users(*)')
      .eq('organization_id', userData?.organization_id)
      .eq('month', selectedMonth)
      .order('rank', { ascending: true });

    setLeaderboard((data as any) || []);
    setLoading(false);
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-8 w-8 text-yellow-500" />;
      case 2:
        return <Medal className="h-8 w-8 text-gray-400" />;
      case 3:
        return <Award className="h-8 w-8 text-amber-600" />;
      default:
        return <span className="text-2xl font-bold text-muted-foreground">#{rank}</span>;
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-300';
      case 2:
        return 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-300';
      case 3:
        return 'bg-gradient-to-r from-amber-50 to-amber-100 border-amber-300';
      default:
        return 'bg-white border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Leaderboard</h1>
        <p className="text-muted-foreground">
          Top performers for {format(new Date(selectedMonth), 'MMMM yyyy')}
        </p>
      </div>

      <div className="mb-6">
        <input
          type="month"
          value={format(new Date(selectedMonth), 'yyyy-MM')}
          onChange={(e) => setSelectedMonth(format(new Date(e.target.value), 'yyyy-MM-dd'))}
          className="px-4 py-2 border rounded-md"
        />
      </div>

      <div className="space-y-4">
        {leaderboard.length > 0 ? (
          leaderboard.map((entry) => (
            <Card key={entry.id} className={`border-2 ${getRankColor(entry.rank)}`}>
              <CardContent className="p-6">
                <div className="flex items-center gap-6">
                  <div className="flex-shrink-0">
                    {getRankIcon(entry.rank)}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold">{entry.users.full_name}</h3>
                    <p className="text-sm text-muted-foreground">{entry.users.email}</p>
                    {entry.notes && (
                      <p className="text-sm text-muted-foreground mt-2 italic">
                        "{entry.notes}"
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-primary">{entry.score}</div>
                    <p className="text-xs text-muted-foreground">points</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No leaderboard data</h3>
              <p className="text-sm text-muted-foreground">
                Leaderboard rankings will be displayed here once managers assign them
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
