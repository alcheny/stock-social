// Privacy work (2026-11-01, committee D14): the append-only display log. Once a day the tick writes one row per public
// record with what its profile displayed (headline, 95% range, closed-trade count, open-position summary, evidence
// line), so the app can show what it displayed on a past date. Percent only: no quantities, prices or amounts. Rows are
// never updated or removed (a database trigger refuses both) except with the account (the users cascade).
// The text comes from the same functions the profile uses (lib/trades.ts, lib/copy.ts, lib/positions.ts).
// A day's row is the record at the moment it was written (`asOf`, its created_at): the first tick that reached it that
// UTC day, which may be later than midnight. Wherever a past display is shown, it says "as of <asOf> (UTC)", never "all
// day"; a later change the same day appears in the next day's row (code review 9, orchestrator review 3).
import { sql } from './db.ts';
import { logSafe } from './privacy-log.ts';
import { evidenceLine, pct, stats } from './trades.ts';
import { cardEvidence, evidenceRangeText } from './record-card.ts';
import { winRateText } from './copy.ts';
import { counted } from './format.ts';
import { positionRows } from './positions.ts';
import { recordStates } from './connections.ts';
import { visibleUser, visibleUserIds } from './visible-users.ts';
// OPTIONS (docs/features/logs/options/plan.md L9, AC 21): the options line or the gated count line, exactly as the one
// reader returned it; this file reads no option table. Known-limits sweep 2: the reader's batch form (optionHeadline:
// counts in one query, the gate still worked out per trader) with the same text function loadOptionDisplayText uses.
import { optionDisplayText, optionHeadline } from './options-load.ts';

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

type Logged = Snapshot & { demo: boolean; optionsLine: string | null };
type Candidate = { id: number; n: number };

// Known-limits sweep 2: the rows a chunk may read at once (closed trades summed over its traders). A record larger
// than this is a chunk by itself.
export const DISPLAY_LOG_ROW_CAP = 50_000;

/** Splits candidates (in id order) into chunks of at most `cap` closed-trade rows; an oversized record goes alone. */
export function chunkByRows(users: Candidate[], cap = DISPLAY_LOG_ROW_CAP): number[][] {
  const out: number[][] = [];
  let cur: number[] = [], rows = 0;
  for (const u of users) {
    if (cur.length && rows + u.n > cap) { out.push(cur); cur = []; rows = 0; }
    cur.push(u.id); rows += u.n;
  }
  if (cur.length) out.push(cur);
  return out;
}

/** Each record's row for `now`'s day, set-based: seven queries for the whole set (three of them recordStates, one the option counts; the option gate adds
 *  queries only for traders who hold option rows). A record
 *  with nothing public to show (deleted, hidden (F-16), importing, or an empty record) has no entry. */
export async function snapshotsFor(userIds: number[], now: Date): Promise<Map<number, Logged>> {
  const out = new Map<number, Logged>();
  if (!userIds.length) return out;
  const states = await recordStates(userIds);
  // TR-3: nothing partial is presented as a record, so nothing is logged as one.
  const readable = userIds.filter((id) => states.get(id)!.state !== 'importing');
  if (!readable.length) return out;
  const shown = readable.filter((id) => states.get(id)!.state !== 'none');
  // The profile's own order (app/u/[handle]/page.tsx: closed_at desc, id desc). stats() and confidence() sum floats
  // in input order, so an unordered read could print a different last digit for the same record (see the tests).
  const trades = await sql`select user_id, symbol, opened_at, closed_at, return_pct, holding_days from closed_trades
    where user_id = any(${readable}) and user_id in (${visibleUserIds()}) order by user_id, closed_at desc, id desc`; // F-16: a hidden profile displays nothing
  const positions = shown.length ? await sql`select user_id, account_id, symbol, unrealized_pct from open_positions where user_id = any(${shown}) and user_id in (${visibleUserIds()})` : [];
  const demo = new Set((await sql`select distinct user_id from activities where user_id = any(${readable}) and source = 'demo'`).map((r) => Number(r.user_id)));
  const closes = new Map<number, Close[]>(), open = new Map<number, Position[]>();
  for (const t of trades) {
    const id = Number(t.user_id), list = closes.get(id) ?? (closes.set(id, []), closes.get(id)!);
    list.push({ symbol: t.symbol, openedAt: t.opened_at, closedAt: t.closed_at, returnPct: t.return_pct, holdingDays: t.holding_days });
  }
  for (const p of positions) {
    const id = Number(p.user_id), list = open.get(id) ?? (open.set(id, []), open.get(id)!);
    list.push({ accountId: p.account_id as string, symbol: p.symbol as string, pct: p.unrealized_pct as number });
  }
  const logged = readable.filter((id) => (closes.get(id)?.length ?? 0) + (open.get(id)?.length ?? 0) > 0);
  if (!logged.length) return out;
  const options = await optionHeadline(logged); // OPTIONS (AC 21): what loadOptionDisplayText returns, per trader
  for (const id of logged) {
    out.set(id, { demo: demo.has(id), optionsLine: optionDisplayText(options.get(id)!), ...snapshotText(closes.get(id) ?? [], open.get(id) ?? [], now) });
  }
  return out;
}

