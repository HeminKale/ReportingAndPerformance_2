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
      <header className="sticky top-0 z-50 border-b bg-[rgba(254,253,252,0.94)] backdrop-blur-md" style={{ borderColor: "var(--color-soft-gray)" }}>
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="h-8 w-8 rounded-lg grid place-items-center text-white font-bold" style={{ background: "var(--color-indigo-cta)" }}>W</span>
            <span className="text-[17px] font-semibold" style={{ color: "var(--color-faded-charcoal)" }}>Worksphere</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/login" className="px-3.5 py-2 border rounded-lg text-sm" style={{ borderColor: "var(--color-faded-charcoal)", color: "var(--color-faded-charcoal)" }}>Log in</Link>
            <Link href="/signup" className="px-4 py-2.5 rounded-[15px] text-white text-sm font-semibold" style={{ background: "var(--color-indigo-cta)", boxShadow: "var(--shadow-lg)" }}>Start for free</Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-20 grid lg:grid-cols-2 gap-12 items-center">
        <div className="ws-slide-left">
          <h1 className="mb-5" style={{ fontSize: "var(--text-display)", lineHeight: "var(--leading-display)", color: "var(--color-faded-charcoal)" }}>
            Clarity, finally.
          </h1>
          <p className="mb-8 max-w-md" style={{ fontSize: "var(--text-xl-2)", color: "var(--color-subtle-ash)" }}>
            Simplify your planning, stay organized, and execute with confidence. Worksphere brings tasks, calendar, and team flow into one clean view.
          </p>
          <div className="flex gap-3">
            <Link href="/signup" className="px-6 py-3 rounded-[15px] text-white font-semibold" style={{ background: "rgba(37,34,30,0.83)", boxShadow: "var(--shadow-lg)" }}>Start for free</Link>
            <Link href="/login" className="px-6 py-3 rounded-lg border" style={{ borderColor: "var(--color-faded-charcoal)", color: "var(--color-faded-charcoal)" }}>Upgrade to Pro</Link>
          </div>
        </div>

        <div className="ws-slide-right">
          <div className="ws-card-lift rounded-[15px] border p-4 mb-4" style={{ borderColor: "var(--color-soft-gray)", boxShadow: "var(--shadow-subtle)", background: "var(--color-paper-white)" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold" style={{ color: "var(--color-faded-charcoal)" }}>Calendar View</span>
              <span className="text-xs px-2 py-1 rounded" style={{ background: "var(--color-light-green-tint)", color: "var(--color-badge-green)" }}>Simplify your planning</span>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: 28 }).map((_, i) => (
                <div key={i} className="h-8 rounded grid place-items-center text-xs" style={{ background: [5, 9, 16, 18, 24].includes(i) ? "var(--color-indigo-cta)" : "rgba(37,34,30,0.05)", color: [5, 9, 16, 18, 24].includes(i) ? "white" : "var(--color-subtle-ash)" }}>{i + 1}</div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <div className="ws-card-lift w-[220px] rounded-[26px] border p-3" style={{ borderColor: "rgba(37,34,30,0.1)", background: "var(--color-paper-white)", boxShadow: "var(--shadow-lg)" }}>
              <div className="h-5 w-20 rounded-full mx-auto mb-3" style={{ background: "rgba(37,34,30,0.08)" }} />
              <div className="rounded-2xl p-3 mb-2 text-white" style={{ background: "linear-gradient(135deg,#4338ca 0%,#4f46e5 100%)" }}>
                <p className="text-[11px] opacity-80">Stay organized and focused</p>
                <p className="text-[13px] font-bold">Today</p>
              </div>
              {["Inbox clean-up", "Sprint planning", "Client follow-up"].map((item) => (
                <div key={item} className="py-2 border-b text-xs" style={{ borderColor: "rgba(37,34,30,0.08)", color: "var(--color-faded-charcoal)" }}>{item}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y" style={{ borderColor: "var(--color-soft-gray)", background: "var(--color-light-peach)" }}>
        <div className="mx-auto max-w-6xl px-6 py-10 grid md:grid-cols-4 gap-6 text-center">
          {[
            ["50M+", "users"],
            ["374K+", "5-star reviews"],
            ["2B+", "tasks completed"],
            ["160+", "countries"],
          ].map(([v, l]) => (
            <div key={v}>
              <p className="text-3xl font-bold" style={{ color: "var(--color-faded-charcoal)" }}>{v}</p>
              <p className="text-sm" style={{ color: "var(--color-subtle-ash)" }}>{l}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 grid md:grid-cols-2 gap-10">
        {[
          ["Clear your mind", "Capture tasks at the speed of thought."],
          ["Stay organized and focused", "See only what you need, when you need it."],
          ["Simplify your planning", "Visualize your week in calendar view and schedule confidently."],
          ["A home for your team’s tasks", "Collaborate in one shared space without chaos."],
        ].map(([t, d]) => (
          <div key={t} className="ws-card-lift rounded-[10px] border p-6" style={{ borderColor: "var(--color-soft-gray)", boxShadow: "var(--shadow-subtle)", background: "var(--color-paper-white)" }}>
            <h3 className="text-[22px] font-semibold mb-2" style={{ color: "var(--color-faded-charcoal)" }}>{t}</h3>
            <p className="text-[16px]" style={{ color: "var(--color-subtle-ash)" }}>{d}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="rounded-[15px] p-10 text-center" style={{ background: "var(--color-light-peach)", border: "1px solid var(--color-soft-gray)" }}>
          <h2 className="text-[44px] font-semibold mb-4" style={{ color: "var(--color-faded-charcoal)" }}>Gain calmness and clarity</h2>
          <p className="text-[20px] mb-6" style={{ color: "var(--color-subtle-ash)" }}>Join teams who organize work and life with Worksphere.</p>
          <div className="flex justify-center gap-3">
            <Link href="/signup" className="px-6 py-3 rounded-[15px] text-white font-semibold" style={{ background: "rgba(37,34,30,0.83)", boxShadow: "var(--shadow-lg)" }}>Start for free</Link>
            <Link href="/login" className="px-6 py-3 rounded-lg border" style={{ borderColor: "var(--color-faded-charcoal)", color: "var(--color-faded-charcoal)" }}>Log in</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
