"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/lib/hooks/use-toast";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullName, orgName, orgSlug }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Signup failed");
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      toast({
        title: "Account created",
        description: "Your account has been created successfully",
      });

      router.push(`/org/${orgSlug}/dashboard`);
      router.refresh();
    } catch (error: any) {
      toast({
        title: "Signup failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOrgNameChange = (name: string) => {
    setOrgName(name);
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    setOrgSlug(slug);
  };

  const inputStyle: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1.5px solid var(--ws-soft-gray)",
    background: "transparent",
    color: "var(--ws-faded-charcoal)",
    fontSize: "14px",
    lineHeight: "1.5",
    width: "100%",
  };

  const labelStyle = "block text-xs font-semibold uppercase tracking-wider mb-2";

  return (
    <div
      className="rounded-2xl px-8 py-10"
      style={{
        background: "var(--ws-paper-white)",
        border: "1px solid var(--ws-soft-gray)",
        boxShadow: "var(--ws-shadow-card)",
      }}
    >
      {/* Header */}
      <div className="mb-8 text-center">
        <div
          className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl text-white font-bold text-lg"
          style={{ background: "var(--ws-indigo-cta)" }}
        >
          W
        </div>
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: "var(--ws-faded-charcoal)", letterSpacing: "-0.02em" }}
        >
          Create your workspace
        </h1>
        <p className="mt-1.5 text-sm" style={{ color: "var(--ws-subtle-ash)" }}>
          Set up Worksphere for your team in seconds
        </p>
      </div>

      <form onSubmit={handleSignup} className="space-y-5">
        {/* Personal details section */}
        <div>
          <p
            className="text-xs font-bold uppercase tracking-widest mb-4"
            style={{ color: "var(--ws-dusty-sage)" }}
          >
            Your details
          </p>
          <div className="space-y-4">
            <div>
              <label htmlFor="fullName" className={labelStyle} style={{ color: "var(--ws-faded-charcoal)" }}>
                Full name
              </label>
              <input
                id="fullName"
                type="text"
                placeholder="Alex Chen"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                style={inputStyle}
                className="outline-none focus:border-indigo-400 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="email" className={labelStyle} style={{ color: "var(--ws-faded-charcoal)" }}>
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={inputStyle}
                className="outline-none focus:border-indigo-400 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="password" className={labelStyle} style={{ color: "var(--ws-faded-charcoal)" }}>
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                style={inputStyle}
                className="outline-none focus:border-indigo-400 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Divider */}
        <div
          className="border-t pt-5"
          style={{ borderColor: "var(--ws-soft-gray)" }}
        >
          <p
            className="text-xs font-bold uppercase tracking-widest mb-4"
            style={{ color: "var(--ws-dusty-sage)" }}
          >
            Organization
          </p>
          <div className="space-y-4">
            <div>
              <label htmlFor="orgName" className={labelStyle} style={{ color: "var(--ws-faded-charcoal)" }}>
                Organization name
              </label>
              <input
                id="orgName"
                type="text"
                placeholder="Acme Corporation"
                value={orgName}
                onChange={(e) => handleOrgNameChange(e.target.value)}
                required
                style={inputStyle}
                className="outline-none focus:border-indigo-400 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="orgSlug" className={labelStyle} style={{ color: "var(--ws-faded-charcoal)" }}>
                Workspace URL
              </label>
              <input
                id="orgSlug"
                type="text"
                placeholder="acme-corporation"
                value={orgSlug}
                onChange={(e) => setOrgSlug(e.target.value)}
                required
                pattern="[a-z0-9-]+"
                style={inputStyle}
                className="outline-none focus:border-indigo-400 transition-colors"
              />
              <p className="mt-1.5 text-xs" style={{ color: "var(--ws-dusty-sage)" }}>
                worksphere.app/org/{orgSlug || "your-workspace"}
              </p>
            </div>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
          style={{
            background: "var(--ws-indigo-cta)",
            borderRadius: "var(--ws-radius-btn)",
            boxShadow: "var(--ws-shadow-lg)",
          }}
        >
          {loading ? "Creating workspace…" : "Create workspace"}
        </button>
      </form>

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t" style={{ borderColor: "var(--ws-soft-gray)" }} />
        </div>
        <div className="relative flex justify-center">
          <span
            className="px-3 text-xs"
            style={{ background: "var(--ws-paper-white)", color: "var(--ws-dusty-sage)" }}
          >
            Already have a workspace?
          </span>
        </div>
      </div>

      {/* Sign in link */}
      <Link
        href="/login"
        className="flex w-full items-center justify-center py-2.5 text-sm font-semibold border transition-colors hover:bg-black/5"
        style={{
          borderRadius: "var(--ws-radius-btn)",
          borderColor: "var(--ws-soft-gray)",
          color: "var(--ws-faded-charcoal)",
        }}
      >
        Sign in instead
      </Link>
    </div>
  );
}