/** One record's row for `now`'s day, or null when nothing public shows (deleted, importing, or an empty record). */
export async function snapshotFor(userId: number, now: Date): Promise<Logged | null> {
  return (await snapshotsFor([userId], now)).get(userId) ?? null;
}

async function insertRows(day: string, snaps: Map<number, Logged>): Promise<number> {
  if (!snaps.size) return 0;
  const rows = [...snaps].map(([userId, s]) => ({ user_id: userId, day, demo: s.demo, headline: s.headline, range_text: s.rangeText, trade_count: s.tradeCount, open_summary: s.openSummary, evidence: s.evidence, options_line: s.optionsLine }));
  const r = await sql`insert into display_log ${sql(rows, 'user_id', 'day', 'demo', 'headline', 'range_text', 'trade_count', 'open_summary', 'evidence', 'options_line')}
    on conflict (user_id, day) do nothing`;
  return r.count;
}

export type DisplayLogReport = { written: number; done: boolean; failed?: number };
type Deps = { snapshots: typeof snapshotsFor };

/** Writes today's row for every public record that has none yet. Time-boxed; a call cut by its box resumes on the next. */
export async function writeDisplayLog(opts: { now?: Date; boxMs?: number; batch?: number; rowCap?: number; clock?: () => number; ids?: number[]; deps?: Deps } = {}): Promise<DisplayLogReport> {
  const now = opts.now ?? new Date();
  const day = utcDay(now);
  const clock = opts.clock ?? Date.now;
  const end = clock() + Math.min(opts.boxMs ?? DISPLAY_LOG_BOX_MS, DISPLAY_LOG_BOX_MS);
  const batch = opts.batch ?? DISPLAY_LOG_BATCH;
  const snapshots = opts.deps?.snapshots ?? snapshotsFor;
  let after = 0, written = 0, failed = 0;
  const report = (done: boolean): DisplayLogReport => ({ written, done, ...(failed ? { failed } : {}) });
  // Known-limits sweep 2: a chunk of records per round of seven reads and one multi-row insert, instead of ~6 queries
  // per record (LOAD: lib/display-log.load.test.ts).
  // ponytail: one 20 s box writes ~9,000-21,000 records (467-1,048 records/s measured, 2,000 traders averaging 126
  // closes, 2026-11-01; the per-trader writer did 116-323), so at 24 hourly ticks past ~220,000-500,000 public records
  // some get no row that day (fewer when the sync leaves less than the full box) — run it as its own job that reports
  // its backlog.
  for (;;) {
    const users = await sql`select u.id, (select count(*) from closed_trades c where c.user_id = u.id)::int as n
      from users u where ${visibleUser('u')} and u.id > ${after}
      ${opts.ids ? sql`and u.id in ${sql(opts.ids.length ? opts.ids : [0])}` : sql``}
      and not exists (select 1 from display_log l where l.user_id = u.id and l.day = ${day}::date)
      -- An empty record writes no row; filtering it here keeps it from using the box every tick (business lead re-sit 1).
      and (exists (select 1 from closed_trades c where c.user_id = u.id) or exists (select 1 from open_positions p where p.user_id = u.id))
      order by u.id limit ${batch}`;
    for (const ids of chunkByRows(users.map((u) => ({ id: u.id as number, n: u.n as number })), opts.rowCap)) {
      if (clock() >= end) return report(false);
      try {
        written += await insertRows(day, await snapshots(ids, now));
      } catch (e) {
        // Reliability review: one record that throws (or one row the insert refuses) must not block the rest of its
        // chunk on every tick: the chunk is retried one record at a time. The log line carries counts only.
        console.error('display log chunk failed; retrying one record at a time', JSON.stringify({ records: ids.length }), logSafe(e));
        for (const id of ids) {
          if (clock() >= end) return report(false);
          try { written += await insertRows(day, await snapshots([id], now)); } catch { failed++; }
        }
        if (failed) console.error('display log records failed', JSON.stringify({ failed }));
      }
      after = ids[ids.length - 1];
    }
    if (users.length < batch) return report(true);
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
