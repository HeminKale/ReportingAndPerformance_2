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

      {/* ══ NAVBAR ══ */}
      <header
        className="sticky top-0 z-50 w-full border-b"
        style={{
          background: "rgba(254,253,252,0.94)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          borderColor: "var(--color-soft-gray)",
        }}
      >
        <div className="mx-auto flex h-[60px] max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white text-sm font-bold"
              style={{ background: "var(--color-indigo-cta)" }}
            >
              W
            </span>
            <span
              className="text-[17px] font-semibold"
              style={{ color: "var(--color-faded-charcoal)", letterSpacing: "-0.005em" }}
            >
              Worksphere
            </span>
          </Link>

          <nav className="hidden md:flex items-center">
            {["Features", "How it works", "For Managers", "Pricing"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(/ /g, "-")}`}
                className="px-3.5 py-2 rounded-lg text-[15px] transition-colors hover:bg-black/5"
                style={{ color: "var(--color-subtle-ash)", fontWeight: 400 }}
              >
                {item}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {/* Text Only Button */}
            <Link
              href="/login"
              className="px-[14px] py-[9px] rounded-lg text-[15px] border transition-colors hover:bg-black/5"
              style={{
                color: "var(--color-faded-charcoal)",
                borderColor: "var(--color-faded-charcoal)",
                background: "transparent",
              }}
            >
              Sign in
            </Link>
            {/* Primary Action Button */}
            <Link
              href="/signup"
              className="px-[16px] py-[12px] text-[15px] font-semibold text-white transition-all hover:-translate-y-0.5"
              style={{
                background: "var(--color-indigo-cta)",
                borderRadius: "var(--radius-buttons)",
                boxShadow: "var(--shadow-lg)",
              }}
            >
              Get started free
            </Link>
          </div>
        </div>
      </header>

      {/* ══ HERO ══ */}
      <section className="relative mx-auto max-w-6xl px-6 pt-20 pb-20 flex flex-col lg:flex-row items-center gap-12 lg:gap-16 overflow-hidden">

        {/* Decorative background stars (per DESIGN.md imagery spec) */}
        <div className="pointer-events-none absolute inset-0 select-none" aria-hidden="true">
          {[
            { top: "8%",  left: "6%",  size: 28, dur: "6s",  delay: "0s" },
            { top: "18%", left: "45%", size: 18, dur: "8s",  delay: "1s" },
            { top: "5%",  left: "72%", size: 36, dur: "5s",  delay: "0.5s" },
            { top: "60%", left: "2%",  size: 22, dur: "7s",  delay: "2s" },
            { top: "75%", left: "88%", size: 20, dur: "6.5s",delay: "1.5s" },
            { top: "40%", left: "92%", size: 14, dur: "9s",  delay: "0.8s" },
          ].map((s, i) => (
            <span
              key={i}
              className="ws-star absolute"
              style={{
                top: s.top,
                left: s.left,
                fontSize: s.size + "px",
                color: "#f0e8e0",
                "--dur": s.dur,
                animationDelay: s.delay,
              } as React.CSSProperties}
            >
              &#9733;
            </span>
          ))}
        </div>

        {/* Left — text */}
        <div className="relative flex-1 ws-animate-fade-up">
          <span
            className="inline-flex items-center gap-1.5 mb-6"
            style={{
              padding: "4px 10px",
              background: "var(--color-light-green-tint)",
              color: "var(--color-badge-green)",
              borderRadius: "var(--radius-badges)",
              fontSize: "var(--text-xs)",
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--color-badge-green)" }}
            />
            Simplify planning. Sync calendar. Ship on time.
          </span>

          {/* H1 — 55px display spec */}
          <h1
            className="mb-6"
            style={{
              fontSize: "var(--text-display)",
              fontWeight: 600,
              lineHeight: "var(--leading-display)",
              letterSpacing: "-0.010em",
              color: "var(--color-faded-charcoal)",
            }}
          >
            Simplify planning.
            <br />
            Own your calendar.
            <br />
            <span style={{ color: "var(--color-indigo-cta)" }}>Deliver every day.</span>
          </h1>

          {/* Body — 21px spec */}
          <p
            className="mb-8 max-w-md"
            style={{
              fontSize: "var(--text-xl-2)",
              fontWeight: 475,
              lineHeight: "var(--leading-xl-2)",
              letterSpacing: "0.005em",
              color: "var(--color-subtle-ash)",
            }}
          >
            Worksphere combines planning, calendar visibility, and gamified execution in one flow.
            Plan clearly, track deadlines, finish tasks faster, and reward consistent delivery.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            {/* Hero Pill Button — primary CTA (exact Todoist spec) */}
            <Link
              href="/signup"
              className="transition-all hover:-translate-y-0.5 active:translate-y-0"
              style={{
                display: "inline-block",
                padding: "12px 27px",
                background: "rgba(37, 34, 30, 0.83)",
                color: "var(--color-paper-white)",
                border: "1px solid var(--color-paper-white)",
                borderRadius: "var(--radius-buttons)",
                fontSize: "var(--text-base-2)",
                fontWeight: 600,
                boxShadow: "var(--shadow-lg)",
              }}
            >
              Start for free
            </Link>

            {/* Text Only Button — secondary CTA */}
            <a
              href="#how-it-works"
              style={{
                display: "inline-block",
                padding: "9px 14px",
                background: "transparent",
                color: "var(--color-faded-charcoal)",
                border: "1px solid var(--color-faded-charcoal)",
                borderRadius: "var(--radius-default)",
                fontSize: "var(--text-base-2)",
                fontWeight: 400,
              }}
              className="transition-colors hover:bg-black/5"
            >
              Explore planning flow
            </a>
          </div>

          <p
            className="mt-5 text-xs"
            style={{ color: "var(--color-dusty-sage)", fontSize: "var(--text-sm-2)" }}
          >
            Built for teams that need planning clarity and execution speed
          </p>
        </div>

        {/* Right — Browser-chrome framed app mockup */}
        <div className="relative flex-1 flex justify-center ws-animate-fade-up ws-animate-fade-up-delay-2 ws-slide-right">
          <div
            className="ws-float ws-card-lift w-full max-w-[380px]"
            style={{ filter: "drop-shadow(0 24px 48px rgba(37,34,30,0.14))" }}
          >
            {/* Browser chrome frame */}
            <div
              className="rounded-t-xl overflow-hidden"
              style={{
                background: "#e8e6e3",
                borderRadius: "var(--radius-images) var(--radius-images) 0 0",
              }}
            >
              <div className="flex items-center gap-1.5 px-4 py-3">
                <span className="h-3 w-3 rounded-full" style={{ background: "#ff5f57" }} />
                <span className="h-3 w-3 rounded-full" style={{ background: "#febc2e" }} />
                <span className="h-3 w-3 rounded-full" style={{ background: "#28c840" }} />
                <div
                  className="ml-3 flex-1 rounded-md px-3 py-1 text-xs text-center"
                  style={{
                    background: "rgba(37,34,30,0.08)",
                    color: "var(--color-subtle-ash)",
                    fontSize: "11px",
                  }}
                >
                  worksphere.app/dashboard
                </div>
              </div>
            </div>

            {/* App content */}
            <div
              className="rounded-b-xl overflow-hidden p-5"
              style={{
                background: "linear-gradient(135deg, #312e81 0%, #4338ca 50%, #4f46e5 100%)",
                borderRadius: "0 0 var(--radius-images) var(--radius-images)",
              }}
            >
              {/* Hero card */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p style={{ color: "#a5b4fc", fontSize: "11px", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 2 }}>
                    Welcome back
                  </p>
                  <p style={{ color: "white", fontSize: "17px", fontWeight: 700 }}>Alex Chen</p>
                </div>
                <div
                  className="ws-rank-pulse flex h-12 w-12 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ background: "rgba(255,255,255,0.12)", border: "2px solid rgba(255,255,255,0.28)" }}
                >
                  Lvl 7
                </div>
              </div>

              {/* XP bar */}
              <div className="mb-4">
                <div
                  className="flex justify-between mb-1.5"
                  style={{ color: "#a5b4fc", fontSize: "11px" }}
                >
                  <span>XP to next rank</span>
                  <span>2,340 / 3,000</span>
                </div>
                <div className="h-2 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }}>
                  <div className="ws-xp-shimmer h-2 rounded-full" style={{ width: "78%" }} />
                </div>
              </div>

              {/* Stat blocks */}
              <div className="grid grid-cols-2 gap-2.5 mb-4">
                {[{ val: "14", label: "Day streak" }, { val: "96%", label: "Completion" }].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-xl p-3 text-center"
                    style={{ background: "rgba(255,255,255,0.10)" }}
                  >
                    <p style={{ color: "white", fontSize: "20px", fontWeight: 700 }}>{s.val}</p>
                    <p style={{ color: "#a5b4fc", fontSize: "11px" }}>{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Task rows */}
              {[
                { name: "Submit weekly report", xp: 50, done: false },
                { name: "Client call prep", xp: 80, done: true },
              ].map((t) => (
                <div
                  key={t.name}
                  className="flex items-center justify-between rounded-xl px-3 py-2.5 mb-2 last:mb-0"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: "var(--radius-cards)",
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="h-4 w-4 rounded-full flex-shrink-0 flex items-center justify-center"
                      style={{
                        border: `2px solid ${t.done ? "#86efac" : "rgba(255,255,255,0.4)"}`,
                        background: t.done ? "rgba(134,239,172,0.15)" : "transparent",
                      }}
                    >
                      {t.done && (
                        <svg className="h-2 w-2" viewBox="0 0 8 8" fill="none">
                          <path d="M1 4l2 2 4-4" stroke="#86efac" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <span
                      style={{
                        color: t.done ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.9)",
                        fontSize: "13px",
                        textDecoration: t.done ? "line-through" : "none",
                      }}
                    >
                      {t.name}
                    </span>
                  </div>
                  <span
                    style={{
                      padding: "2px 7px",
                      background: "rgba(165,180,252,0.18)",
                      color: "#a5b4fc",
                      borderRadius: "var(--radius-badges)",
                      fontSize: "11px",
                      fontWeight: 600,
                    }}
                  >
                    +{t.xp} XP
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ STATS BAR ══ */}
      <div
        style={{
          background: "var(--color-light-peach)",
          borderTop: "1px solid #edddd4",
          borderBottom: "1px solid #edddd4",
        }}
      >
        <div
          className="mx-auto max-w-6xl px-6 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center"
          style={{ paddingTop: "var(--spacing-48)", paddingBottom: "var(--spacing-48)" }}
        >
          {[
            { value: "50,000+", label: "Tasks completed daily" },
            { value: "10,000+", label: "XP earned every day" },
            { value: "99%",     label: "On-time task rate" },
          ].map((s) => (
            <div key={s.label}>
              <p
                style={{
                  fontSize: "var(--text-h3)",
                  fontWeight: 700,
                  color: "var(--color-faded-charcoal)",
                  letterSpacing: "-0.005em",
                  lineHeight: "var(--leading-h3)",
                }}
              >
                {s.value}
              </p>
              <p style={{ fontSize: "var(--text-base-2)", color: "var(--color-subtle-ash)", marginTop: 4 }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ══ FEATURE 1 — Planning clarity ══ */}
      <section
        id="features"
        className="mx-auto max-w-6xl px-6 flex flex-col lg:flex-row items-start gap-16"
        style={{ paddingTop: "var(--section-gap)", paddingBottom: "var(--section-gap)" }}
      >
        {/* Text */}
        <div className="flex-1 ws-animate-fade-up">
          <span
            className="block mb-3 uppercase"
            style={{
              fontSize: "var(--text-xs)",
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "var(--color-indigo-cta)",
            }}
          >
            Planning workspace
          </span>
          {/* H2 — 38px spec */}
          <h2
            className="mb-5"
            style={{
              fontSize: "var(--text-h3)",
              fontWeight: 700,
              lineHeight: "var(--leading-h3)",
              letterSpacing: "-0.005em",
              color: "var(--color-faded-charcoal)",
            }}
          >
            Plan smarter.
            <br />
            Execute on time.
          </h2>
          <p
            className="mb-6"
            style={{
              fontSize: "var(--text-base-2)",
              lineHeight: 1.75,
              color: "var(--color-subtle-ash)",
              maxWidth: "380px",
            }}
          >
            Turn raw to-dos into an actionable plan with clear priorities, due dates, and ownership.
            Worksphere keeps your team focused and consistent from first task to final review.
          </p>
          <ul className="space-y-3">
            {[
              "Earn XP on every task completion",
              "Priority multipliers for urgent work",
              "Daily quest bonuses for streaks",
            ].map((item) => (
              <li
                key={item}
                className="flex items-center gap-2.5"
                style={{ fontSize: "var(--text-base-2)", color: "var(--color-faded-charcoal)" }}
              >
                <span
                  className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
                  style={{ background: "var(--color-light-green-tint)" }}
                >
                  <svg className="h-2.5 w-2.5" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#446c3d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Feature Card — exact Todoist spec: Paper White, 10px radius, shadow-subtle */}
        <div
          className="flex-1 ws-animate-fade-up ws-animate-fade-up-delay-2 ws-slide-right ws-card-lift"
          style={{
            background: "var(--color-paper-white)",
            borderRadius: "var(--radius-cards)",
            boxShadow: "var(--shadow-subtle)",
            border: "1px solid var(--color-soft-gray)",
            padding: "var(--spacing-24)",
          }}
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
            Today's tasks
          </p>
          {[
            { name: "Review Q2 proposals",    xp: 120, priority: "High",   done: false },
            { name: "Update project timeline", xp: 60,  priority: "Medium", done: true  },
            { name: "Team standup notes",      xp: 40,  priority: "Low",    done: true  },
            { name: "Deploy staging build",    xp: 150, priority: "Urgent", done: false },
          ].map((task) => (
            <div
              key={task.name}
              className="flex items-center justify-between py-3 border-b last:border-0"
              style={{ borderColor: "var(--color-soft-gray)" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-4 w-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
                  style={{
                    borderColor: task.done ? "#446c3d" : "var(--color-soft-gray)",
                    background: task.done ? "var(--color-light-green-tint)" : "transparent",
                  }}
                />
                <span
                  style={{
                    fontSize: "var(--text-sm-2)",
                    color: task.done ? "var(--color-dusty-sage)" : "var(--color-faded-charcoal)",
                    textDecoration: task.done ? "line-through" : "none",
                  }}
                >
                  {task.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  style={{
                    padding: "3px 7px",
                    borderRadius: "var(--radius-badges)",
                    fontSize: "11px",
                    fontWeight: 600,
                    background:
                      task.priority === "Urgent" ? "#fef2f2"
                      : task.priority === "High"   ? "#fff7ed"
                      : "var(--color-light-peach)",
                    color:
                      task.priority === "Urgent" ? "#dc2626"
                      : task.priority === "High"   ? "#ea580c"
                      : "var(--color-subtle-ash)",
                  }}
                >
                  {task.priority}
                </span>
                <span
                  style={{
                    padding: "3px 7px",
                    borderRadius: "var(--radius-badges)",
                    fontSize: "11px",
                    fontWeight: 600,
                    background: "var(--color-indigo-light)",
                    color: "var(--color-indigo-cta)",
                  }}
                >
                  +{task.xp} XP
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ FEATURE 2 — Calendar visibility ══ */}
      <section
        id="how-it-works"
        style={{ background: "var(--color-light-peach)" }}
      >
        <div
          className="mx-auto max-w-6xl px-6 flex flex-col lg:flex-row-reverse items-start gap-16"
          style={{ paddingTop: "var(--section-gap)", paddingBottom: "var(--section-gap)" }}
        >
          {/* Text */}
          <div className="flex-1 ws-animate-fade-up">
            <span
              className="block mb-3 uppercase"
              style={{ fontSize: "var(--text-xs)", fontWeight: 700, letterSpacing: "0.08em", color: "var(--color-indigo-cta)" }}
            >
              Shared calendar
            </span>
            <h2
              className="mb-5"
              style={{
                fontSize: "var(--text-h3)",
                fontWeight: 700,
                lineHeight: "var(--leading-h3)",
                letterSpacing: "-0.005em",
                color: "var(--color-faded-charcoal)",
              }}
            >
              See workload.
              <br />
              Balance calendars.
            </h2>
            <p
              className="mb-7"
              style={{
                fontSize: "var(--text-base-2)",
                lineHeight: 1.75,
                color: "var(--color-subtle-ash)",
                maxWidth: "360px",
              }}
            >
              Align every team member on one calendar timeline. Spot bottlenecks early, rebalance
              task load, and keep deadlines realistic before execution pressure starts.
            </p>
            {/* Hero Pill Button */}
            <Link
              href="/signup"
              className="inline-block transition-all hover:-translate-y-0.5"
              style={{
                padding: "12px 27px",
                background: "rgba(37, 34, 30, 0.83)",
                color: "var(--color-paper-white)",
                border: "1px solid var(--color-paper-white)",
                borderRadius: "var(--radius-buttons)",
                fontSize: "var(--text-base-2)",
                fontWeight: 600,
                boxShadow: "var(--shadow-lg)",
              }}
            >
              Open calendar view
            </Link>
          </div>

          {/* Rank ladder — Feature Card */}
          <div
            className="flex-1 ws-animate-fade-up ws-animate-fade-up-delay-2 ws-slide-right ws-card-lift"
            style={{
              background: "var(--color-paper-white)",
              borderRadius: "var(--radius-cards)",
              boxShadow: "var(--shadow-subtle)",
              border: "1px solid rgba(37,34,30,0.06)",
              padding: "var(--spacing-20)",
            }}
          >
            <div className="space-y-2">
              {[
                { rank: "Legend",   xp: "10,000+", color: "#b45309", bg: "#fef9ee", active: false },
                { rank: "Platinum", xp: "7,500+",  color: "#6366f1", bg: "#eef2ff", active: false },
                { rank: "Gold",     xp: "5,000+",  color: "#d97706", bg: "#fef3c7", active: true  },
                { rank: "Silver",   xp: "2,500+",  color: "#6b7280", bg: "#f9fafb", active: false },
                { rank: "Bronze",   xp: "1,000+",  color: "#92400e", bg: "#fff7ed", active: false },
                { rank: "Rookie",   xp: "0+",      color: "#9ca3af", bg: "#f3f4f6", active: false },
              ].map((r) => (
                <div
                  key={r.rank}
                  className="flex items-center justify-between rounded-xl px-4 py-3 transition-transform"
                  style={{
                    background: r.active ? r.bg : "transparent",
                    border: `1px solid ${r.active ? r.color + "30" : "transparent"}`,
                    transform: r.active ? "scale(1.02)" : "scale(1)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
                      style={{ background: r.bg, color: r.color, border: `2px solid ${r.color}30` }}
                    >
                      {r.rank[0]}
                    </span>
                    <span
                      style={{
                        fontSize: "var(--text-sm-2)",
                        fontWeight: r.active ? 700 : 500,
                        color: r.active ? r.color : "var(--color-faded-charcoal)",
                      }}
                    >
                      {r.rank}
                    </span>
                    {r.active && (
                      <span
                        style={{
                          padding: "2px 6px",
                          fontSize: "11px",
                          fontWeight: 700,
                          background: r.color + "18",
                          color: r.color,
                          borderRadius: "4px",
                        }}
                      >
                        You are here
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--color-subtle-ash)" }}>
                    {r.xp} XP
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ FEATURE 3 — Manager approvals ══ */}
      <section
        id="for-managers"
        className="mx-auto max-w-6xl px-6 flex flex-col lg:flex-row items-start gap-16"
        style={{ paddingTop: "var(--section-gap)", paddingBottom: "var(--section-gap)" }}
      >
        {/* Text */}
        <div className="flex-1 ws-animate-fade-up">
          <span
            className="block mb-3 uppercase"
            style={{ fontSize: "var(--text-xs)", fontWeight: 700, letterSpacing: "0.08em", color: "var(--color-indigo-cta)" }}
          >
            For managers
          </span>
          <h2
            className="mb-5"
            style={{
              fontSize: "var(--text-h3)",
              fontWeight: 700,
              lineHeight: "var(--leading-h3)",
              letterSpacing: "-0.005em",
              color: "var(--color-faded-charcoal)",
            }}
          >
            Approve tasks.
            <br />
            Award XP instantly.
          </h2>
          <p
            className="mb-6"
            style={{
              fontSize: "var(--text-base-2)",
              lineHeight: 1.75,
              color: "var(--color-subtle-ash)",
              maxWidth: "360px",
            }}
          >
            Managers get a clean panel to review submissions, verify attendance, track mistakes,
            and assign bonus XP — all in one place. Recognition happens in real time.
          </p>
          <ul className="space-y-3">
            {[
              "One-click task verification",
              "Attendance and leave management",
              "Real-time team performance reports",
            ].map((item) => (
              <li
                key={item}
                className="flex items-center gap-2.5"
                style={{ fontSize: "var(--text-base-2)", color: "var(--color-faded-charcoal)" }}
              >
                <span
                  className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
                  style={{ background: "var(--color-indigo-light)" }}
                >
                  <svg className="h-2.5 w-2.5" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#4f46e5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Feature Card — manager panel mockup */}
        <div
          className="flex-1 ws-animate-fade-up ws-animate-fade-up-delay-2 ws-slide-right ws-card-lift overflow-hidden"
          style={{
            borderRadius: "var(--radius-cards)",
            boxShadow: "var(--shadow-subtle)",
            border: "1px solid var(--color-soft-gray)",
          }}
        >
          {/* Dark header bar */}
          <div
            className="flex items-center gap-2 px-5 py-3 border-b"
            style={{ background: "#1e1b4b", borderColor: "#312e81" }}
          >
            <span style={{ color: "white", fontSize: "var(--text-sm-2)", fontWeight: 600 }}>
              Task Verifications
            </span>
            <span
              style={{
                padding: "1px 7px",
                borderRadius: "12px",
                background: "#ef4444",
                color: "white",
                fontSize: "11px",
                fontWeight: 700,
              }}
            >
              3
            </span>
          </div>

          {[
            { name: "Priya Sharma",   task: "Monthly sales report",   xp: 100 },
            { name: "James O'Brien",  task: "Client onboarding deck",  xp: 80  },
            { name: "Mei Lin",        task: "QA testing sprint 12",    xp: 120 },
          ].map((row) => (
            <div
              key={row.name}
              className="flex items-center justify-between px-5 py-4 border-b last:border-0"
              style={{
                background: "var(--color-paper-white)",
                borderColor: "var(--color-soft-gray)",
              }}
            >
              <div>
                <p style={{ fontSize: "var(--text-sm-2)", fontWeight: 600, color: "var(--color-faded-charcoal)" }}>
                  {row.name}
                </p>
                <p style={{ fontSize: "var(--text-xs)", marginTop: 2, color: "var(--color-subtle-ash)" }}>
                  {row.task}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Text Only Button */}
                <button
                  className="transition-colors hover:bg-black/5"
                  style={{
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--color-faded-charcoal)",
                    border: "1px solid var(--color-soft-gray)",
                    borderRadius: "var(--radius-default)",
                    background: "transparent",
                  }}
                >
                  Review
                </button>
                {/* Subtle Action Button */}
                <button
                  style={{
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "white",
                    borderRadius: "var(--radius-default)",
                    background: "var(--color-indigo-cta)",
                  }}
                >
                  Approve +{row.xp} XP
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ TESTIMONIALS ══ */}
      <section
        style={{ background: "var(--color-light-peach)", borderTop: "1px solid #edddd4" }}
      >
        <div
          className="mx-auto max-w-6xl px-6"
          style={{ paddingTop: "var(--section-gap)", paddingBottom: "var(--section-gap)" }}
        >
          <div className="text-center mb-14 ws-animate-fade-up">
            <h2
              style={{
                fontSize: "var(--text-h2)",
                fontWeight: 600,
                letterSpacing: "-0.005em",
                lineHeight: "var(--leading-h2)",
                color: "var(--color-faded-charcoal)",
              }}
            >
              Teams love it
            </h2>
            <p
              className="mt-3 max-w-md mx-auto"
              style={{ fontSize: "var(--text-base-2)", color: "var(--color-subtle-ash)", lineHeight: 1.75 }}
            >
              From startups to enterprise — Worksphere transforms how teams feel about work.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                quote: "Our team's task completion rate jumped from 71% to 96% in the first month. The XP system makes people genuinely excited to finish their work.",
                name: "Ananya Mehta",
                role: "Operations Lead, Fintech startup",
              },
              {
                quote: "Approvals used to sit in a queue for days. Now managers are competing to approve fastest. It's changed the whole culture.",
                name: "David Okafor",
                role: "Engineering Manager, SaaS company",
              },
              {
                quote: "I didn't expect a productivity tool to actually motivate my team. The streak system alone has cut our missed deadlines by half.",
                name: "Sarah Kim",
                role: "HR Director, E-commerce brand",
              },
            ].map((t) => (
              <div
                key={t.name}
                className="ws-card-lift"
                style={{
                  background: "var(--color-paper-white)",
                  borderRadius: "var(--radius-cards)",
                  boxShadow: "var(--shadow-subtle)",
                  border: "1px solid rgba(37,34,30,0.07)",
                  padding: "var(--spacing-24)",
                }}
              >
                {/* Caecilia substitute — Georgia serif, 20px, 1.8 line-height (exact spec) */}
                <p
                  className="mb-5"
                  style={{
                    fontFamily: "Georgia, 'Times New Roman', serif",
                    fontSize: "20px",
                    lineHeight: "1.8",
                    letterSpacing: "normal",
                    color: "var(--color-faded-charcoal)",
                    fontStyle: "italic",
                  }}
                >
                  "{t.quote}"
                </p>
                <p style={{ fontSize: "var(--text-sm-2)", fontWeight: 600, color: "var(--color-faded-charcoal)" }}>
                  {t.name}
                </p>
                <p style={{ fontSize: "var(--text-xs)", marginTop: 2, color: "var(--color-subtle-ash)" }}>
                  {t.role}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FINAL CTA ══ */}
      <section
        className="mx-auto max-w-6xl px-6 text-center ws-animate-fade-up"
        style={{ paddingTop: "var(--section-gap)", paddingBottom: "var(--section-gap)" }}
      >
        <h2
          className="mb-5"
          style={{
            fontSize: "var(--text-h2)",
            fontWeight: 600,
            letterSpacing: "-0.005em",
            lineHeight: "var(--leading-h2)",
            color: "var(--color-faded-charcoal)",
          }}
        >
          Ready to level up
          <br />
          your team?
        </h2>
        <p
          className="mb-8 max-w-sm mx-auto"
          style={{ fontSize: "var(--text-xl-2)", lineHeight: 1.6, color: "var(--color-subtle-ash)" }}
        >
          Join hundreds of teams already earning XP, climbing ranks, and hitting goals — together.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {/* Hero Pill Button */}
          <Link
            href="/signup"
            className="inline-block transition-all hover:-translate-y-0.5"
            style={{
              padding: "12px 27px",
              background: "rgba(37, 34, 30, 0.83)",
              color: "var(--color-paper-white)",
              border: "1px solid var(--color-paper-white)",
              borderRadius: "var(--radius-buttons)",
              fontSize: "var(--text-base-2)",
              fontWeight: 600,
              boxShadow: "var(--shadow-lg)",
            }}
          >
            Start for free
          </Link>
          {/* Text Only Button */}
          <Link
            href="/login"
            className="inline-block transition-colors hover:bg-black/5"
            style={{
              padding: "9px 14px",
              background: "transparent",
              color: "var(--color-faded-charcoal)",
              border: "1px solid var(--color-faded-charcoal)",
              borderRadius: "var(--radius-default)",
              fontSize: "var(--text-base-2)",
              fontWeight: 400,
            }}
          >
            Sign in
          </Link>
        </div>
        <p
          className="mt-5"
          style={{ fontSize: "var(--text-sm-2)", color: "var(--color-dusty-sage)" }}
        >
          No credit card required · Cancel anytime
        </p>
      </section>

      {/* ══ FOOTER ══ */}
      <footer
        style={{
          background: "var(--color-light-peach)",
          borderTop: "1px solid #edddd4",
        }}
      >
        <div
          className="mx-auto max-w-6xl px-6"
          style={{ paddingTop: "var(--spacing-64)", paddingBottom: "var(--spacing-48)" }}
        >
          <div className="flex flex-col md:flex-row items-start justify-between gap-10">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
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
                    color: "var(--color-faded-charcoal)",
                  }}
                >
                  Worksphere
                </span>
              </div>
              <p
                className="max-w-xs"
                style={{ fontSize: "var(--text-sm-2)", color: "var(--color-subtle-ash)", lineHeight: 1.6 }}
              >
                Gamified employee task management that makes teams want to perform.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
              {[
                { heading: "Product", links: ["Features", "How it works", "For Managers", "Pricing"] },
                { heading: "Company", links: ["About", "Blog", "Careers", "Contact"] },
                { heading: "Legal",   links: ["Privacy", "Terms", "Security"] },
              ].map((col) => (
                <div key={col.heading}>
                  <p
                    className="mb-3"
                    style={{ fontSize: "var(--text-sm-2)", fontWeight: 600, color: "var(--color-faded-charcoal)" }}
                  >
                    {col.heading}
                  </p>
                  <ul className="space-y-2">
                    {col.links.map((link) => (
                      <li key={link}>
                        <a
                          href="#"
                          className="transition-colors hover:underline"
                          style={{ fontSize: "var(--text-sm-2)", color: "var(--color-subtle-ash)" }}
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
            className="mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2"
            style={{
              borderTop: "1px solid #edddd4",
              fontSize: "var(--text-xs)",
              color: "var(--color-dusty-sage)",
            }}
          >
            <p>© 2026 Worksphere. All rights reserved.</p>
            <p>Made for teams that want to win.</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
