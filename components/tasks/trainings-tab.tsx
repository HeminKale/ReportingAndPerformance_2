"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/lib/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Upload, Image as ImageIcon } from "lucide-react";
import type { User } from "@/lib/types/database";

type TrainingStatus = "not_started" | "in_progress" | "completed";

type TrainingRow = {
  id: string;
  name: string;
  date_completed: string | null;
  status: TrainingStatus;
  certificate_url: string | null;
  certificate_name: string | null;
};

const STATUS_OPTIONS: { value: TrainingStatus; label: string }[] = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
];

export function TrainingsTab({ user }: { user: User | null }) {
  const supabase = createClient();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [rows, setRows] = useState<TrainingRow[]>([]);
  const [newTrainingName, setNewTrainingName] = useState("");

  const fetchRows = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("trainings")
      .select("id,name,date_completed,status,certificate_url,certificate_name")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    setRows((data || []) as TrainingRow[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchRows();
  }, [user?.id]);

  const addTraining = async () => {
    if (!user) return;
    if (!newTrainingName.trim()) {
      toast({ title: "Error", description: "Training name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("trainings").insert({
      organization_id: user.organization_id,
      user_id: user.id,
      name: newTrainingName.trim(),
      status: "not_started",
      assigned_by: null,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }
    setNewTrainingName("");
    toast({ title: "Success", description: "Training added" });
    await fetchRows();
    setSaving(false);
    setIsModalOpen(false);
  };

  const updateTraining = async (id: string, updates: Partial<TrainingRow>) => {
    const { error } = await supabase.from("trainings").update(updates).eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...updates } : row)));
  };

  const uploadCertificate = async (trainingId: string, file: File | null) => {
    if (!user || !file) return;
    const filePath = `training-certificates/${user.id}/${trainingId}-${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("employee-documents")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      return;
    }

    const { data: signedUrlData } = await supabase.storage
      .from("employee-documents")
      .createSignedUrl(filePath, 60 * 60 * 24 * 7);

    await updateTraining(trainingId, {
      certificate_url: signedUrlData?.signedUrl || null,
      certificate_name: file.name,
    });
    toast({ title: "Success", description: "Certificate uploaded" });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              className="text-blue-600 hover:bg-blue-50 hover:text-blue-700 font-semibold"
            >
              + Add Training
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add Training</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Training Name</Label>
                <Input
                  value={newTrainingName}
                  onChange={(e) => setNewTrainingName(e.target.value)}
                  placeholder="e.g. Health and Safety"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                onClick={addTraining}
                disabled={saving}
                className="bg-slate-900 text-white hover:bg-slate-800"
              >
                {saving ? "Saving..." : "Save Training"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Date completed</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Certificate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-slate-500">
                    Loading trainings...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-slate-500">
                    No trainings found.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        value={row.date_completed || ""}
                        onChange={(e) => updateTraining(row.id, { date_completed: e.target.value || null })}
                        className="w-44"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={row.status}
                        onValueChange={(value) => updateTraining(row.id, { status: value as TrainingStatus })}
                      >
                        <SelectTrigger className="w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {row.certificate_url ? (
                        <a
                          href={row.certificate_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <ImageIcon className="h-3.5 w-3.5" />
                          {row.certificate_name || "View certificate"}
                        </a>
                      ) : (
                        <Label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
                          <Upload className="h-3.5 w-3.5" />
                          Upload
                          <Input
                            type="file"
                            className="hidden"
                            accept=".pdf,.jpg,.jpeg,.png,.webp"
                            onChange={(e) => uploadCertificate(row.id, e.target.files?.[0] || null)}
                          />
                        </Label>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
