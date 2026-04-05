"use client";

import { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { AlertTriangle } from "lucide-react";
import { format } from "date-fns";

export default function MistakesPage() {
  const [mistakes, setMistakes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const { data: userData } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    const { data: mistakesData } = await supabase
      .from('mistakes')
      .select('*, added_by_user:users!mistakes_added_by_fkey(full_name)')
      .eq('user_id', user.id)
      .eq('organization_id', userData?.organization_id)
      .order('date', { ascending: false });

    setMistakes(mistakesData || []);
    setLoading(false);
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
        <h1 className="text-3xl font-bold">Mistakes</h1>
        <p className="text-muted-foreground">
          View mistakes recorded by your manager
        </p>
      </div>

      {mistakes.length > 0 ? (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Recorded By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mistakes.map((mistake) => (
                <TableRow key={mistake.id}>
                  <TableCell className="font-medium max-w-xs">
                    <p className="truncate">{mistake.description?.substring(0, 50) || '-'}</p>
                  </TableCell>
                  <TableCell className="max-w-md">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {mistake.description || '-'}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge className={
                      mistake.severity === 'high' ? 'bg-red-100 text-red-800' :
                      mistake.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }>
                      {mistake.severity?.charAt(0).toUpperCase() + mistake.severity?.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(mistake.date), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {mistake.added_by_user?.full_name || 'Unknown'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No mistakes recorded</h3>
            <p className="text-sm text-muted-foreground">
              You have no mistakes on record
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
