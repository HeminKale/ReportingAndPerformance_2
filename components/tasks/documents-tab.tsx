"use client";

import { useMemo, useState } from "react";
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

type DocumentsTabProps = {
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

const PREVIOUS_SLIP_KEYS = ["prevSlip1", "prevSlip2", "prevSlip3"] as const;
type PreviousSlipKey = (typeof PREVIOUS_SLIP_KEYS)[number];

export function DocumentsTab({ isResigned }: DocumentsTabProps) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [statementRange, setStatementRange] = useState("current_month");
  const [docFiles, setDocFiles] = useState<Record<DocumentUploadKey, File | null>>({
    resume: null,
    aadhar: null,
    pan: null,
    photo: null,
    offerLetter: null,
    jobDescription: null,
    resignationLetter: null,
    fullAndFinal: null,
  });
  const [previousSlips, setPreviousSlips] = useState<Record<PreviousSlipKey, File | null>>({
    prevSlip1: null,
    prevSlip2: null,
    prevSlip3: null,
  });

  const [formState, setFormState] = useState({
    salaryBankAccount: "",
    ifscCode: "",
    fullName: "",
    gender: "",
    address: "",
    emergencyContact: "",
    uanNumber: "",
    lastWorkingDate: "",
  });

  const prevSlipCount = useMemo(
    () => Object.values(previousSlips).filter(Boolean).length,
    [previousSlips]
  );
  const salaryYears = useMemo(
    () => [currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(String),
    [currentYear]
  );
  const salaryRows = useMemo(
    () => [
      { month: "Jan", fixed: 42000, incentive: 4800 },
      { month: "Feb", fixed: 42000, incentive: 3000 },
      { month: "Mar", fixed: 42000, incentive: 6200 },
      { month: "Apr", fixed: 43000, incentive: 5000 },
      { month: "May", fixed: 43000, incentive: 4100 },
      { month: "Jun", fixed: 43000, incentive: 7300 },
      { month: "Jul", fixed: 44000, incentive: 4600 },
      { month: "Aug", fixed: 44000, incentive: 6900 },
      { month: "Sep", fixed: 44000, incentive: 3800 },
      { month: "Oct", fixed: 45000, incentive: 5200 },
      { month: "Nov", fixed: 45000, incentive: 6100 },
      { month: "Dec", fixed: 45000, incentive: 7700 },
    ],
    []
  );
  const statementActionLabel = statementRange === "current_month" ? "View" : "Download in a Zip";

  const handleSingleFile = (key: DocumentUploadKey, file: File | null) => {
    setDocFiles((prev) => ({ ...prev, [key]: file }));
  };

  const handlePreviousSlipFile = (key: PreviousSlipKey, file: File | null) => {
    setPreviousSlips((prev) => ({ ...prev, [key]: file }));
  };

  const renderUploadCard = (
    title: string,
    accept: string,
    file: File | null,
    onPick: (file: File | null) => void
  ) => (
    <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="text-xs text-slate-500">{file ? file.name : "No file uploaded"}</p>
        </div>
        <Label className="cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
          <Upload className="mr-1 inline h-3.5 w-3.5" />
          {file ? "Replace" : "Upload"}
          <Input
            type="file"
            className="hidden"
            accept={accept}
            onChange={(e) => onPick(e.target.files?.[0] || null)}
          />
        </Label>
      </div>
    </div>
  );

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
              {renderUploadCard("Resume", ".pdf,.doc,.docx", docFiles.resume, (file) =>
                handleSingleFile("resume", file)
              )}
              {renderUploadCard("Aadhar Card", ".pdf,.jpg,.jpeg,.png", docFiles.aadhar, (file) =>
                handleSingleFile("aadhar", file)
              )}
              {renderUploadCard("PAN Card", ".pdf,.jpg,.jpeg,.png", docFiles.pan, (file) =>
                handleSingleFile("pan", file)
              )}
              {renderUploadCard("Photo", ".jpg,.jpeg,.png,.webp", docFiles.photo, (file) =>
                handleSingleFile("photo", file)
              )}
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">
                  Previous Employer Salary Slips (up to 3)
                </p>
                <span className="text-xs font-semibold text-slate-500">{prevSlipCount}/3 uploaded</span>
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                {PREVIOUS_SLIP_KEYS.map((key, index) =>
                  renderUploadCard(
                    `Salary Slip ${index + 1}`,
                    ".pdf,.jpg,.jpeg,.png",
                    previousSlips[key],
                    (file) => handlePreviousSlipFile(key, file)
                  )
                )}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Employee Details</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Salary Bank Account Number</Label>
                <Input
                  value={formState.salaryBankAccount}
                  onChange={(e) => setFormState((prev) => ({ ...prev, salaryBankAccount: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>IFSC Code</Label>
                <Input
                  value={formState.ifscCode}
                  onChange={(e) => setFormState((prev) => ({ ...prev, ifscCode: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Name</Label>
                <Input
                  value={formState.fullName}
                  onChange={(e) => setFormState((prev) => ({ ...prev, fullName: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Gender</Label>
                <Input
                  value={formState.gender}
                  onChange={(e) => setFormState((prev) => ({ ...prev, gender: e.target.value }))}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Address</Label>
                <Input
                  value={formState.address}
                  onChange={(e) => setFormState((prev) => ({ ...prev, address: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Emergency Contact Number</Label>
                <Input
                  value={formState.emergencyContact}
                  onChange={(e) => setFormState((prev) => ({ ...prev, emergencyContact: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>UAN Account Number</Label>
                <Input
                  value={formState.uanNumber}
                  onChange={(e) => setFormState((prev) => ({ ...prev, uanNumber: e.target.value }))}
                />
              </div>
            </div>
          </section>

          {isResigned && (
            <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Alumni Details</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>Last Working Date</Label>
                  <Input
                    type="date"
                    value={formState.lastWorkingDate}
                    onChange={(e) => setFormState((prev) => ({ ...prev, lastWorkingDate: e.target.value }))}
                  />
                </div>
                <div className="md:col-span-2 grid gap-3 md:grid-cols-2">
                  {renderUploadCard("Resignation Letter (PDF)", ".pdf", docFiles.resignationLetter, (file) =>
                    handleSingleFile("resignationLetter", file)
                  )}
                  {renderUploadCard("Full and Final Settlement (PDF)", ".pdf", docFiles.fullAndFinal, (file) =>
                    handleSingleFile("fullAndFinal", file)
                  )}
                </div>
              </div>
            </section>
          )}

          <div className="flex justify-end">
            <Button type="button" className="rounded-xl bg-slate-900 text-white hover:bg-slate-800">
              Save Documents
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
                {salaryRows.map((row) => (
                  <div key={`${selectedYear}-${row.month}`} className="rounded-xl border border-slate-200 p-3">
                    <p className="text-sm font-bold text-slate-900">
                      {row.month} - {selectedYear}
                    </p>
                    <p className="mt-2 text-sm text-slate-700">
                      Total Fixed Salary earned:{" "}
                      <span className="font-semibold text-slate-900">₹ {row.fixed.toLocaleString()}</span>
                    </p>
                    <p className="text-sm text-slate-700">
                      Incentive:{" "}
                      <span className="font-semibold text-emerald-700">₹ {row.incentive.toLocaleString()}</span>
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
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
                      <SelectItem value="custom_range">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="button" className="rounded-lg bg-slate-900 text-white hover:bg-slate-800">
                    {statementActionLabel}
                  </Button>
                </div>
              </div>

              <div className="h-[420px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salaryRows}>
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
              {renderUploadCard("Offer Letter (PDF)", ".pdf", docFiles.offerLetter, (file) =>
                handleSingleFile("offerLetter", file)
              )}
              {renderUploadCard("Job Description (PDF)", ".pdf", docFiles.jobDescription, (file) =>
                handleSingleFile("jobDescription", file)
              )}
            </div>
          </section>
          <div className="flex justify-end">
            <Button type="button" className="rounded-xl bg-slate-900 text-white hover:bg-slate-800">
              Save Responsibilities
            </Button>
          </div>
        </TabsContent>
      </div>
    </Tabs>
  );
}
