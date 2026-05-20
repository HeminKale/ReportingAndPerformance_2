import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: "var(--color-paper-white)",
        fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* Minimal navbar */}
      <header
        className="w-full border-b"
        style={{ borderColor: "var(--color-soft-gray)" }}
      >
        <div className="mx-auto max-w-6xl flex h-14 items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white text-xs font-bold"
              style={{ background: "var(--color-indigo-cta)" }}
            >
              W
            </span>
            <span
              style={{
                fontSize: "var(--text-base-2)",
                fontWeight: 600,
                letterSpacing: "-0.005em",
                color: "var(--color-faded-charcoal)",
              }}
            >
              Worksphere
            </span>
          </Link>
          <Link
            href="/"
            className="transition-colors hover:underline"
            style={{ fontSize: "var(--text-sm-2)", color: "var(--color-subtle-ash)" }}
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

      <footer
        className="py-4 text-center"
        style={{ fontSize: "var(--text-xs)", color: "var(--color-dusty-sage)" }}
      >
        © 2026 Worksphere · All rights reserved
      </footer>
    </div>
  );
}
