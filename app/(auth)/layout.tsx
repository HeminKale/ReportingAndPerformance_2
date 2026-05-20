import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--ws-paper-white)", fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Minimal navbar */}
      <header
        className="w-full border-b"
        style={{ borderColor: "var(--ws-soft-gray)" }}
      >
        <div className="mx-auto max-w-6xl flex h-14 items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white text-xs font-bold"
              style={{ background: "var(--ws-indigo-cta)" }}
            >
              W
            </span>
            <span className="text-base font-semibold tracking-tight" style={{ color: "var(--ws-faded-charcoal)" }}>
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

      {/* Centered form area */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {children}
        </div>
      </main>

      {/* Footer note */}
      <footer className="py-4 text-center text-xs" style={{ color: "var(--ws-dusty-sage)" }}>
        © 2026 Worksphere · All rights reserved
      </footer>
    </div>
  );
}
