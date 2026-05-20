"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/lib/hooks/use-toast";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      if (data.user) {
        const { data: userData } = await supabase
          .from("users")
          .select("organization_id, organizations(slug)")
          .eq("id", data.user.id)
          .single();

        if (userData?.organizations) {
          const orgSlug = (userData.organizations as any).slug;
          router.push(`/org/${orgSlug}/dashboard`);
          router.refresh();
        } else {
          toast({ title: "Error", description: "Organization not found", variant: "destructive" });
        }
      }
    } catch (error: any) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  /* Todoist Form Input Field spec:
     background: transparent
     border: Faded Charcoal (#25221e)
     border-radius: 8px (--radius-default)
     padding: 7px vertical, 35px left, 32px right (icon-aware generous padding) */
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
          Welcome back
        </h1>
        <p
          className="mt-1.5"
          style={{ fontSize: "var(--text-sm-2)", color: "var(--color-subtle-ash)" }}
        >
          Sign in to your Worksphere workspace
        </p>
      </div>

      <form onSubmit={handleLogin} className="space-y-5">
        {/* Email field */}
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
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={inputStyle}
              onFocus={(e) => { e.target.style.borderColor = "var(--color-faded-charcoal)"; }}
              onBlur={(e)  => { e.target.style.borderColor = "var(--color-soft-gray)"; }}
            />
          </div>
        </div>

        {/* Password field */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label style={{ ...labelStyle, marginBottom: 0 }}>Password</label>
            <a
              href="#"
              className="transition-colors hover:underline"
              style={{ fontSize: "var(--text-xs)", color: "var(--color-accent-blue)" }}
            >
              Forgot password?
            </a>
          </div>
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
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={inputStyle}
              onFocus={(e) => { e.target.style.borderColor = "var(--color-faded-charcoal)"; }}
              onBlur={(e)  => { e.target.style.borderColor = "var(--color-soft-gray)"; }}
            />
          </div>
        </div>

        {/* Hero Pill Button — submit (exact Todoist spec) */}
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
          {loading ? "Signing in…" : "Sign in"}
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
            style={{
              background: "var(--color-paper-white)",
              fontSize: "var(--text-xs)",
              color: "var(--color-dusty-sage)",
            }}
          >
            New to Worksphere?
          </span>
        </div>
      </div>

      {/* Text Only Button — create account */}
      <Link
        href="/signup"
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
        Create an account
      </Link>
    </div>
  );
}
