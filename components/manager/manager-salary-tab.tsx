"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/lib/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import type { User } from "@/lib/types/database";

type SalaryRecord = {
  id: string;
  user_id: string;
  month: string;
  fixed_salary: number | null;
  incentive: number | null;
  salary_statement_url: string | null;
  salary_statement_name: string | null;
};

export function ManagerSalaryTab({
  currentUser,
  teamMembers,
}: {
  currentUser: User | null;
  teamMembers: User[];
}) {
  const supabase = createClient();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const teamIds = useMemo(() => teamMembers.map((member) => member.id), [teamMembers]);
  const monthOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString("en-US", { month: "long", year: "numeric" });
      options.push({ value, label });
    }
    return options;
  }, []);

  const fetchData = async () => {
    if (!teamIds.length) {
      setSalaryRecords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("salary_records")
      .select("id,user_id,month,fixed_salary,incentive,salary_statement_url,salary_statement_name")
      .in("user_id", teamIds)
      .order("month", { ascending: false });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    setSalaryRecords((data || []) as SalaryRecord[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [teamIds.join(",")]);

  const filteredMembers = useMemo(() => {
    return teamMembers.filter((member) =>
      member.full_name.toLowerCase().includes(searchTerm.trim().toLowerCase())
    );
  }, [teamMembers, searchTerm]);

  const findRecord = (userId: string) => {
    return salaryRecords.find((row) => row.user_id === userId && row.month === `${selectedMonth}-01`);
  };

  const upsertField = async (
    userId: string,
    field: "fixed_salary" | "incentive",
    value: number
  ) => {
    if (!currentUser) return;
    const rowKey = `${userId}-${field}`;
    setSavingKey(rowKey);
    const existing = findRecord(userId);
    const payload: any = {
      organization_id: currentUser.organization_id,
      user_id: userId,
      month: `${selectedMonth}-01`,
      fixed_salary: existing?.fixed_salary ?? 0,
      incentive: existing?.incentive ?? 0,
      created_by: currentUser.id,
      [field]: value,
    };

    const { error } = await supabase
      .from("salary_records")
      .upsert(payload, { onConflict: "user_id,month" });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setSavingKey(null);
      return;
    }
    await fetchData();
    setSavingKey(null);
  };

  const uploadStatement = async (userId: string, file: File | null) => {
    if (!currentUser || !file) return;
    const existing = findRecord(userId);
    const month = `${selectedMonth}-01`;
    const filePath = `salary-statements/${userId}/${month}-${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("salary-statements").upload(filePath, file, {
      upsert: true,
    });

    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      return;
    }

    const { data: signed } = await supabase.storage
      .from("salary-statements")
      .createSignedUrl(filePath, 60 * 60 * 24 * 7);

    const { error } = await supabase.from("salary_records").upsert(
      {
        organization_id: currentUser.organization_id,
        user_id: userId,
        month,
        fixed_salary: existing?.fixed_salary ?? 0,
        incentive: existing?.incentive ?? 0,
        salary_statement_url: signed?.signedUrl || null,
        salary_statement_name: file.name,
        created_by: currentUser.id,
      },
      { onConflict: "user_id,month" }
    );

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Success", description: "Salary statement uploaded" });
    fetchData();
  };

  const selectedEmployee = teamMembers.find((member) => member.id === selectedEmployeeId) || null;

  const selectedEmployeeRecord = useMemo(() => {
    if (!selectedEmployeeId) return null;
    return salaryRecords.find((row) => row.user_id === selectedEmployeeId && row.month === `${selectedMonth}-01`);
  }, [salaryRecords, selectedEmployeeId, selectedMonth]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Filter by employee name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Month</TableHead>
              <TableHead>Fixed Salary</TableHead>
              <TableHead>Incentive</TableHead>
              <TableHead>Salary Statement</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-slate-500">
                  Loading salary records...
                </TableCell>
              </TableRow>
            ) : filteredMembers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-slate-500">
                  No employees found.
                </TableCell>
              </TableRow>
            ) : (
              filteredMembers.map((member) => {
                const row = findRecord(member.id);
                const fixed = Number(row?.fixed_salary || 0);
                const incentive = Number(row?.incentive || 0);
                const monthLabel = monthOptions.find(m => m.value === selectedMonth)?.label || selectedMonth;
                return (
                  <TableRow key={member.id}>
                    <TableCell>
                      <button
                        type="button"
                        className="font-semibold text-blue-700 hover:underline"
                        onClick={() => setSelectedEmployeeId(member.id)}
                      >
                        {member.full_name}
                      </button>
                    </TableCell>
                    <TableCell>{monthLabel}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={fixed}
                        onChange={(e) => upsertField(member.id, "fixed_salary", Number(e.target.value || 0))}
                        disabled={savingKey === `${member.id}-fixed_salary`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={incentive}
                        onChange={(e) => upsertField(member.id, "incentive", Number(e.target.value || 0))}
                        disabled={savingKey === `${member.id}-incentive`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {row?.salary_statement_url && (
                          <a
                            href={row.salary_statement_url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Download
                          </a>
                        )}
                        <Label className="cursor-pointer rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
                          {row?.salary_statement_url ? "Replace" : "Upload"}
                          <Input
                            type="file"
                            className="hidden"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => uploadStatement(member.id, e.target.files?.[0] || null)}
                          />
                        </Label>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={Boolean(selectedEmployee)} onOpenChange={(open) => !open && setSelectedEmployeeId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedEmployee?.full_name} Salary Details</DialogTitle>
            <DialogDescription>
              Salary information for {monthOptions.find(m => m.value === selectedMonth)?.label}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedEmployeeRecord ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Salary Breakdown
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50">
                    <span className="text-sm font-medium">Fixed Salary</span>
                    <span className="text-lg font-bold text-slate-900">
                      ₹ {Number(selectedEmployeeRecord.fixed_salary || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50">
                    <span className="text-sm font-medium">Incentive</span>
                    <span className="text-lg font-bold text-emerald-700">
                      ₹ {Number(selectedEmployeeRecord.incentive || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-blue-50 border-t-2 border-blue-500">
                    <span className="text-sm font-semibold">Total</span>
                    <span className="text-xl font-bold text-blue-900">
                      ₹ {(Number(selectedEmployeeRecord.fixed_salary || 0) + Number(selectedEmployeeRecord.incentive || 0)).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No salary record found for {monthOptions.find(m => m.value === selectedMonth)?.label}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
