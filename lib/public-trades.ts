// F-7: filing rows → lots → closed trades via the unchanged FIFO matcher (lib/trades.ts). Only open-market buy → open-market
// sale is priced; other acquisitions and pre-report holdings are unknown-cost lots, and a sale touching one is excluded and
// counted, as are indirect, derivative and unreconciled rows (from a held-after mismatch or a missing share count on).
import type { TransactionSql } from 'postgres';
import { matchTrades, type Activity } from './trades.ts';
import { PLACEHOLDER_ATTESTED_AT, PUBLIC_FEED_DELAY_DAYS } from './public-gate.ts';
import { checkDisplayName, DISPLAY_NAME_MAX, handleVerdict, RESERVED_SUBSTRINGS } from './handles.ts';
import { sanitizeUserText } from './text-safety.ts';

export type PubRow = { external_id: string; filing_id: string; amends: string | null; filing_url: string; symbol: string; code: string; side: 'BUY' | 'SELL' | null;
  units: number; price: number | null; held_after: number | null; indirect: boolean; derivative: boolean; acquired: boolean; executed_at: Date; filed_at: Date };
export type PubTrade = { sellId: string; symbol: string; openedAt: Date; closedAt: Date; returnPct: number; holdingDays: number; filingUrl: string; feedAfter: Date };
const EPS = 1e-6, DAY = 86_400_000;
// Of each chain of amending filings only the latest filed one's rows stand.
export function effectiveRows(rows: PubRow[]): PubRow[] {
  const meta = new Map(rows.map((r) => [r.filing_id, { amends: r.amends, filed: r.filed_at.getTime() }]));
  const root = (id: string) => { for (let i = 0; i < 50 && meta.get(id)?.amends; i++) id = meta.get(id)!.amends!; return id; };
  const best = new Map<string, string>();
  for (const [id, m] of meta) {
    const cur = best.get(root(id)), c = cur ? meta.get(cur)!.filed : -Infinity;
    if (m.filed > c || (m.filed === c && id > cur!)) best.set(root(id), id);
  }
  return rows.filter((r) => best.get(root(r.filing_id)) === r.filing_id);
}
export function matchPublic(input: PubRow[]): { trades: PubTrade[]; excluded: Record<string, number>; openSymbols: string[] } {
  const excluded: Record<string, number> = {}, count = (k: string) => { excluded[k] = (excluded[k] ?? 0) + 1; };
  const rowNo = (r: PubRow) => Number(r.external_id.split(':').pop()) || 0;
  const rows = effectiveRows(input).sort((a, b) => a.executed_at.getTime() - b.executed_at.getTime() || a.filed_at.getTime() - b.filed_at.getTime()
    || (a.filing_id < b.filing_id ? -1 : a.filing_id > b.filing_id ? 1 : rowNo(a) - rowNo(b)));
  const acts: Activity[] = [];
  const priced = new Map<string, { row: PubRow; filed: number }>(); // sale external id → the latest filing behind it
  const queues = new Map<string, { lots: { units: number; priced: boolean; filed: number }[]; held: number; seen: boolean; broken: boolean }>();
  for (const r of rows) {
    if (r.derivative || r.indirect) { count(r.derivative ? 'derivative' : 'indirect'); continue; }
    const q = queues.get(r.symbol) ?? { lots: [], held: 0, seen: false, broken: false }, filed = r.filed_at.getTime(); queues.set(r.symbol, q);
    const act = (side: 'BUY' | 'SELL', units: number, price: number, verified: boolean, at = r.executed_at, id = r.external_id) =>
      acts.push({ externalId: id, accountId: 'public', symbol: r.symbol, side, units, price, fee: 0, executedAt: at, verified });
    const lot = (units: number, isPriced: boolean, price: number, at?: Date) => {
      q.lots.push({ units, priced: isPriced, filed }); q.held += units;
      act('BUY', units, price, isPriced, at, `${r.external_id}#${q.lots.length}`);
    };
    // Holdings from before the first report in this security: cost unknown.
    const before = r.held_after === null ? 0 : r.held_after - (r.acquired ? r.units : -r.units);
    if (!q.seen && before > EPS) lot(before, false, 1, new Date(r.executed_at.getTime() - 1)); q.seen = true;
    if (r.acquired) { const ok = r.side === 'BUY' && (r.price ?? 0) > 0; lot(r.units, ok, ok ? r.price! : 1); }
    let allPriced = true, latest = filed;
    if (!r.acquired && q.held < r.units - EPS) lot(r.units - q.held, false, 1); // shares with no recorded entry
    for (let left = r.acquired ? 0 : r.units; left > EPS && q.lots.length;) {
      const l = q.lots[0], take = Math.min(l.units, left);
      allPriced &&= l.priced; latest = Math.max(latest, l.filed); l.units -= take; left -= take; q.held -= take;
      if (l.units <= EPS) q.lots.shift();
    }
    if (r.held_after === null || Math.abs(q.held - r.held_after) > EPS * Math.max(1, r.held_after)) q.broken = true; // no share count: unknown
    if (r.acquired) continue;
    const sale = r.side === 'SELL' && (r.price ?? 0) > 0;
    act('SELL', r.units, sale ? r.price! : 1, sale && allPriced && !q.broken);
    const reason = r.side !== 'SELL' ? (r.code === 'G' ? 'gift' : 'other') : q.broken ? 'unreconciled' : !sale || !allPriced ? 'no_price' : null;
    if (reason) count(reason); else priced.set(r.external_id, { row: r, filed: latest });
  }
  const got = matchTrades(acts).trades.filter((t) => t.verified && priced.has(t.sellId)), ids = new Set(got.map((t) => t.sellId));
  for (const id of priced.keys()) if (!ids.has(id)) count('no_price'); // lib/trades.ts's own epsilon left it unpriced: counted, never lost
  const trades = got.map((t) => {
    const p = priced.get(t.sellId)!;
    return { sellId: `pub:${t.sellId}`, symbol: t.symbol, openedAt: t.openedAt, closedAt: t.closedAt, returnPct: t.returnPct, holdingDays: t.holdingDays,
      filingUrl: p.row.filing_url, feedAfter: new Date(p.filed + PUBLIC_FEED_DELAY_DAYS * DAY) };
  });
  const openSymbols = [...queues].filter(([, q]) => q.lots.some((l) => l.priced && l.units > EPS)).map(([s]) => s).sort();
  return { trades, excluded, openSymbols };
}
// The trade page's "Bought" links: the effective direct open-market purchases of the symbol on the trade's opening day.
export const openingFilings = (rows: PubRow[], symbol: string, at: Date) => [...new Set(effectiveRows(rows).filter((r) => r.side === 'BUY' && !r.indirect
  && !r.derivative && (r.price ?? 0) > 0 && r.symbol === symbol && +r.executed_at === +at).map((r) => r.filing_url))];
