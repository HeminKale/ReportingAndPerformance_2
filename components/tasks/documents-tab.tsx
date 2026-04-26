"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/lib/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload } from "lucide-react";
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
import type {
  AlumniDetails,
  DocumentType,
  EmployeeDetails,
  EmployeeDocument,
  SalaryRecord,
  User,
} from "@/lib/types/database";

type DocumentsTabProps = {
  user: User | null;
  isResigned: boolean;
};

type DocumentUploadKey =
  | "resume"
  | "aadhar"
  | "pan"
  | "photo"
  | "offerLetter"
  | "jobDescription"
  | "resignationLetter"
  | "fullAndFinal";

type FormState = {
  salaryBankAccount: string;
  ifscCode: string;
  fullName: string;
  gender: string;
  address: string;
  emergencyContact: string;
  uanNumber: string;
  lastWorkingDate: string;
};

const DOCUMENT_TYPE_BY_KEY: Record<DocumentUploadKey, DocumentType> = {
  resume: "resume",
  aadhar: "aadhar",
  pan: "pan",
  photo: "photo",
  offerLetter: "offer_letter",
  jobDescription: "job_description",
  resignationLetter: "resignation_letter",
  fullAndFinal: "full_final_settlement",
};

const SALARY_SLIP_TYPE: DocumentType = "salary_slip";
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const emptyFormState = (user: User | null): FormState => ({
  salaryBankAccount: "",
  ifscCode: "",
  fullName: user?.full_name || "",
  gender: "",
  address: "",
  emergencyContact: "",
  uanNumber: "",
  lastWorkingDate: "",
});

const sanitizeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_");

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

const crc32 = (bytes: Uint8Array) => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const writeUint16 = (target: number[], value: number) => {
  target.push(value & 0xff, (value >>> 8) & 0xff);
};

const writeUint32 = (target: number[], value: number) => {
  target.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
};

const createZipBlob = async (files: { name: string; blob: Blob }[]) => {
  const encoder = new TextEncoder();
  const localParts: BlobPart[] = [];
  const centralParts: BlobPart[] = [];
  let offset = 0;

  for (const file of files) {
    const bytes = new Uint8Array(await file.blob.arrayBuffer());
    const fileName = encoder.encode(sanitizeFileName(file.name));
    const checksum = crc32(bytes);
    const localHeader: number[] = [];

    writeUint32(localHeader, 0x04034b50);
    writeUint16(localHeader, 20);
    writeUint16(localHeader, 0);
    writeUint16(localHeader, 0);
    writeUint16(localHeader, 0);
    writeUint16(localHeader, 0);
    writeUint32(localHeader, checksum);
    writeUint32(localHeader, bytes.length);
    writeUint32(localHeader, bytes.length);
    writeUint16(localHeader, fileName.length);
    writeUint16(localHeader, 0);

    localParts.push(new Uint8Array(localHeader), fileName, bytes);

    const centralHeader: number[] = [];
    writeUint32(centralHeader, 0x02014b50);
    writeUint16(centralHeader, 20);
    writeUint16(centralHeader, 20);
    writeUint16(centralHeader, 0);
    writeUint16(centralHeader, 0);
    writeUint16(centralHeader, 0);
    writeUint16(centralHeader, 0);
    writeUint32(centralHeader, checksum);
    writeUint32(centralHeader, bytes.length);
    writeUint32(centralHeader, bytes.length);
    writeUint16(centralHeader, fileName.length);
    writeUint16(centralHeader, 0);
    writeUint16(centralHeader, 0);
    writeUint16(centralHeader, 0);
    writeUint16(centralHeader, 0);
    writeUint32(centralHeader, 0);
    writeUint32(centralHeader, offset);
    centralParts.push(new Uint8Array(centralHeader), fileName);

    offset += localHeader.length + fileName.length + bytes.length;
  }

  const centralSize = centralParts.reduce((sum, part) => {
    if (typeof part === "string") return sum + part.length;
    if (part instanceof Uint8Array) return sum + part.length;
    return sum;
  }, 0);
  const endHeader: number[] = [];
  writeUint32(endHeader, 0x06054b50);
  writeUint16(endHeader, 0);
  writeUint16(endHeader, 0);
  writeUint16(endHeader, files.length);
  writeUint16(endHeader, files.length);
  writeUint32(endHeader, centralSize);
  writeUint32(endHeader, offset);
  writeUint16(endHeader, 0);

  return new Blob([...localParts, ...centralParts, new Uint8Array(endHeader)], { type: "application/zip" });
};

