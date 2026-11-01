// Privacy work (2026-11-01, committee D14): the append-only display log. Once a day the tick writes one row per public
// record with what its profile displayed (headline, 95% range, closed-trade count, open-position summary, evidence
// line), so the app can show what it displayed on a past date. Percent only: no quantities, prices or amounts. Rows are
// never updated or removed (a database trigger refuses both) except with the account (the users cascade).
// The text comes from the same functions the profile uses (lib/trades.ts, lib/copy.ts, lib/positions.ts).
// A day's row is the record at the moment it was written (`asOf`, its created_at): the first tick that reached it that
// UTC day, which may be later than midnight. Wherever a past display is shown, it says "as of <asOf> (UTC)", never "all
// day"; a later change the same day appears in the next day's row (code review 9, orchestrator review 3).
import { sql } from './db.ts';
import { evidenceLine, pct, stats } from './trades.ts';
import { cardEvidence, evidenceRangeText } from './record-card.ts';
import { winRateText } from './copy.ts';
import { counted } from './format.ts';
import { positionRows } from './positions.ts';
import { publicRecordDetail } from './connections.ts';
// OPTIONS (docs/features/logs/options/plan.md L9, AC 21): the options line or the gated count line, exactly as the one
// reader returned it; this file reads no option table.
import { loadOptionDisplayText } from './options-load.ts';

export const DISPLAY_LOG_BOX_MS = 20_000;
export const DISPLAY_LOG_BATCH = 200;

type Close = { symbol: string; openedAt: Date; closedAt: Date; returnPct: number; holdingDays: number };
type Position = { accountId: string; symbol: string; pct: number };
export type Snapshot = { headline: string; rangeText: string | null; tradeCount: number; openSummary: string; evidence: string };

export function snapshotText(closes: Close[], positions: Position[], today: Date): Snapshot {
  const s = stats(closes);
  // F-4 rework: the profile displays the share card's evidence (lib/record-card.ts#cardEvidence: the range around the
  // average it prints, its tier and verdict), so the log records that same text.
  const c = cardEvidence(closes, today);
  const rows = positionRows(positions);
  return {
    headline: closes.length ? `${winRateText(s.winRate)} · ${pct(s.avgReturn)} avg return / trade` : 'No closed trades yet',
    rangeText: closes.length ? evidenceRangeText(c) : null,
    tradeCount: closes.length,
    openSummary: rows.length
      ? `${counted(rows.length, 'open position')}: ${rows.map((r) => `${r.symbol}${r.account ? ` (account ${r.account})` : ''} ${pct(r.pct)}`).join(', ')}`
      : 'No open positions',
    evidence: closes.length ? evidenceLine(c) : 'No closed trades yet',
  };
}

const utcDay = (d: Date) => d.toISOString().slice(0, 10);

/** One record's row for `day`, or null when nothing public shows (deleted, importing, or an empty record). */
async function snapshotFor(userId: number, now: Date): Promise<(Snapshot & { demo: boolean; optionsLine: string | null }) | null> {
  const { public: { state } } = await publicRecordDetail(userId);
  if (state === 'importing') return null; // TR-3: nothing partial is presented as a record, so nothing is logged as one
  const trades = await sql`select symbol, opened_at, closed_at, return_pct, holding_days from closed_trades where user_id = ${userId}`;
  const positions = state !== 'none' ? await sql`select account_id, symbol, unrealized_pct from open_positions where user_id = ${userId}` : [];
  if (!trades.length && !positions.length) return null;
  const [d] = await sql`select exists(select 1 from activities where user_id = ${userId} and source = 'demo') as demo`;
  return {
    demo: d.demo as boolean,
    optionsLine: await loadOptionDisplayText(userId), // OPTIONS
    ...snapshotText(
      trades.map((t) => ({ symbol: t.symbol, openedAt: t.opened_at, closedAt: t.closed_at, returnPct: t.return_pct, holdingDays: t.holding_days })),
      positions.map((p) => ({ accountId: p.account_id as string, symbol: p.symbol as string, pct: p.unrealized_pct as number })),
      now,
    ),
  };
}

export type DisplayLogReport = { written: number; done: boolean };

/** Writes today's row for every public record that has none yet. Time-boxed; a call cut by its box resumes on the next. */
export async function writeDisplayLog(opts: { now?: Date; boxMs?: number; batch?: number; clock?: () => number; ids?: number[] } = {}): Promise<DisplayLogReport> {
  const now = opts.now ?? new Date();
  const day = utcDay(now);
  const clock = opts.clock ?? Date.now;
  const end = clock() + Math.min(opts.boxMs ?? DISPLAY_LOG_BOX_MS, DISPLAY_LOG_BOX_MS);
  const batch = opts.batch ?? DISPLAY_LOG_BATCH;
  let after = 0, written = 0;
  for (;;) {
    const users = await sql`select u.id from users u where u.deleted_at is null and u.id > ${after}
      ${opts.ids ? sql`and u.id in ${sql(opts.ids.length ? opts.ids : [0])}` : sql``}
      and not exists (select 1 from display_log l where l.user_id = u.id and l.day = ${day}::date)
      -- An empty record writes no row; filtering it here keeps it from using the box every tick (business lead re-sit 1).
      and (exists (select 1 from closed_trades c where c.user_id = u.id) or exists (select 1 from open_positions p where p.user_id = u.id))
      order by u.id limit ${batch}`;
    for (const u of users) {
      if (clock() >= end) return { written, done: false };
      after = u.id as number;
      const snap = await snapshotFor(after, now);
      if (!snap) continue;
      const r = await sql`insert into display_log (user_id, day, demo, headline, range_text, trade_count, open_summary, evidence, options_line)
        values (${after}, ${day}::date, ${snap.demo}, ${snap.headline}, ${snap.rangeText}, ${snap.tradeCount}, ${snap.openSummary}, ${snap.evidence}, ${snap.optionsLine})
        on conflict (user_id, day) do nothing`;
      written += r.count;
    }
    if (users.length < batch) return { written, done: true };
  }
}

export type DisplayedRow = { asked: string; day: string; gap: boolean; asOf: string; demo: boolean; headline: string; rangeText: string | null; tradeCount: number; openSummary: string; evidence: string };

/** What this record displayed on `day`: the latest snapshot on or before it, or null when none exists. `day` is the
 *  snapshot's own date; `gap` is true when it is older than the date asked for, so a missing day is never presented as
 *  that day's display. */
export async function displayedOn(userId: number, day: string): Promise<DisplayedRow | null> {
  const [r] = await sql`select to_char(day, 'YYYY-MM-DD') as day, to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as as_of, demo, headline, range_text, trade_count, open_summary, evidence
    from display_log where user_id = ${userId} and day <= ${day}::date order by day desc limit 1`;
  return r ? { asked: day, day: r.day, gap: r.day !== day, asOf: r.as_of, demo: r.demo, headline: r.headline, rangeText: r.range_text, tradeCount: r.trade_count, openSummary: r.open_summary, evidence: r.evidence } : null;
}
