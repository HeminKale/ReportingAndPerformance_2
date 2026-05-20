import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: userData } = await supabase
      .from("users")
      .select("organization_id, organizations(slug)")
      .eq("id", user.id)
      .single();

    if (userData?.organizations) {
      const orgSlug = (userData.organizations as any).slug;
      redirect(`/org/${orgSlug}/dashboard`);
    }
  }

  return (
    <div className="ws-landing min-h-screen">
      {/* ── Navbar ── */}
      <header
        className="sticky top-0 z-50 w-full border-b"
        style={{
          background: "rgba(254,253,252,0.92)",
          backdropFilter: "blur(12px)",
          borderColor: "var(--ws-soft-gray)",
        }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white text-sm font-bold"
              style={{ background: "var(--ws-indigo-cta)" }}
            >
              W
            </span>
            <span className="text-lg font-semibold tracking-tight" style={{ color: "var(--ws-faded-charcoal)" }}>
              Worksphere
            </span>
          </Link>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1">
            {["Features", "How it works", "For Managers", "Pricing"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(/ /g, "-")}`}
                className="px-3.5 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-black/5"
                style={{ color: "var(--ws-subtle-ash)" }}
              >
                {item}
              </a>
            ))}
          </nav>

          {/* CTA buttons */}
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="px-4 py-2 rounded-[15px] text-sm font-semibold border transition-colors hover:bg-black/5"
              style={{
                color: "var(--ws-faded-charcoal)",
                borderColor: "var(--ws-soft-gray)",
              }}
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 rounded-[15px] text-sm font-semibold text-white transition-all hover:-translate-y-0.5"
              style={{
                background: "var(--ws-indigo-cta)",
                boxShadow: "var(--ws-shadow-lg)",
              }}
            >
              Get started free
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-16 flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
        {/* Left — text */}
        <div className="flex-1 ws-animate-fade-up">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-6"
            style={{
              background: "var(--ws-indigo-light)",
              color: "var(--ws-indigo-cta)",
              borderRadius: "var(--ws-radius-badge)",
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--ws-indigo-cta)" }}
            />
            Now with team leaderboards
          </span>

          <h1
            className="text-5xl lg:text-6xl font-bold tracking-tight leading-tight mb-6"
            style={{ color: "var(--ws-faded-charcoal)", letterSpacing: "-0.025em" }}
          >
            Work hard.
            <br />
            Earn XP.
            <br />
            <span style={{ color: "var(--ws-indigo-cta)" }}>Level up.</span>
          </h1>

          <p
            className="text-lg leading-relaxed mb-8 max-w-md"
            style={{ color: "var(--ws-subtle-ash)" }}
          >
            Worksphere turns your team's daily tasks into a rewarding game — earn XP, climb ranks,
            hit streaks, and watch productivity soar. No more boring dashboards.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="px-6 py-3 rounded-[15px] text-sm font-semibold text-white transition-all hover:-translate-y-0.5"
              style={{
                background: "var(--ws-indigo-cta)",
                boxShadow: "var(--ws-shadow-lg)",
              }}
            >
              Start for free
            </Link>
            <a
              href="#how-it-works"
              className="px-6 py-3 rounded-[15px] text-sm font-semibold border transition-colors hover:bg-black/5"
              style={{
                color: "var(--ws-faded-charcoal)",
                borderColor: "var(--ws-soft-gray)",
              }}
            >
              See how it works
            </a>
          </div>

          {/* Social proof */}
          <p className="mt-6 text-xs" style={{ color: "var(--ws-dusty-sage)" }}>
            Trusted by 200+ teams — no credit card required
          </p>
        </div>

        {/* Right — mock app UI */}
        <div className="flex-1 flex justify-center ws-animate-fade-up ws-animate-fade-up-delay-2">
          <div className="ws-float w-full max-w-sm">
            {/* Mock hero card */}
            <div
              className="rounded-2xl p-6 text-white shadow-2xl"
              style={{ background: "linear-gradient(135deg, #312e81 0%, #4338ca 50%, #4f46e5 100%)" }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-indigo-200 text-xs font-medium uppercase tracking-widest mb-1">Welcome back</p>
                  <p className="text-lg font-bold">Alex Chen</p>
                </div>
                <div
                  className="ws-rank-pulse flex h-12 w-12 items-center justify-center rounded-full text-xs font-bold"
                  style={{ background: "rgba(255,255,255,0.15)", border: "2px solid rgba(255,255,255,0.3)" }}
                >
                  Lvl 7
                </div>
              </div>

              {/* XP bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-indigo-200 mb-1.5">
                  <span>XP to next rank</span>
                  <span>2,340 / 3,000</span>
                </div>
                <div className="h-2.5 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }}>
                  <div
                    className="ws-xp-shimmer h-2.5 rounded-full"
                    style={{ width: "78%" }}
                  />
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 gap-3">
                <div
                  className="rounded-xl p-3 text-center"
                  style={{ background: "rgba(255,255,255,0.1)" }}
                >
                  <p className="text-xl font-bold">14</p>
                  <p className="text-indigo-200 text-xs">Day streak</p>
                </div>
                <div
                  className="rounded-xl p-3 text-center"
                  style={{ background: "rgba(255,255,255,0.1)" }}
                >
                  <p className="text-xl font-bold">96%</p>
                  <p className="text-indigo-200 text-xs">Completion</p>
                </div>
              </div>
            </div>

            {/* Mock task card */}
            <div
              className="mt-3 rounded-xl p-4 flex items-center justify-between"
              style={{
                background: "var(--ws-paper-white)",
                boxShadow: "var(--ws-shadow-card)",
                border: "1px solid var(--ws-soft-gray)",
                borderRadius: "var(--ws-radius-card)",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-5 w-5 rounded-full border-2 flex items-center justify-center"
                  style={{ borderColor: "var(--ws-indigo-cta)" }}
                />
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--ws-faded-charcoal)" }}>
                    Submit weekly report
                  </p>
                  <p className="text-xs" style={{ color: "var(--ws-subtle-ash)" }}>Due today</p>
                </div>
              </div>
              <span
                className="px-2 py-0.5 text-xs font-semibold"
                style={{
                  background: "var(--ws-indigo-light)",
                  color: "var(--ws-indigo-cta)",
                  borderRadius: "var(--ws-radius-badge)",
                }}
              >
                +50 XP
              </span>
            </div>

            <div
              className="mt-2 rounded-xl p-4 flex items-center justify-between"
              style={{
                background: "var(--ws-paper-white)",
                boxShadow: "var(--ws-shadow-card)",
                border: "1px solid var(--ws-soft-gray)",
                borderRadius: "var(--ws-radius-card)",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-5 w-5 rounded-full flex items-center justify-center"
                  style={{ background: "#f0fdf4", border: "2px solid #4c7a45" }}
                >
                  <svg className="h-2.5 w-2.5" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#4c7a45" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium line-through" style={{ color: "var(--ws-dusty-sage)" }}>
                    Client call prep
                  </p>
                  <p className="text-xs" style={{ color: "var(--ws-subtle-ash)" }}>Completed</p>
                </div>
              </div>
              <span
                className="px-2 py-0.5 text-xs font-semibold"
                style={{
                  background: "#f0f6df",
                  color: "#446c3d",
                  borderRadius: "var(--ws-radius-badge)",
                }}
              >
                +80 XP
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <div style={{ background: "var(--ws-light-peach)", borderTop: "1px solid #f0e8e0", borderBottom: "1px solid #f0e8e0" }}>
        <div className="mx-auto max-w-6xl px-6 py-8 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          {[
            { value: "50,000+", label: "Tasks completed daily" },
            { value: "10,000+", label: "XP earned every day" },
            { value: "99%", label: "On-time task rate" },
          ].map((stat) => (
            <div key={stat.label}>
              <p
                className="text-3xl font-bold tracking-tight"
                style={{ color: "var(--ws-faded-charcoal)" }}
              >
                {stat.value}
              </p>
              <p className="text-sm mt-1" style={{ color: "var(--ws-subtle-ash)" }}>
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Feature 1 — Tasks that reward you ── */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-24 flex flex-col lg:flex-row items-center gap-16">
        {/* Text */}
        <div className="flex-1 ws-animate-fade-up">
          <span
            className="text-xs font-bold uppercase tracking-widest mb-3 block"
            style={{ color: "var(--ws-indigo-cta)" }}
          >
            Task management
          </span>
          <h2
            className="text-4xl font-bold tracking-tight mb-5 leading-tight"
            style={{ color: "var(--ws-faded-charcoal)", letterSpacing: "-0.02em" }}
          >
            Tasks that
            <br />
            pay you back
          </h2>
          <p className="text-base leading-relaxed mb-6" style={{ color: "var(--ws-subtle-ash)" }}>
            Every task you complete earns XP. High-priority tasks earn more. Finish everything on
            time? Stack a bonus. Worksphere makes the daily grind feel like progress.
          </p>
          <ul className="space-y-3">
            {[
              "Earn XP on every task completion",
              "Priority multipliers for urgent work",
              "Daily quest bonuses for streaks",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-sm" style={{ color: "var(--ws-faded-charcoal)" }}>
                <span
                  className="h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "#f0fdf4" }}
                >
                  <svg className="h-2.5 w-2.5" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#4c7a45" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Visual */}
        <div className="flex-1 ws-animate-fade-up ws-animate-fade-up-delay-2">
          <div
            className="rounded-2xl p-6"
            style={{
              background: "var(--ws-paper-white)",
              boxShadow: "var(--ws-shadow-card)",
              border: "1px solid var(--ws-soft-gray)",
            }}
          >
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "var(--ws-dusty-sage)" }}>
              Today's tasks
            </p>
            {[
              { name: "Review Q2 proposals", xp: 120, priority: "High", done: false },
              { name: "Update project timeline", xp: 60, priority: "Medium", done: true },
              { name: "Team standup notes", xp: 40, priority: "Low", done: true },
              { name: "Deploy staging build", xp: 150, priority: "Urgent", done: false },
            ].map((task) => (
              <div
                key={task.name}
                className="flex items-center justify-between py-3 border-b last:border-0"
                style={{ borderColor: "var(--ws-soft-gray)" }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-4 w-4 rounded-full border-2 flex-shrink-0"
                    style={{
                      borderColor: task.done ? "#4c7a45" : "var(--ws-soft-gray)",
                      background: task.done ? "#f0fdf4" : "transparent",
                    }}
                  />
                  <span
                    className="text-sm"
                    style={{
                      color: task.done ? "var(--ws-dusty-sage)" : "var(--ws-faded-charcoal)",
                      textDecoration: task.done ? "line-through" : "none",
                    }}
                  >
                    {task.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="px-2 py-0.5 text-xs font-semibold"
                    style={{
                      background: task.priority === "Urgent" ? "#fef2f2" : task.priority === "High" ? "#fff7ed" : "var(--ws-light-peach)",
                      color: task.priority === "Urgent" ? "#dc2626" : task.priority === "High" ? "#ea580c" : "var(--ws-subtle-ash)",
                      borderRadius: "var(--ws-radius-badge)",
                    }}
                  >
                    {task.priority}
                  </span>
                  <span
                    className="px-2 py-0.5 text-xs font-semibold"
                    style={{
                      background: "var(--ws-indigo-light)",
                      color: "var(--ws-indigo-cta)",
                      borderRadius: "var(--ws-radius-badge)",
                    }}
                  >
                    +{task.xp} XP
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature 2 — Climb the ranks ── */}
      <section
        id="how-it-works"
        style={{ background: "var(--ws-light-peach)" }}
        className="py-24"
      >
        <div className="mx-auto max-w-6xl px-6 flex flex-col lg:flex-row-reverse items-center gap-16">
          {/* Text */}
          <div className="flex-1 ws-animate-fade-up">
            <span
              className="text-xs font-bold uppercase tracking-widest mb-3 block"
              style={{ color: "var(--ws-indigo-cta)" }}
            >
              Rank system
            </span>
            <h2
              className="text-4xl font-bold tracking-tight mb-5 leading-tight"
              style={{ color: "var(--ws-faded-charcoal)", letterSpacing: "-0.02em" }}
            >
              Climb the
              <br />
              ranks
            </h2>
            <p className="text-base leading-relaxed mb-6" style={{ color: "var(--ws-subtle-ash)" }}>
              Starting from Rookie, every XP point pushes you closer to the next title. The
              leaderboard resets monthly — so every employee gets a fresh shot at glory.
            </p>
            <Link
              href="/signup"
              className="inline-block px-5 py-2.5 rounded-[15px] text-sm font-semibold text-white transition-all hover:-translate-y-0.5"
              style={{
                background: "var(--ws-indigo-cta)",
                boxShadow: "var(--ws-shadow-lg)",
              }}
            >
              Start climbing
            </Link>
          </div>

          {/* Rank ladder visual */}
          <div className="flex-1 ws-animate-fade-up ws-animate-fade-up-delay-2">
            <div className="space-y-3">
              {[
                { rank: "Legend", xp: "10,000+", color: "#f59e0b", bg: "#fffbeb", active: false },
                { rank: "Platinum", xp: "7,500+", color: "#6366f1", bg: "#eef2ff", active: false },
                { rank: "Gold", xp: "5,000+", color: "#d97706", bg: "#fef3c7", active: true },
                { rank: "Silver", xp: "2,500+", color: "#6b7280", bg: "#f9fafb", active: false },
                { rank: "Bronze", xp: "1,000+", color: "#b45309", bg: "#fef9ee", active: false },
                { rank: "Rookie", xp: "0+", color: "#9ca3af", bg: "#f3f4f6", active: false },
              ].map((r) => (
                <div
                  key={r.rank}
                  className="flex items-center justify-between rounded-xl px-5 py-3.5 transition-transform"
                  style={{
                    background: r.active ? r.bg : "var(--ws-paper-white)",
                    border: `1px solid ${r.active ? r.color + "40" : "var(--ws-soft-gray)"}`,
                    boxShadow: r.active ? `var(--ws-shadow-card)` : "var(--ws-shadow-subtle)",
                    transform: r.active ? "scale(1.02)" : "scale(1)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: r.bg, color: r.color, border: `2px solid ${r.color}40` }}
                    >
                      {r.rank[0]}
                    </span>
                    <span className="font-semibold text-sm" style={{ color: r.active ? r.color : "var(--ws-faded-charcoal)" }}>
                      {r.rank}
                    </span>
                    {r.active && (
                      <span
                        className="px-1.5 py-0.5 text-xs font-bold"
                        style={{ background: r.color + "20", color: r.color, borderRadius: "4px" }}
                      >
                        You are here
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-medium" style={{ color: "var(--ws-subtle-ash)" }}>
                    {r.xp} XP
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature 3 — Manager approvals ── */}
      <section id="for-managers" className="mx-auto max-w-6xl px-6 py-24 flex flex-col lg:flex-row items-center gap-16">
        {/* Text */}
        <div className="flex-1 ws-animate-fade-up">
          <span
            className="text-xs font-bold uppercase tracking-widest mb-3 block"
            style={{ color: "var(--ws-indigo-cta)" }}
          >
            For managers
          </span>
          <h2
            className="text-4xl font-bold tracking-tight mb-5 leading-tight"
            style={{ color: "var(--ws-faded-charcoal)", letterSpacing: "-0.02em" }}
          >
            Approve tasks.
            <br />
            Award XP instantly.
          </h2>
          <p className="text-base leading-relaxed mb-6" style={{ color: "var(--ws-subtle-ash)" }}>
            Managers get a clean panel to review task submissions, verify attendance, track
            mistakes, and assign bonus XP — all in one place. Recognition happens in real time.
          </p>
          <ul className="space-y-3">
            {[
              "One-click task verification",
              "Attendance and leave management",
              "Real-time team performance reports",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-sm" style={{ color: "var(--ws-faded-charcoal)" }}>
                <span
                  className="h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "var(--ws-indigo-light)" }}
                >
                  <svg className="h-2.5 w-2.5" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#4f46e5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Visual — manager panel mockup */}
        <div className="flex-1 ws-animate-fade-up ws-animate-fade-up-delay-2">
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              boxShadow: "var(--ws-shadow-card)",
              border: "1px solid var(--ws-soft-gray)",
            }}
          >
            {/* Panel header */}
            <div
              className="px-5 py-3 flex items-center gap-2 border-b"
              style={{ background: "#1e1b4b", borderColor: "#312e81" }}
            >
              <span className="text-white text-xs font-semibold">Task Verifications</span>
              <span
                className="px-1.5 py-0.5 text-xs font-bold rounded-full"
                style={{ background: "#ef4444", color: "white" }}
              >
                3
              </span>
            </div>

            {/* Verification rows */}
            {[
              { name: "Priya Sharma", task: "Monthly sales report", xp: 100 },
              { name: "James O'Brien", task: "Client onboarding deck", xp: 80 },
              { name: "Mei Lin", task: "QA testing sprint 12", xp: 120 },
            ].map((row, i) => (
              <div
                key={row.name}
                className="flex items-center justify-between px-5 py-4 border-b last:border-0"
                style={{
                  background: "var(--ws-paper-white)",
                  borderColor: "var(--ws-soft-gray)",
                }}
              >
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--ws-faded-charcoal)" }}>{row.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--ws-subtle-ash)" }}>{row.task}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors"
                    style={{
                      color: "var(--ws-faded-charcoal)",
                      borderColor: "var(--ws-soft-gray)",
                    }}
                  >
                    Review
                  </button>
                  <button
                    className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg"
                    style={{ background: "var(--ws-indigo-cta)" }}
                  >
                    Approve +{row.xp} XP
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section
        style={{ background: "var(--ws-light-peach)", borderTop: "1px solid #f0e8e0" }}
        className="py-24"
      >
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-14 ws-animate-fade-up">
            <h2
              className="text-3xl font-bold tracking-tight"
              style={{ color: "var(--ws-faded-charcoal)", letterSpacing: "-0.02em" }}
            >
              Teams love it
            </h2>
            <p className="mt-3 text-base" style={{ color: "var(--ws-subtle-ash)" }}>
              From startups to enterprise — Worksphere transforms how teams feel about work.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                quote:
                  "Our team's task completion rate jumped from 71% to 96% in the first month. The XP system makes people genuinely excited to finish their work.",
                name: "Ananya Mehta",
                role: "Operations Lead, Fintech startup",
              },
              {
                quote:
                  "Approvals used to sit in a queue for days. Now managers are competing to approve fastest. It's changed the whole culture.",
                name: "David Okafor",
                role: "Engineering Manager, SaaS company",
              },
              {
                quote:
                  "I didn't expect a productivity tool to actually motivate my team. The streak system alone has cut our missed deadlines by half.",
                name: "Sarah Kim",
                role: "HR Director, E-commerce brand",
              },
            ].map((t) => (
              <div
                key={t.name}
                className="rounded-xl p-6"
                style={{
                  background: "var(--ws-paper-white)",
                  boxShadow: "var(--ws-shadow-subtle)",
                  border: "1px solid rgba(37,34,30,0.08)",
                  borderRadius: "var(--ws-radius-card)",
                }}
              >
                <p
                  className="text-base leading-relaxed mb-5"
                  style={{
                    color: "var(--ws-faded-charcoal)",
                    fontFamily: "Georgia, 'Times New Roman', serif",
                    fontStyle: "italic",
                    lineHeight: "1.8",
                  }}
                >
                  "{t.quote}"
                </p>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--ws-faded-charcoal)" }}>{t.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--ws-subtle-ash)" }}>{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="mx-auto max-w-6xl px-6 py-24 text-center ws-animate-fade-up">
        <h2
          className="text-4xl font-bold tracking-tight mb-5"
          style={{ color: "var(--ws-faded-charcoal)", letterSpacing: "-0.025em" }}
        >
          Ready to level up
          <br />
          your team?
        </h2>
        <p className="text-lg mb-8 max-w-md mx-auto" style={{ color: "var(--ws-subtle-ash)" }}>
          Join hundreds of teams already earning XP, climbing ranks, and hitting goals — together.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup"
            className="px-8 py-3.5 rounded-[15px] text-sm font-semibold text-white transition-all hover:-translate-y-0.5"
            style={{
              background: "var(--ws-indigo-cta)",
              boxShadow: "var(--ws-shadow-lg)",
            }}
          >
            Start for free
          </Link>
          <Link
            href="/login"
            className="px-8 py-3.5 rounded-[15px] text-sm font-semibold border transition-colors hover:bg-black/5"
            style={{
              color: "var(--ws-faded-charcoal)",
              borderColor: "var(--ws-soft-gray)",
            }}
          >
            Sign in
          </Link>
        </div>
        <p className="mt-5 text-xs" style={{ color: "var(--ws-dusty-sage)" }}>
          No credit card required · Cancel anytime
        </p>
      </section>

      {/* ── Footer ── */}
      <footer
        style={{
          background: "var(--ws-light-peach)",
          borderTop: "1px solid #f0e8e0",
        }}
        className="py-12"
      >
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col md:flex-row items-start justify-between gap-10">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-white text-xs font-bold"
                  style={{ background: "var(--ws-indigo-cta)" }}
                >
                  W
                </span>
                <span className="font-semibold" style={{ color: "var(--ws-faded-charcoal)" }}>
                  Worksphere
                </span>
              </div>
              <p className="text-sm max-w-xs" style={{ color: "var(--ws-subtle-ash)" }}>
                Gamified employee task management that makes teams want to perform.
              </p>
            </div>

            {/* Links */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8 text-sm">
              {[
                {
                  heading: "Product",
                  links: ["Features", "How it works", "For Managers", "Pricing"],
                },
                {
                  heading: "Company",
                  links: ["About", "Blog", "Careers", "Contact"],
                },
                {
                  heading: "Legal",
                  links: ["Privacy", "Terms", "Security"],
                },
              ].map((col) => (
                <div key={col.heading}>
                  <p className="font-semibold mb-3" style={{ color: "var(--ws-faded-charcoal)" }}>
                    {col.heading}
                  </p>
                  <ul className="space-y-2">
                    {col.links.map((link) => (
                      <li key={link}>
                        <a
                          href="#"
                          className="transition-colors hover:underline"
                          style={{ color: "var(--ws-subtle-ash)" }}
                        >
                          {link}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div
            className="mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs"
            style={{ borderTop: "1px solid #f0e8e0", color: "var(--ws-dusty-sage)" }}
          >
            <p>© 2026 Worksphere. All rights reserved.</p>
            <p>Made for teams that want to win.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
