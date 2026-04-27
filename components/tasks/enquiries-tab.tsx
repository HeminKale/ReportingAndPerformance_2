"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/lib/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import type { User } from "@/lib/types/database";

type EnquiryType = "new" | "renewal";
type EnquiryStatus = "prospecting" | "analyzing" | "closed_won" | "closed_lost";

type EnquiryRow = {
  id: string;
  type: EnquiryType;
  name: string;
  status: EnquiryStatus;
  reason: string | null;
  iso_standard: string | null;
  date: string;
  certification_body: string | null;
  owner_id: string;
  owner_name?: string;
};

const STATUS_OPTIONS: { value: EnquiryStatus; label: string }[] = [
  { value: "prospecting", label: "Prospecting" },
  { value: "analyzing", label: "Analyzing" },
  { value: "closed_won", label: "Closed won" },
  { value: "closed_lost", label: "Closed lost" },
];

export function EnquiriesTab({ user }: { user: User | null }) {
  const supabase = createClient();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [enquiries, setEnquiries] = useState<EnquiryRow[]>([]);
  const [activeType, setActiveType] = useState<EnquiryType>("new");
  const [nameFilter, setNameFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    name: "",
    status: "prospecting" as EnquiryStatus,
    reason: "",
    isoStandard: "",
    date: new Date().toISOString().slice(0, 10),
    certificationBody: "",
  });

  const fetchEnquiries = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("enquiries")
      .select("id,type,name,status,reason,iso_standard,date,certification_body,owner_id")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const rows = (data || []) as EnquiryRow[];
    setEnquiries(rows.map((row) => ({ ...row, owner_name: row.owner_id === user.id ? user.full_name : "Team member" })));
    setLoading(false);
  };

  useEffect(() => {
    fetchEnquiries();
  }, [user?.id]);

  const filteredEnquiries = useMemo(() => {
    return enquiries.filter((row) => {
      const typeOk = row.type === activeType;
      const nameOk = !nameFilter.trim() || row.name.toLowerCase().includes(nameFilter.trim().toLowerCase());
      const dateOk = !dateFilter || row.date === dateFilter;
      return typeOk && nameOk && dateOk;
    });
  }, [enquiries, activeType, nameFilter, dateFilter]);

  const isClosing = formState.status === "closed_won" || formState.status === "closed_lost";
  const isEditing = !!editingId;
  const modalTitle = isEditing
    ? `Edit ${activeType === "new" ? "New" : "Renewal"} Enquiry`
    : `Add ${activeType === "new" ? "New" : "Renewal"} Enquiry`;

  const handleOpenNew = () => {
    setFormState({
      name: "",
      status: "prospecting",
      reason: "",
      isoStandard: "",
      date: new Date().toISOString().slice(0, 10),
      certificationBody: "",
    });
    setEditingId(null);
    setIsModalOpen(true);
  };

  const handleEdit = (row: EnquiryRow) => {
    setFormState({
      name: row.name,
      status: row.status,
      reason: row.reason || "",
      isoStandard: row.iso_standard || "",
      date: row.date,
      certificationBody: row.certification_body || "",
    });
    setEditingId(row.id);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!formState.name.trim()) {
      toast({ title: "Error", description: "Name is required", variant: "destructive" });
      return;
    }
    if (isClosing && !formState.reason.trim()) {
      toast({
        title: "Error",
        description: "Reason is mandatory when status is Closed won or Closed lost",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const payload = {
      organization_id: user.organization_id,
      owner_id: user.id,
      type: activeType,
      name: formState.name.trim(),
      status: formState.status,
      reason: formState.reason.trim() || null,
      iso_standard: formState.isoStandard.trim() || null,
      date: formState.date,
      certification_body: formState.certificationBody.trim() || null,
    };

    const { data: savedRow, error } = isEditing
      ? await supabase.from("enquiries").update(payload).eq("id", editingId!).select("id").single()
      : await supabase.from("enquiries").insert(payload).select("id").single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    const enquiryId = savedRow?.id ?? editingId;
    if (formState.status === "closed_won" && enquiryId) {
      void fetch("/api/gamification/xp-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ kind: "enquiry_closed_won", resourceId: enquiryId }),
      }).catch(() => {});
    }

    toast({ title: "Success", description: `Enquiry ${isEditing ? "updated" : "saved"} successfully` });
    setFormState({
      name: "",
      status: "prospecting",
      reason: "",
      isoStandard: "",
      date: new Date().toISOString().slice(0, 10),
      certificationBody: "",
    });
    setEditingId(null);
    await fetchEnquiries();
    setSaving(false);
    setIsModalOpen(false);
  };

  return (
    <Tabs
      value={activeType}
      onValueChange={(v) => setActiveType(v as EnquiryType)}
      className="grid gap-4 xl:grid-cols-[200px_1fr]"
    >
      <aside className="rounded-2xl border border-slate-200 bg-white p-3">
        <TabsList className="h-auto w-full flex-col items-stretch gap-1 bg-transparent p-0">
          <TabsTrigger value="new" className="justify-start rounded-lg px-3 py-2">
            New
          </TabsTrigger>
          <TabsTrigger value="renewal" className="justify-start rounded-lg px-3 py-2">
            Renewal
          </TabsTrigger>
        </TabsList>
      </aside>

      <div className="space-y-4">
        <div className="flex justify-end">
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                onClick={handleOpenNew}
                className="border-primary/50 bg-transparent font-semibold text-primary hover:bg-primary/10"
              >
                + New Enquiry
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>{modalTitle}</DialogTitle>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={formState.name}
                      onChange={(e) => setFormState((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Company or Person Name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={formState.status}
                      onValueChange={(value) => setFormState((p) => ({ ...p, status: value as EnquiryStatus }))}
                    >
                      <SelectTrigger>
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
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={formState.date}
                      onChange={(e) => setFormState((p) => ({ ...p, date: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>ISO Standard</Label>
                    <Input
                      value={formState.isoStandard}
                      onChange={(e) => setFormState((p) => ({ ...p, isoStandard: e.target.value }))}
                      placeholder="e.g. ISO 9001"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Certification Body</Label>
                    <Input
                      value={formState.certificationBody}
                      onChange={(e) => setFormState((p) => ({ ...p, certificationBody: e.target.value }))}
                      placeholder="e.g. BSI, TUV"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Owner</Label>
                    <Input value={user?.full_name || ""} disabled />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>
                    Reason {(formState.status === "closed_won" || formState.status === "closed_lost") && "(required)"}
                  </Label>
                  <Input
                    value={formState.reason}
                    onChange={(e) => setFormState((p) => ({ ...p, reason: e.target.value }))}
                    placeholder="Details about the status..."
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
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-slate-900 text-white hover:bg-slate-800"
                >
                  {saving ? "Saving..." : "Save Enquiry"}
                </Button>

              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <TabsContent value="new" className="mt-0 space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap gap-3">
              <Input
                placeholder="Filter by name..."
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                className="max-w-xs"
              />
              <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-44" />
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>ISO Standard</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Certification Body</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-sm text-slate-500">
                        Loading enquiries...
                      </TableCell>
                    </TableRow>
                  ) : filteredEnquiries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-sm text-slate-500">
                        No enquiries found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEnquiries.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.name}</TableCell>
                        <TableCell className="capitalize">{row.status.replace("_", " ")}</TableCell>
                        <TableCell>{row.reason || "-"}</TableCell>
                        <TableCell>{row.iso_standard || "-"}</TableCell>
                        <TableCell>{row.date}</TableCell>
                        <TableCell>{row.certification_body || "-"}</TableCell>
                        <TableCell>{row.owner_name || "-"}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(row)}
                            className="h-8 w-8 text-slate-400 hover:text-blue-600"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="renewal" className="mt-0 space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap gap-3">
              <Input
                placeholder="Filter by name..."
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                className="max-w-xs"
              />
              <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-44" />
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>ISO Standard</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Certification Body</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-sm text-slate-500">
                        Loading enquiries...
                      </TableCell>
                    </TableRow>
                  ) : filteredEnquiries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-sm text-slate-500">
                        No enquiries found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEnquiries.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.name}</TableCell>
                        <TableCell className="capitalize">{row.status.replace("_", " ")}</TableCell>
                        <TableCell>{row.reason || "-"}</TableCell>
                        <TableCell>{row.iso_standard || "-"}</TableCell>
                        <TableCell>{row.date}</TableCell>
                        <TableCell>{row.certification_body || "-"}</TableCell>
                        <TableCell>{row.owner_name || "-"}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(row)}
                            className="h-8 w-8 text-slate-400 hover:text-blue-600"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        </TabsContent>
      </div>

    </Tabs>
  );
}