export function DocumentsTab({ user, isResigned }: DocumentsTabProps) {
  const supabase = createClient();
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const currentMonth = `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [statementRange, setStatementRange] = useState("current_month");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [details, setDetails] = useState<EmployeeDetails | null>(null);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [alumniDetails, setAlumniDetails] = useState<AlumniDetails | null>(null);
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>([]);
  const [formState, setFormState] = useState<FormState>(() => emptyFormState(user));

  const salaryYears = useMemo(
    () => [currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(String),
    [currentYear]
  );

  const fetchData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const [{ data: detailsData, error: detailsError }, { data: docsData, error: docsError }, { data: alumniData, error: alumniError }, { data: salaryData, error: salaryError }] =
      await Promise.all([
        supabase.from("employee_details").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("employee_documents").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("alumni_details").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("salary_records").select("*").eq("user_id", user.id).order("month", { ascending: true }),
      ]);

    if (detailsError || docsError || alumniError || salaryError) {
      toast({
        title: "Error",
        description: detailsError?.message || docsError?.message || alumniError?.message || salaryError?.message || "Failed to load documents",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const nextDetails = detailsData as EmployeeDetails | null;
    const nextAlumni = alumniData as AlumniDetails | null;
    setDetails(nextDetails);
    setDocuments((docsData || []) as EmployeeDocument[]);
    setAlumniDetails(nextAlumni);
    setSalaryRecords((salaryData || []) as SalaryRecord[]);
    setFormState({
      salaryBankAccount: nextDetails?.salary_bank_account || "",
      ifscCode: nextDetails?.ifsc_code || "",
      fullName: nextDetails?.full_name || user.full_name || "",
      gender: nextDetails?.gender || "",
      address: nextDetails?.address || "",
      emergencyContact: nextDetails?.emergency_contact || "",
      uanNumber: nextDetails?.uan_number || "",
      lastWorkingDate: nextAlumni?.last_working_date || "",
    });
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user?.id]);

  const docsByType = useMemo(() => {
    const grouped: Partial<Record<DocumentType, EmployeeDocument[]>> = {};
    for (const document of documents) {
      if (!grouped[document.doc_type]) grouped[document.doc_type] = [];
      grouped[document.doc_type]?.push(document);
    }
    return grouped;
  }, [documents]);

  const salaryRows = useMemo(() => {
    return salaryRecords
      .filter((row) => row.month.startsWith(`${selectedYear}-`))
      .map((row) => ({
        ...row,
        monthLabel: new Date(row.month).toLocaleString("en-US", { month: "short" }),
        fixed: Number(row.fixed_salary || 0),
        incentive: Number(row.incentive || 0),
      }));
  }, [salaryRecords, selectedYear]);

  const chartData = useMemo(
    () =>
      MONTH_LABELS.map((month, index) => {
        const monthNumber = String(index + 1).padStart(2, "0");
        const record = salaryRows.find((row) => row.month.startsWith(`${selectedYear}-${monthNumber}`));
        return {
          month,
          fixed: record?.fixed || 0,
          incentive: record?.incentive || 0,
        };
      }),
    [salaryRows, selectedYear]
  );

  const statementRecords = useMemo(() => {
    const recordsWithStatements = salaryRecords.filter((row) => row.salary_statement_url);
    if (statementRange === "current_month") {
      return recordsWithStatements.filter((row) => row.month.startsWith(currentMonth));
    }
    if (statementRange === "past_6_months") {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - 5);
      cutoff.setDate(1);
      return recordsWithStatements.filter((row) => new Date(row.month) >= cutoff);
    }
    return recordsWithStatements.filter((row) => row.month.startsWith(`${selectedYear}-`));
  }, [salaryRecords, statementRange, currentMonth, selectedYear]);

  const uploadDocument = async (docType: DocumentType, file: File | null, options?: { allowMany?: boolean }) => {
    if (!user || !file) return;
    if (docType === SALARY_SLIP_TYPE && (docsByType.salary_slip?.length || 0) >= 3) {
      toast({ title: "Limit reached", description: "You can upload up to 3 previous salary slips.", variant: "destructive" });
      return;
    }

    const uploadKey = `${docType}-${Date.now()}`;
    setUploadingKey(uploadKey);
    const filePath = `${docType}/${user.id}/${Date.now()}-${sanitizeFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage.from("employee-documents").upload(filePath, file, {
      upsert: true,
    });

    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      setUploadingKey(null);
      return;
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("employee-documents")
      .createSignedUrl(filePath, 60 * 60 * 24 * 7);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      toast({
        title: "Upload failed",
        description: signedUrlError?.message || "Could not create a document link.",
        variant: "destructive",
      });
      setUploadingKey(null);
      return;
    }

    if (!options?.allowMany) {
      await supabase.from("employee_documents").delete().eq("user_id", user.id).eq("doc_type", docType);
    }

    const { error: insertError } = await supabase.from("employee_documents").insert({
      organization_id: user.organization_id,
      user_id: user.id,
      doc_type: docType,
      file_name: file.name,
      file_url: signedUrlData.signedUrl,
      uploaded_by: user.id,
    });

    if (insertError) {
      toast({ title: "Error", description: insertError.message, variant: "destructive" });
      setUploadingKey(null);
      return;
    }

    if (docType === "resignation_letter" || docType === "full_final_settlement") {
      const { error: alumniError } = await supabase.from("alumni_details").upsert(
        {
          organization_id: user.organization_id,
          user_id: user.id,
          last_working_date: formState.lastWorkingDate || alumniDetails?.last_working_date || null,
          resignation_letter_url:
            docType === "resignation_letter" ? signedUrlData.signedUrl : alumniDetails?.resignation_letter_url || null,
          settlement_url:
            docType === "full_final_settlement" ? signedUrlData.signedUrl : alumniDetails?.settlement_url || null,
        },
        { onConflict: "user_id" }
      );

      if (alumniError) {
        toast({ title: "Error", description: alumniError.message, variant: "destructive" });
        setUploadingKey(null);
        return;
      }
    }

    toast({ title: "Success", description: "Document uploaded successfully" });
    await fetchData();
    setUploadingKey(null);
  };

  const saveDetails = async () => {
    if (!user) return;
    setSaving(true);
    const { error: detailsError } = await supabase.from("employee_details").upsert(
      {
        id: details?.id,
        organization_id: user.organization_id,
        user_id: user.id,
        full_name: formState.fullName.trim() || null,
        gender: formState.gender.trim() || null,
        address: formState.address.trim() || null,
        salary_bank_account: formState.salaryBankAccount.trim() || null,
        ifsc_code: formState.ifscCode.trim() || null,
        emergency_contact: formState.emergencyContact.trim() || null,
        uan_number: formState.uanNumber.trim() || null,
      },
      { onConflict: "user_id" }
    );

    if (detailsError) {
      toast({ title: "Error", description: detailsError.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    if (isResigned) {
      const { error: alumniError } = await supabase.from("alumni_details").upsert(
        {
          id: alumniDetails?.id,
          organization_id: user.organization_id,
          user_id: user.id,
          last_working_date: formState.lastWorkingDate || null,
          resignation_letter_url: alumniDetails?.resignation_letter_url || null,
          settlement_url: alumniDetails?.settlement_url || null,
        },
        { onConflict: "user_id" }
      );

      if (alumniError) {
        toast({ title: "Error", description: alumniError.message, variant: "destructive" });
        setSaving(false);
        return;
      }
    }

    toast({ title: "Success", description: "Details saved successfully" });
    await fetchData();
    setSaving(false);
  };

  const handleStatementAction = async () => {
    if (statementRange === "current_month") {
      const currentStatement = statementRecords[0];
      if (!currentStatement?.salary_statement_url) {
        toast({ title: "No statement found", description: "No current month salary statement is available." });
        return;
      }
      window.open(currentStatement.salary_statement_url, "_blank", "noopener,noreferrer");
      return;
    }

    if (!statementRecords.length) {
      toast({ title: "No statements found", description: "No salary statements are available for this range." });
      return;
    }

    setDownloading(true);
    try {
      const files = await Promise.all(
        statementRecords.map(async (record) => {
          const response = await fetch(record.salary_statement_url as string);
          if (!response.ok) throw new Error(`Could not download ${record.salary_statement_name || record.month}`);
          return {
            name: record.salary_statement_name || `${record.month}-salary-statement.pdf`,
            blob: await response.blob(),
          };
        })
      );
      const zipBlob = await createZipBlob(files);
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `salary-statements-${statementRange}-${selectedYear}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "Could not download salary statements.",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  const renderUploadCard = (
    title: string,
    accept: string,
    docType: DocumentType,
    options?: { allowMany?: boolean }
  ) => {
    const entries = docsByType[docType] || [];
    const latest = entries[0];
    const disabled = Boolean(uploadingKey) || (docType === SALARY_SLIP_TYPE && entries.length >= 3);

    return (
      <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            {options?.allowMany ? (
              <p className="text-xs text-slate-500">{entries.length ? `${entries.length} uploaded` : "No file uploaded"}</p>
            ) : latest ? (
              <a href={latest.file_url} target="_blank" rel="noreferrer" className="text-xs font-medium text-blue-700 hover:underline">
                {latest.file_name}
              </a>
            ) : (
              <p className="text-xs text-slate-500">No file uploaded</p>
            )}
          </div>
          <Label className={`rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
            <Upload className="mr-1 inline h-3.5 w-3.5" />
            {latest && !options?.allowMany ? "Replace" : "Upload"}
            <Input
              type="file"
              className="hidden"
              accept={accept}
              disabled={disabled}
              onChange={(e) => uploadDocument(docType, e.target.files?.[0] || null, options)}
            />
          </Label>
        </div>
        {options?.allowMany && entries.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {entries.map((entry) => (
              <a
                key={entry.id}
                href={entry.file_url}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {entry.file_name}
              </a>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (!user) {
    return <div className="rounded-xl border border-slate-200 p-6 text-sm text-slate-500">Loading employee profile...</div>;
  }

  if (loading) {
    return <div className="rounded-xl border border-slate-200 p-6 text-sm text-slate-500">Loading documents...</div>;
  }

  return (
    <Tabs defaultValue="general" className="grid gap-4 xl:grid-cols-[220px_1fr]">
      <aside className="rounded-2xl border border-slate-200 bg-white p-3">
        <TabsList className="h-auto w-full flex-col items-stretch gap-1 bg-transparent p-0">
          <TabsTrigger value="general" className="justify-start rounded-lg px-3 py-2">
            General
          </TabsTrigger>
          <TabsTrigger value="salary" className="justify-start rounded-lg px-3 py-2">
            Salary
          </TabsTrigger>
          <TabsTrigger value="responsibilities" className="justify-start rounded-lg px-3 py-2">
            Responsibilities
          </TabsTrigger>
        </TabsList>
      </aside>

      <div className="space-y-4">
        <TabsContent value="general" className="mt-0 space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Document Uploads</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {renderUploadCard("Resume", ".pdf,.doc,.docx", DOCUMENT_TYPE_BY_KEY.resume)}
              {renderUploadCard("Aadhar Card", ".pdf,.jpg,.jpeg,.png", DOCUMENT_TYPE_BY_KEY.aadhar)}
              {renderUploadCard("PAN Card", ".pdf,.jpg,.jpeg,.png", DOCUMENT_TYPE_BY_KEY.pan)}
              {renderUploadCard("Photo", ".jpg,.jpeg,.png,.webp", DOCUMENT_TYPE_BY_KEY.photo)}
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">Previous Employer Salary Slips (up to 3)</p>
                <span className="text-xs font-semibold text-slate-500">{docsByType.salary_slip?.length || 0}/3 uploaded</span>
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                {renderUploadCard("Salary Slip", ".pdf,.jpg,.jpeg,.png", SALARY_SLIP_TYPE, { allowMany: true })}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Employee Details</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Salary Bank Account Number</Label>
                <Input value={formState.salaryBankAccount} onChange={(e) => setFormState((prev) => ({ ...prev, salaryBankAccount: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>IFSC Code</Label>
                <Input value={formState.ifscCode} onChange={(e) => setFormState((prev) => ({ ...prev, ifscCode: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={formState.fullName} onChange={(e) => setFormState((prev) => ({ ...prev, fullName: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Gender</Label>
                <Input value={formState.gender} onChange={(e) => setFormState((prev) => ({ ...prev, gender: e.target.value }))} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Address</Label>
                <Input value={formState.address} onChange={(e) => setFormState((prev) => ({ ...prev, address: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Emergency Contact Number</Label>
                <Input value={formState.emergencyContact} onChange={(e) => setFormState((prev) => ({ ...prev, emergencyContact: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>UAN Account Number</Label>
                <Input value={formState.uanNumber} onChange={(e) => setFormState((prev) => ({ ...prev, uanNumber: e.target.value }))} />
              </div>
            </div>
          </section>

          {isResigned && (
            <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Alumni Details</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>Last Working Date</Label>
                  <Input type="date" value={formState.lastWorkingDate} onChange={(e) => setFormState((prev) => ({ ...prev, lastWorkingDate: e.target.value }))} />
                </div>
                <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
                  {renderUploadCard("Resignation Letter (PDF)", ".pdf", DOCUMENT_TYPE_BY_KEY.resignationLetter)}
                  {renderUploadCard("Full and Final Settlement (PDF)", ".pdf", DOCUMENT_TYPE_BY_KEY.fullAndFinal)}
                </div>
              </div>
            </section>
          )}

          <div className="flex justify-end">
            <Button type="button" onClick={saveDetails} disabled={saving} className="rounded-xl bg-slate-900 text-white hover:bg-slate-800">
              {saving ? "Saving..." : "Save Details"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="salary" className="mt-0">
          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Salary Breakdown</p>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {salaryYears.map((year) => (
                      <SelectItem key={year} value={year}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="max-h-[470px] space-y-2 overflow-y-auto pr-1">
                {salaryRows.length === 0 ? (
                  <p className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500">No salary records found for {selectedYear}.</p>
                ) : (
                  salaryRows.map((row) => (
                    <div key={row.id} className="rounded-xl border border-slate-200 p-3">
                      <p className="text-sm font-bold text-slate-900">{new Date(row.month).toLocaleString("en-US", { month: "short", year: "numeric" })}</p>
                      <p className="mt-2 text-sm text-slate-700">
                        Total Fixed Salary earned: <span className="font-semibold text-slate-900">₹ {row.fixed.toLocaleString()}</span>
                      </p>
                      <p className="text-sm text-slate-700">
                        Incentive: <span className="font-semibold text-emerald-700">₹ {row.incentive.toLocaleString()}</span>
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Yearly Salary Graph</p>
                <div className="flex items-center gap-2">
                  <Select value={statementRange} onValueChange={setStatementRange}>
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="current_month">Current Month</SelectItem>
                      <SelectItem value="past_6_months">Past 6 Months</SelectItem>
                      <SelectItem value="this_year">This Year</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="button" onClick={handleStatementAction} disabled={downloading} className="rounded-lg bg-slate-900 text-white hover:bg-slate-800">
                    {downloading ? "Preparing..." : statementRange === "current_month" ? "View" : "Download Zip"}
                  </Button>
                </div>
              </div>

              <div className="h-[420px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="fixed" name="Fixed Salary" stackId="salary" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="incentive" name="Incentive" stackId="salary" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="responsibilities" className="mt-0 space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Responsibilities Documents</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {renderUploadCard("Offer Letter (PDF)", ".pdf", DOCUMENT_TYPE_BY_KEY.offerLetter)}
              {renderUploadCard("Job Description (PDF)", ".pdf", DOCUMENT_TYPE_BY_KEY.jobDescription)}
            </div>
          </section>
        </TabsContent>
      </div>
    </Tabs>
  );
}
