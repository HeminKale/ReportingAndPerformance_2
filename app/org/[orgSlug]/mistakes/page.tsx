"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { AlertCircle } from "lucide-react";
import type { Mistake, User } from "@/lib/types/database";

interface MistakeWithUser extends Mistake {
  added_by_user: User;
}

export default function MistakesPage() {
  const [mistakes, setMistakes] = useState<MistakeWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchMistakes();
  }, []);

  const fetchMistakes = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const { data } = await supabase
      .from('mistakes')
      .select(`
        *,
        added_by_user:users!mistakes_added_by_fkey(*)
      `)
      .eq('user_id', user.id)
      .order('date', { ascending: false });

    setMistakes((data as any) || []);
    setLoading(false);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
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
        <h1 className="text-3xl font-bold">Mistakes Log</h1>
        <p className="text-muted-foreground">
          Track and learn from your mistakes
        </p>
      </div>

      <div className="space-y-4">
        {mistakes.length > 0 ? (
          mistakes.map((mistake) => (
            <Card key={mistake.id} className="border-l-4 border-l-red-500">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{mistake.title}</CardTitle>
                    <CardDescription className="mt-1">
                      Reported by {mistake.added_by_user.full_name} on {format(new Date(mistake.date), 'MMM d, yyyy')}
                    </CardDescription>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full border ${getSeverityColor(mistake.severity)}`}>
                    {mistake.severity.charAt(0).toUpperCase() + mistake.severity.slice(1)}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{mistake.description}</p>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <AlertCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No mistakes recorded</h3>
              <p className="text-sm text-muted-foreground">
                Great job! No mistakes have been logged for you.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
