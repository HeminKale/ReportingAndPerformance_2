"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/lib/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { User } from "@/lib/types/database";

type EmployeeDetailsRow = {
  user_id: string;
  full_name: string | null;
  gender: string | null;
  address: string | null;
  salary_bank_account: string | null;
  ifsc_code: string | null;
  emergency_contact: string | null;
  uan_number: string | null;
};

type EmployeeDocumentRow = {
  user_id: string;
  doc_type: string;
  file_name: string;
  file_url: string;
};

type AlumniDetailsRow = {
  user_id: string;
  last_working_date: string | null;
  resignation_letter_url: string | null;
  settlement_url: string | null;
};

type ResignedMap = Record<string, boolean>;

export function ManagerDocumentsTab({
  currentUser,
  teamMembers,
  onTeamRefresh,
}: {
  currentUser: User | null;
  teamMembers: User[];
  onTeamRefresh: () => void;
}) {
  const supabase = createClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [employeeDetails, setEmployeeDetails] = useState<EmployeeDetailsRow[]>([]);
  const [employeeDocuments, setEmployeeDocuments] = useState<EmployeeDocumentRow[]>([]);
  const [alumniDetails, setAlumniDetails] = useState<AlumniDetailsRow[]>([]);
  const [resignedByUser, setResignedByUser] = useState<ResignedMap>({});
  const [updatingResignedFor, setUpdatingResignedFor] = useState<string | null>(null);

  const teamIds = useMemo(() => teamMembers.map((member) => member.id), [teamMembers]);

  const fetchData = async () => {
    if (!teamIds.length) {
      setEmployeeDetails([]);
      setEmployeeDocuments([]);
      setAlumniDetails([]);
      setResignedByUser({});
      setLoading(false);
      return;
    }

    setLoading(true);
    const [{ data: detailsData, error: detailsError }, { data: docsData, error: docsError }, { data: alumniData, error: alumniError }, { data: usersData, error: usersError }] =
      await Promise.all([
        supabase.from("employee_details").select("*").in("user_id", teamIds),
        supabase.from("employee_documents").select("user_id,doc_type,file_name,file_url").in("user_id", teamIds),
        supabase.from("alumni_details").select("*").in("user_id", teamIds),
        supabase.from("users").select("id,is_resigned").in("id", teamIds),
      ]);

    if (detailsError || docsError || alumniError || usersError) {
      toast({
        title: "Error",
        description: detailsError?.message || docsError?.message || alumniError?.message || usersError?.message || "Failed to load documents",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    setEmployeeDetails((detailsData || []) as EmployeeDetailsRow[]);
    setEmployeeDocuments((docsData || []) as EmployeeDocumentRow[]);
    setAlumniDetails((alumniData || []) as AlumniDetailsRow[]);
    const resignedMap = Object.fromEntries((usersData || []).map((row: any) => [row.id, Boolean(row.is_resigned)]));
    setResignedByUser(resignedMap);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [teamIds.join(",")]);

  const toggleResigned = async (userId: string, currentValue: boolean) => {
    if (!currentUser) return;
    setUpdatingResignedFor(userId);
    const { error } = await supabase.from("users").update({ is_resigned: !currentValue }).eq("id", userId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setUpdatingResignedFor(null);
      return;
    }
    setResignedByUser((prev) => ({ ...prev, [userId]: !currentValue }));
    toast({ title: "Success", description: "Resigned status updated" });
    onTeamRefresh();
    fetchData();
    setUpdatingResignedFor(null);
  };

  const detailsByUserId = useMemo(
    () => Object.fromEntries(employeeDetails.map((row) => [row.user_id, row])),
    [employeeDetails]
  );

  const alumniByUserId = useMemo(
    () => Object.fromEntries(alumniDetails.map((row) => [row.user_id, row])),
    [alumniDetails]
  );

  const docsByUserId = useMemo(() => {
    const grouped: Record<string, EmployeeDocumentRow[]> = {};
    for (const row of employeeDocuments) {
      if (!grouped[row.user_id]) grouped[row.user_id] = [];
      grouped[row.user_id].push(row);
    }
    return grouped;
  }, [employeeDocuments]);

  const filteredMembers = useMemo(() => {
    return teamMembers.filter((member) =>
      member.full_name.toLowerCase().includes(searchTerm.trim().toLowerCase())
    );
  }, [teamMembers, searchTerm]);

  const renderDocLinks = (docs: EmployeeDocumentRow[], docType: string, label: string, allowMany = false) => {
    const entries = docs.filter((item) => item.doc_type === docType);
    if (!entries.length) return <p className="text-sm text-slate-500">No {label.toLowerCase()} uploaded</p>;

    const renderItem = (entry: EmployeeDocumentRow) => (
      <a
        key={`${entry.user_id}-${entry.doc_type}-${entry.file_name}`}
        href={entry.file_url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        {entry.file_name}
      </a>
    );

    if (allowMany) {
      return <div className="flex flex-wrap gap-2">{entries.map(renderItem)}</div>;
    }
    return renderItem(entries[0]);
  };

  if (loading) {
    return <div className="rounded-xl border border-slate-200 p-6 text-sm text-slate-500">Loading employee documents...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="max-w-md">
        <Input
          placeholder="Search by employee name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {filteredMembers.length === 0 ? (
        <div className="rounded-xl border border-slate-200 p-6 text-center text-sm text-slate-500">
          No employees found.
        </div>
      ) : (
        <div className="space-y-2">
          {filteredMembers.map((member) => {
            const details = detailsByUserId[member.id];
            const docs = docsByUserId[member.id] || [];
            const alumni = alumniByUserId[member.id];
            const isResigned = Boolean(resignedByUser[member.id]);

            return (
              <details key={member.id} className="rounded-xl border border-slate-200 bg-white">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                  <span className="font-semibold text-slate-900">{member.full_name}</span>
                  <span className="flex items-center gap-2">
                    <Label htmlFor={`resigned-${member.id}`} className="text-xs text-slate-600">
                      Resigned
                    </Label>
                    <input
                      id={`resigned-${member.id}`}
                      type="checkbox"
                      checked={isResigned}
                      disabled={updatingResignedFor === member.id}
                      onChange={() => toggleResigned(member.id, isResigned)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </span>
                </summary>

                <div className="border-t border-slate-200 p-4">
                  <div className="grid gap-4 xl:grid-cols-3">
                    <section className="rounded-lg border border-slate-200 p-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">General</p>
                      <div className="mt-3 space-y-2">
                        <p className="text-sm"><span className="font-semibold">Name:</span> {details?.full_name || member.full_name}</p>
                        <p className="text-sm"><span className="font-semibold">Gender:</span> {details?.gender || "-"}</p>
                        <p className="text-sm"><span className="font-semibold">Address:</span> {details?.address || "-"}</p>
                        <p className="text-sm"><span className="font-semibold">Emergency Contact:</span> {details?.emergency_contact || "-"}</p>
                        <p className="text-sm"><span className="font-semibold">UAN:</span> {details?.uan_number || "-"}</p>
                        <p className="pt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Documents</p>
                        {renderDocLinks(docs, "resume", "Resume")}
                        {renderDocLinks(docs, "aadhar", "Aadhar")}
                        {renderDocLinks(docs, "pan", "PAN")}
                        {renderDocLinks(docs, "photo", "Photo")}
                        {renderDocLinks(docs, "salary_slip", "Previous Salary Slips", true)}
                      </div>
                    </section>

                    <section className="rounded-lg border border-slate-200 p-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Salary & Bank</p>
                      <div className="mt-3 space-y-2">
                        <p className="text-sm"><span className="font-semibold">Bank Account:</span> {details?.salary_bank_account || "-"}</p>
                        <p className="text-sm"><span className="font-semibold">IFSC Code:</span> {details?.ifsc_code || "-"}</p>
                        <p className="pt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Salary Statements</p>
                        {renderDocLinks(docs, "salary_statement", "Salary statement", true)}
                      </div>
                    </section>

                    <section className="rounded-lg border border-slate-200 p-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Responsibilities & Alumni</p>
                      <div className="mt-3 space-y-2">
                        <p className="pt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Responsibilities</p>
                        {renderDocLinks(docs, "offer_letter", "Offer Letter")}
                        {renderDocLinks(docs, "job_description", "Job Description")}

                        <p className="pt-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Alumni Details</p>
                        {isResigned ? (
                          <>
                            <p className="text-sm"><span className="font-semibold">Last Working Date:</span> {alumni?.last_working_date || "-"}</p>
                            {renderDocLinks(docs, "resignation_letter", "Resignation Letter")}
                            {renderDocLinks(docs, "full_final_settlement", "Full and Final Settlement")}
                          </>
                        ) : (
                          <p className="text-sm text-slate-500">Not marked resigned</p>
                        )}
                      </div>
                    </section>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
