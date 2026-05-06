import { createClient } from '@/lib/supabase/server';
import { format, parseISO } from 'date-fns';
import { Zap } from 'lucide-react';
import type { XpLedgerRow } from '@/lib/types/database';

export default async function XpHistoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: gamification } = await supabase
    .from('user_gamification')
    .select('total_xp')
    .eq('user_id', user.id)
    .maybeSingle();

  const { data: ledger } = await supabase
    .from('xp_ledger')
    .select('id, delta, reason, source_type, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200);

  const totalXp = gamification?.total_xp ?? 0;
  const rows: Pick<XpLedgerRow, 'id' | 'delta' | 'reason' | 'source_type' | 'created_at'>[] = ledger || [];

  // Group by calendar date
  const grouped = rows.reduce<Record<string, typeof rows>>((acc, row) => {
    const day = format(parseISO(row.created_at), 'yyyy-MM-dd');
    if (!acc[day]) acc[day] = [];
    acc[day]!.push(row);
    return acc;
  }, {});

  const sortedDays = Object.keys(grouped).sort((a, b) => (a < b ? 1 : -1));

  function sourceLabel(src: string) {
    return src
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black" style={{ color: '#000435' }}>XP History</h1>
          <p className="text-sm text-slate-500 mt-1">Your experience points timeline</p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-100 px-5 py-3 shadow-sm">
          <Zap className="h-5 w-5 text-violet-500 fill-violet-500" />
          <span className="text-xl font-extrabold" style={{ color: '#000435' }}>{totalXp.toLocaleString()} XP</span>
          <span className="text-xs font-semibold text-violet-400">total</span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center">
          <Zap className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">No XP earned yet. Complete tasks to start earning!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {sortedDays.map(day => {
            const dayRows = grouped[day]!;
            const dayTotal = dayRows.reduce((s, r) => s + r.delta, 0);
            return (
              <div key={day}>
                {/* Date header */}
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#000435' }}>
                    {format(parseISO(day), 'EEEE, MMMM d, yyyy')}
                  </h2>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      dayTotal >= 0
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        : 'bg-rose-50 text-rose-700 border border-rose-100'
                    }`}
                  >
                    {dayTotal >= 0 ? '+' : ''}{dayTotal} XP
                  </span>
                </div>

                {/* Rows for this day */}
                <div className="flex flex-col gap-2">
                  {dayRows.map(row => (
                    <div
                      key={row.id}
                      className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white px-5 py-4 shadow-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-800 truncate">{row.reason}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            {sourceLabel(row.source_type)}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {format(parseISO(row.created_at), 'h:mm a')}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-sm font-extrabold ${
                          row.delta >= 0
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : 'bg-rose-50 text-rose-700 border border-rose-100'
                        }`}
                      >
                        {row.delta >= 0 ? '+' : ''}{row.delta} XP
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
