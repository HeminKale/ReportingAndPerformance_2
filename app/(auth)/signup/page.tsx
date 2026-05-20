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
      if (!response.ok) throw new Error(data.error || "Signup failed");

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      toast({ title: "Account created", description: "Your account has been created successfully" });
      router.push(`/org/${orgSlug}/dashboard`);
      router.refresh();
    } catch (error: any) {
      toast({ title: "Signup failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleOrgNameChange = (name: string) => {
    setOrgName(name);
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setOrgSlug(slug);
  };

  /* Todoist Form Input Field spec */
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "7px 32px 7px 35px",
    borderRadius: "var(--radius-default)",
    border: "1.5px solid var(--color-soft-gray)",
    background: "transparent",
    color: "var(--color-faded-charcoal)",
    fontSize: "var(--text-sm-2)",
    lineHeight: "1.5",
    outline: "none",
    transition: "border-color 150ms",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "var(--text-xs)",
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    color: "var(--color-faded-charcoal)",
    marginBottom: "var(--spacing-8)",
  };

  const focusOn  = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor = "var(--color-faded-charcoal)"; };
  const focusOff = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor = "var(--color-soft-gray)"; };

  return (
    <div
      style={{
        background: "var(--color-paper-white)",
        borderRadius: "var(--radius-cards)",
        border: "1px solid var(--color-soft-gray)",
        boxShadow: "var(--shadow-subtle)",
        padding: "var(--spacing-32)",
      }}
    >
      {/* Header */}
      <div className="text-center mb-8">
        <div
          className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl text-white font-bold text-lg"
          style={{ background: "var(--color-indigo-cta)" }}
        >
          W
        </div>
        <h1
          style={{
            fontSize: "var(--text-xl-3)",
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: "var(--color-faded-charcoal)",
          }}
        >
          Create your workspace
        </h1>
        <p
          className="mt-1.5"
          style={{ fontSize: "var(--text-sm-2)", color: "var(--color-subtle-ash)" }}
        >
          Set up Worksphere for your team in seconds
        </p>
      </div>

      <form onSubmit={handleSignup} className="space-y-5">

        {/* Section label */}
        <p
          className="uppercase"
          style={{
            fontSize: "var(--text-xs)",
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: "var(--color-dusty-sage)",
          }}
        >
          Your details
        </p>

        {/* Full name */}
        <div>
          <label style={labelStyle}>Full name</label>
          <div className="relative">
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "var(--color-dusty-sage)" }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </span>
            <input
              id="fullName" type="text" placeholder="Alex Chen"
              value={fullName} onChange={(e) => setFullName(e.target.value)}
              required style={inputStyle} onFocus={focusOn} onBlur={focusOff}
            />
          </div>
        </div>

        {/* Email */}
        <div>
          <label style={labelStyle}>Email</label>
          <div className="relative">
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "var(--color-dusty-sage)" }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12v8a1 1 0 01-1 1H3a1 1 0 01-1-1V4zm0 0l6 5 6-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            <input
              id="email" type="email" placeholder="you@company.com"
              value={email} onChange={(e) => setEmail(e.target.value)}
              required style={inputStyle} onFocus={focusOn} onBlur={focusOff}
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label style={labelStyle}>Password</label>
          <div className="relative">
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "var(--color-dusty-sage)" }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <rect x="3" y="7" width="10" height="8" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </span>
            <input
              id="password" type="password" placeholder="At least 6 characters"
              value={password} onChange={(e) => setPassword(e.target.value)}
              required minLength={6} style={inputStyle} onFocus={focusOn} onBlur={focusOff}
            />
          </div>
        </div>

        {/* Divider */}
        <div
          className="border-t pt-5"
          style={{ borderColor: "var(--color-soft-gray)" }}
        >
          <p
            className="uppercase mb-4"
            style={{
              fontSize: "var(--text-xs)",
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "var(--color-dusty-sage)",
            }}
          >
            Organization
          </p>

          {/* Org name */}
          <div className="mb-4">
            <label style={labelStyle}>Organization name</label>
            <div className="relative">
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: "var(--color-dusty-sage)" }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="4" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M8 9v2m-2-1h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </span>
              <input
                id="orgName" type="text" placeholder="Acme Corporation"
                value={orgName} onChange={(e) => handleOrgNameChange(e.target.value)}
                required style={inputStyle} onFocus={focusOn} onBlur={focusOff}
              />
            </div>
          </div>

          {/* Org slug */}
          <div>
            <label style={labelStyle}>Workspace URL</label>
            <div className="relative">
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: "var(--color-dusty-sage)" }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M2 8h12M8 2c-2 2-3 3.5-3 6s1 4 3 6M8 2c2 2 3 3.5 3 6s-1 4-3 6" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
              </span>
              <input
                id="orgSlug" type="text" placeholder="acme-corporation"
                value={orgSlug} onChange={(e) => setOrgSlug(e.target.value)}
                required pattern="[a-z0-9-]+" style={inputStyle} onFocus={focusOn} onBlur={focusOff}
              />
            </div>
            <p
              className="mt-1.5"
              style={{ fontSize: "var(--text-xs)", color: "var(--color-dusty-sage)" }}
            >
              worksphere.app/org/{orgSlug || "your-workspace"}
            </p>
          </div>
        </div>

        {/* Hero Pill Button — submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
          style={{
            padding: "12px 27px",
            background: "rgba(37, 34, 30, 0.83)",
            color: "var(--color-paper-white)",
            border: "1px solid rgba(37, 34, 30, 0.2)",
            borderRadius: "var(--radius-buttons)",
            fontSize: "var(--text-base-2)",
            fontWeight: 600,
            boxShadow: "var(--shadow-lg)",
          }}
        >
          {loading ? "Creating workspace…" : "Create workspace"}
        </button>
      </form>

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t" style={{ borderColor: "var(--color-soft-gray)" }} />
        </div>
        <div className="relative flex justify-center">
          <span
            className="px-3"
            style={{ background: "var(--color-paper-white)", fontSize: "var(--text-xs)", color: "var(--color-dusty-sage)" }}
          >
            Already have a workspace?
          </span>
        </div>
      </div>

      {/* Text Only Button */}
      <Link
        href="/login"
        className="flex w-full items-center justify-center transition-colors hover:bg-black/5"
        style={{
          padding: "9px 14px",
          borderRadius: "var(--radius-buttons)",
          border: "1px solid var(--color-faded-charcoal)",
          background: "transparent",
          color: "var(--color-faded-charcoal)",
          fontSize: "var(--text-sm-2)",
          fontWeight: 500,
        }}
      >
        Sign in instead
      </Link>
    </div>
  );
}