// The placeholder attempt (NOT an attestation): re-created after the purge takes it; `for share` keeps the purge off it.
export async function placeholderAttempt(tx: TransactionSql): Promise<string> {
  const at = PLACEHOLDER_ATTESTED_AT;
  const [a] = await tx`select id from signup_attempts where method = 'dev' and user_id is null and completed_at is null
    and adult_attested_at = ${at} and created_at = ${at} order by id limit 1 for share`;
  return String(a?.id ?? (await tx`insert into signup_attempts (method, adult_attested_at, created_at) values ('dev', ${at}, ${at}) returning id`)[0].id);
}
// F4-7 (C4-11): filer identities pass the rules users get. Handles: reserved words (lib/handles.ts#RESERVED_SUBSTRINGS,
// also spelt across "_") are dropped from the slug, no trailing "_" after the cut, and every candidate must get the
// sign-up verdict 'ok' (the reserved list in every look-alike reading); last comes pf_filer_<id36>, always free of words.
const RESERVED_IN_SLUG = RESERVED_SUBSTRINGS.map((w) => new RegExp([...w].join('_*'), 'g'));
const trimUnderscores = (s: string) => s.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
export function filerHandles(name: string, filerId: number): string[] {
  let slug = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_');
  for (const re of RESERVED_IN_SLUG) slug = slug.replace(re, '_');
  slug = trimUnderscores(trimUnderscores(slug).slice(0, 13)) || 'filer';
  const id36 = filerId.toString(36), last = `pf_filer_${id36}`;
  const ok = (h: string) => h.length <= 20 && !h.endsWith('_') && handleVerdict(h, { others: [], demo: [] }) === 'ok';
  return [...new Set([...[`pf_${slug}`, `pf_${trimUnderscores(slug.slice(0, 9))}_${id36}`].filter(ok), last])];
}
// Names: cleaned like a user's typed name (lib/auth/attempts.ts), cut to 40 code points; a name the display-name rules
// refuse falls back to the handle, as a user's would (filers cannot pick another name).
export function filerDisplayName(name: string, handle: string): string {
  const c = checkDisplayName(sanitizeUserText(name, DISPLAY_NAME_MAX));
  return c.ok ? c.name : handle;
}
async function createFilerUser(tx: TransactionSql, filerId: number, name: string): Promise<{ id: number }> {
  const attempt = await placeholderAttempt(tx);
  // ponytail: if every candidate handle is taken the filing fails on every read — a numbered fallback would fix it.
  // ponytail: a filer row created before F4-7 keeps its handle (identity by filer); the switch is off in production, so a
  // one-off rename pass is only needed if such rows exist — run filerHandles over users with public_filer_id set.
  for (const handle of filerHandles(name, filerId)) {
    const [u] = await tx`insert into users (handle, display_name, adult_attested_at, signup_attempt_id, public_filer_id)
      select ${handle}, ${filerDisplayName(name, handle)}, ${PLACEHOLDER_ATTESTED_AT}, ${attempt}, ${filerId}
      where not exists (select 1 from handle_reservations where handle = ${handle} and until > now())
      on conflict (handle) do nothing returning id`;
    if (u) return u as { id: number };
  }
  throw new Error('no free filer handle');
}
// Delete+insert a filer's closes; its users row (name as filed) appears with the first priced close; never if removed.
export async function rebuildPublicTrades(filerId: number, tx: TransactionSql, name?: string): Promise<{ trades: number; userId: number | null }> {
  const [f] = await tx`select removed_at from public_filers where id = ${filerId} for update`;
  if (!f || f.removed_at) return { trades: 0, userId: null };
  const m = matchPublic(await tx<PubRow[]>`select * from public_transactions where filer_id = ${filerId}`);
  await tx`update public_filers set excluded = ${tx.json(m.excluded)}, open_symbols = ${m.openSymbols} where id = ${filerId}`;
  let [u] = await tx`select id from users where public_filer_id = ${filerId}`;
  if (!u && m.trades.length && name?.trim()) u = await createFilerUser(tx, filerId, name);
  if (!u) return { trades: 0, userId: null };
  // ponytail: a filer left with no priced close (an amendment) keeps its users row — deleting it would free the handle.
  await tx`delete from closed_trades where user_id = ${u.id}`;
  for (let i = 0; i < m.trades.length; i += 1000) await tx`insert into closed_trades ${tx(m.trades.slice(i, i + 1000).map((t) => ({ user_id: u.id, sell_id: t.sellId,
    account_id: 'public', symbol: t.symbol, opened_at: t.openedAt, closed_at: t.closedAt, return_pct: t.returnPct, holding_days: t.holdingDays, verified: false, filing_url: t.filingUrl, feed_after: t.feedAfter })))}`;
  // The feed's paging test for a close imported after asOf (closed_trades.sell_imported_at; the insert trigger reads only
  // broker/demo activities): the closing sale's import time, set after the insert.
  await tx`update closed_trades t set sell_imported_at = p.created_at from public_transactions p
    where t.user_id = ${u.id} and p.filer_id = ${filerId} and p.side = 'SELL' and t.sell_id = 'pub:' || p.external_id`;
  return { trades: m.trades.length, userId: u.id as number };
}
