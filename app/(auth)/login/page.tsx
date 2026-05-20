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
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

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
          toast({
            title: "Error",
            description: "Organization not found",
            variant: "destructive",
          });
        }
      }
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

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
          Welcome back
        </h1>
        <p className="mt-1.5 text-sm" style={{ color: "var(--ws-subtle-ash)" }}>
          Sign in to your Worksphere workspace
        </p>
      </div>

      <form onSubmit={handleLogin} className="space-y-5">
        {/* Email */}
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-semibold uppercase tracking-wider mb-2"
            style={{ color: "var(--ws-faded-charcoal)" }}
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full transition-colors outline-none focus:border-indigo-400"
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              border: "1.5px solid var(--ws-soft-gray)",
              background: "transparent",
              color: "var(--ws-faded-charcoal)",
              fontSize: "14px",
              lineHeight: "1.5",
            }}
          />
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="password"
              className="block text-xs font-semibold uppercase tracking-wider"
              style={{ color: "var(--ws-faded-charcoal)" }}
            >
              Password
            </label>
            <a
              href="#"
              className="text-xs transition-colors hover:underline"
              style={{ color: "var(--ws-indigo-cta)" }}
            >
              Forgot password?
            </a>
          </div>
          <input
            id="password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full transition-colors outline-none focus:border-indigo-400"
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              border: "1.5px solid var(--ws-soft-gray)",
              background: "transparent",
              color: "var(--ws-faded-charcoal)",
              fontSize: "14px",
              lineHeight: "1.5",
            }}
          />
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
          {loading ? "Signing in…" : "Sign in"}
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
            New to Worksphere?
          </span>
        </div>
      </div>

      {/* Sign up link */}
      <Link
        href="/signup"
        className="flex w-full items-center justify-center py-2.5 text-sm font-semibold border transition-colors hover:bg-black/5"
        style={{
          borderRadius: "var(--ws-radius-btn)",
          borderColor: "var(--ws-soft-gray)",
          color: "var(--ws-faded-charcoal)",
        }}
      >
        Create an account
      </Link>
    </div>
  );
}
