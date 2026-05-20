import Link from "next/link";
import { AuthGamePanel } from "@/components/auth/auth-game-panel";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col md:flex-row"
      style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Left — animated gamification panel (hidden on mobile) */}
      <div className="hidden md:flex md:w-1/2 lg:w-[55%] relative overflow-hidden">
        <AuthGamePanel />
      </div>

      {/* Right — form column */}
      <div
        className="flex flex-1 flex-col min-h-screen"
        style={{ background: "var(--ws-paper-white)" }}
      >
        {/* Minimal top bar */}
        <header
          className="w-full border-b shrink-0"
          style={{ borderColor: "var(--ws-soft-gray)" }}
        >
          <div className="flex h-14 items-center justify-between px-6">
            <Link href="/" className="flex items-center gap-2">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-lg text-white text-xs font-bold"
                style={{ background: "var(--ws-indigo-cta)" }}
              >
                W
              </span>
              <span
                className="text-base font-semibold tracking-tight"
                style={{ color: "var(--ws-faded-charcoal)" }}
              >
                Worksphere
              </span>
            </Link>
            <Link
              href="/"
              className="text-sm transition-colors hover:underline"
              style={{ color: "var(--ws-subtle-ash)" }}
            >
              Back to home
            </Link>
          </div>
        </header>

        {/* Centered form */}
        <main className="flex flex-1 items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">{children}</div>
        </main>

        <footer className="py-4 text-center text-xs shrink-0" style={{ color: "var(--ws-dusty-sage)" }}>
          © 2026 Worksphere · All rights reserved
        </footer>
      </div>
    </div>
  );
}
