"use client";

import { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/lib/hooks/use-toast";
import { AlertTriangle } from "lucide-react";
import { format } from "date-fns";

export default function MistakesPage() {
  const [mistakes, setMistakes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const supabase = createClient();
  const { toast } = useToast();

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    const { data: userData } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    const { data: mistakesData } = await supabase
      .from("mistakes")
      .select("*, added_by_user:users!mistakes_added_by_fkey(full_name)")
      .eq("user_id", user.id)
      .eq("organization_id", userData?.organization_id)
      .order("date", { ascending: false });

    setMistakes(mistakesData || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const requestClosure = async (mistakeId: string) => {
    setRequestingId(mistakeId);
    const { data, error } = await supabase.rpc("request_mistake_closure", { p_mistake_id: mistakeId });
    setRequestingId(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    const payload = data as { ok?: boolean; error?: string } | null;
    if (payload && payload.ok === false) {
      const msg =
        payload.error === "already_pending"
          ? "A closure request is already pending."
          : payload.error === "not_open"
            ? "Only open mistakes can request closure."
            : payload.error === "not_found"
              ? "This mistake was not found."
              : payload.error || "Something went wrong.";
      toast({ title: "Request not sent", description: msg, variant: "destructive" });
      return;
    }
    toast({
      title: "Request sent",
      description: "Your manager will review the closure request.",
    });
    fetchData();
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
          View mistakes recorded by your manager. Request closure when you have addressed a mistake.
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
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Recorded By</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mistakes.map((mistake) => {
                const trackerStatus = mistake.status || "open";
                const pending = Boolean(mistake.closure_request_pending);
                const canRequestClosure = trackerStatus === "open" && !pending;
                return (
                  <TableRow key={mistake.id}>
                    <TableCell className="font-medium max-w-[200px]">
                      <p className="truncate">{mistake.title || "-"}</p>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {mistake.description || "-"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          mistake.severity === "high"
                            ? "bg-red-100 text-red-800"
                            : mistake.severity === "medium"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-green-100 text-green-800"
                        }
                      >
                        {mistake.severity?.charAt(0).toUpperCase() + mistake.severity?.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 items-start">
                        <Badge
                          className={
                            trackerStatus === "rectified"
                              ? "bg-emerald-100 text-emerald-900 capitalize"
                              : "bg-slate-100 text-slate-800 capitalize"
                          }
                        >
                          {trackerStatus === "rectified" ? "Rectified" : "Open"}
                        </Badge>
                        {pending && trackerStatus === "open" ? (
                          <span className="text-xs text-amber-700">Closure pending review</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {format(new Date(mistake.date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {mistake.added_by_user?.full_name || "Unknown"}
                    </TableCell>
                    <TableCell className="text-right">
                      {canRequestClosure ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={requestingId === mistake.id}
                          onClick={() => requestClosure(mistake.id)}
                        >
                          {requestingId === mistake.id ? "Sending…" : "Request closure"}
                        </Button>
                      ) : trackerStatus === "rectified" ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Awaiting review</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
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
