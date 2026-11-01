// OPTIONS (docs/features/logs/options/plan.md D2–D4, D6): the pure option matcher and the options summary. No DB, no
// vendor and no React imports. Rows arrive already parsed (lib/broker.ts#toOptionRows for the vendor, scripts/seed.ts
// for demo data); this file decides, per contract, what is shown (long closes, as a percent on what the contracts
// cost, fees included) and what is excluded and counted, never guessed (POLICY F3c).
import { tCrit95 } from './trades.ts';
import { MIN_BETS } from './confidence.ts';
import { betClusters } from './bets.ts';

export const OPTION_KINDS = ['BUY', 'SELL', 'OPTIONEXPIRATION', 'OPTIONASSIGNMENT', 'OPTIONEXERCISE'] as const;
export type OptionKind = (typeof OPTION_KINDS)[number];
export const OPEN_CLOSE = ['BUY_TO_OPEN', 'BUY_TO_CLOSE', 'SELL_TO_OPEN', 'SELL_TO_CLOSE'] as const;
export type OpenClose = (typeof OPEN_CLOSE)[number];
export type OptionRight = 'CALL' | 'PUT';
// D4 (L3, E2): underlyings that settle in shares of a listed security. Allowlist, not denylist: anything else
// (options on futures, indexes, a missing or unknown type) is excluded and counted.
// ponytail: K6 cash-settled exercise is not priced and index underlyings are outside this allowlist — price an exercise
// from its settlement cash if index options are ever in scope (they are not: COMPLIANCE §2).
export const UNDERLYING_ALLOWLIST = ['cs', 'et', 'ad', 'ps', 'cef', 'ut'] as const;
export const DANGLING_DAYS = 5;
const DAY = 86_400_000;

// One option row with its parsed columns, nullable as stored in `option_activities`.
export type OptionRow = {
  externalId: string;
  accountId: string | null;
  kind: string | null;
  openClose: string | null;
  underlying: string | null;
  underlyingType: string | null;
  right: string | null;
  expiry: string | null; // YYYY-MM-DD
  strikeMilli: number | null; // integer thousandths
  multiplier: number | null; // 10 mini, else 100
  occTicker: string | null;
  units: number | null;
  price: number | null; // per share of the contract (SDK)
  fee: number | null;
  amount: number | null; // signed cash
  currency: string | null;
  executedAt: Date | null;
  verified: boolean; // source = 'snaptrade'
};

// What each excluded unit (a closing row or a dangling contract) was counted for. `short` fills
// users.excluded_options_short; every other cause fills users.excluded_options_other.
// ponytail: K7 per-cause counts are returned by matchOptions but not stored — store them (a jsonb on users or a counts
// table) once real data flows, and revisit if the share counted passes about 10%.
// Fix round 1 (QA 5): the multiplier is part of the contract key, so mini and standard contracts never share a ledger
// and there is no multiplier mismatch to count. `duplicate`: a close whose id another trader's close already holds.
export const CAUSES = ['short', 'exercise', 'expiryCash', 'noContract', 'contradict', 'flip', 'noOpen', 'dangling', 'adjusted',
  'currency', 'underlying', 'malformed', 'cashScale', 'duplicate'] as const;
export type Cause = (typeof CAUSES)[number];
export type Counts = Record<Cause, number>;
export const zeroCounts = (): Counts => Object.fromEntries(CAUSES.map((c) => [c, 0])) as Counts;

export type OptionTrade = {
  closeId: string; accountId: string; underlying: string; right: OptionRight; expiry: string;
  openedAt: Date; closedAt: Date; returnPct: number; holdingDays: number; verified: boolean;
};

// D2: strike in integer thousandths (no float drift between rows of one contract).
export const strikeMilli = (strike: unknown): number | null => {
  const n = typeof strike === 'string' ? Number(strike) : typeof strike === 'number' ? strike : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) : null;
};
// D2: `expiration_date[0..10]`, validated as a real calendar date.
export function validExpiry(s: unknown): string | null {
  if (typeof s !== 'string') return null;
  const d = s.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const t = new Date(`${d}T00:00:00Z`);
  return Number.isNaN(t.getTime()) || t.toISOString().slice(0, 10) !== d ? null : d;
}
export const multiplierOf = (isMini: unknown): number => (isMini === true ? 10 : 100);

// An OCC contract symbol: root (padded or not), YYMMDD, C or P, 8-digit strike in thousandths.
const OCC = /^([A-Z0-9.\-/ ]{1,6}?)\s*(\d{6})([CP])(\d{8})$/;
export const parseOcc = (s: unknown): { root: string; right: OptionRight; strikeMilli: number } | null => {
  if (typeof s !== 'string') return null;
  const m = s.trim().toUpperCase().match(OCC);
  return m ? { root: m[1].trim(), right: m[3] === 'C' ? 'CALL' : 'PUT', strikeMilli: Number(m[4]) } : null;
};
export const isOccSymbol = (s: unknown) => parseOcc(s) !== null;
/** Fix round 7: the one definition of "this row carries an option type": a non-empty string after trimming. The import
 *  (lib/broker.ts) routes by it and the rebuild's SQL (lib/options-sync.ts#optionTypeSet) says the same. */
export const hasOptionType = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
const bare = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

// D2: the contract key, from the typed fields only. null when any part is missing (the row is counted, never keyed).
export function contractKey(r: Pick<OptionRow, 'accountId' | 'underlying' | 'expiry' | 'right' | 'strikeMilli' | 'multiplier'>): string | null {
  if (!r.accountId || !r.underlying || !r.expiry || (r.right !== 'CALL' && r.right !== 'PUT') || r.strikeMilli === null || !r.multiplier) return null;
  return [r.accountId, r.underlying, r.expiry, r.right, r.strikeMilli, r.multiplier].join('|');
}

const isEvent = (k: string | null) => k === 'OPTIONEXPIRATION' || k === 'OPTIONASSIGNMENT' || k === 'OPTIONEXERCISE';
const isOpenType = (oc: string | null) => oc === 'BUY_TO_OPEN' || oc === 'SELL_TO_OPEN';
// D4 order: at equal instants opens first, then rows whose side the ledger infers, then explicit closes, then events
// (fix round 1, review 1); then by id. The id tie-break is for determinism only (plan E7), never a claim about trade order:
// where the order would decide between shown and counted, the rows are counted instead (F4-2 below).
// F4-2 (cycle 4, C4-7): an expiry orders by the contract's own `expiry` field, not by its stamp's hour: at the end of the
// expiry day (UTC) or at its stamp if later, after every trade of the contract dated on or before that day (nothing trades
// a contract after it expires). An exercise or assignment can come before expiry, so it keeps its stamp; one dated at
// midnight UTC exactly is a date-only row and orders at the end of its UTC day (fix round 1).
const rank = (r: OptionRow) => (isOpenType(r.openClose) ? 0 : isInferred(r) ? 1 : isEvent(r.kind) ? 3 : 2);
const isInferred = (r: Pick<OptionRow, 'kind' | 'openClose'>) => (r.kind === 'BUY' || r.kind === 'SELL') && !r.openClose;
export const orderTime = (r: Pick<OptionRow, 'kind' | 'executedAt' | 'expiry'>) => {
  const t = r.executedAt!.getTime();
  if (r.kind === 'OPTIONEXPIRATION' && r.expiry) return Math.max(t, Date.parse(`${r.expiry}T00:00:00Z`) + DAY - 1);
  return isEvent(r.kind) && t % DAY === 0 ? t + DAY - 1 : t;
};
const orderDay = (r: OptionRow) => Math.floor(orderTime(r) / DAY);
export function orderRows(rows: OptionRow[]): OptionRow[] {
  return [...rows].sort((a, b) => (orderTime(a) - orderTime(b)) || (rank(a) - rank(b)) || (a.externalId < b.externalId ? -1 : a.externalId > b.externalId ? 1 : 0));
}
/** F4-2: the UTC days (by order time) whose closes the ledger's order cannot settle: an exercise or assignment stamped
 *  with an hour (not 00:00:00Z) on a day the contract also trades. Its hour may be the vendor's, not the event's, so the
 *  day is tried with the event before and after the day's closes (matchContract's settleDay): when the readings differ
 *  or a close would find the position flat or go past it, that day's closes are counted under `contradict` (an
 *  assignment stays `short`, D4) and the contract is tainted until flat; otherwise the day is shown. */
export function unorderedDays(rows: OptionRow[]): Set<number> {
  const trading = new Set(rows.filter((r) => r.kind === 'BUY' || r.kind === 'SELL').map(orderDay));
  return new Set(rows.filter((r) => (r.kind === 'OPTIONEXERCISE' || r.kind === 'OPTIONASSIGNMENT') && r.executedAt!.getTime() % DAY !== 0 && trading.has(orderDay(r))).map(orderDay));
}
/** F4-2: an inferred-side row sharing its instant with an inferred-side row of the other side: on a flat net the id
 *  alone would decide which one opens (long or short), so the contract is counted under `contradict` until flat. */
// ponytail: same-instant inferred rows on a non-flat net can still decide a flip by id (net +1, an inferred sell of 2
// and buy of 1 at one instant) — count them too if the vendor ever sends unlabelled same-instant pairs (none seen).
const racesAt = (rows: OptionRow[]) => {
  const sides = new Map<number, Set<string>>();
  for (const r of rows) if (isInferred(r)) { const t = orderTime(r); const s = sides.get(t); if (s) s.add(r.kind!); else sides.set(t, new Set([r.kind!])); }
  return (r: OptionRow) => isInferred(r) && (sides.get(orderTime(r))?.size ?? 0) > 1;
};

const finitePos = (x: number | null): x is number => x !== null && Number.isFinite(x) && x > 0;
const finiteNonNeg = (x: number | null): x is number => x !== null && Number.isFinite(x) && x >= 0;
// D4 (E7): a cash scale failure: |amount| within a factor of 3 of units × price but not of units × price × multiplier,
// so the vendor's price is not per share and no return can be computed honestly.
const within3 = (a: number, b: number) => b > 0 && a >= b / 3 && a <= b * 3;
export function cashScaleFails(r: Pick<OptionRow, 'amount' | 'units' | 'price' | 'multiplier'>): boolean {
  if (r.amount === null || !Number.isFinite(r.amount) || r.amount === 0 || !finitePos(r.units) || !finitePos(r.price) || !r.multiplier) return false;
  const a = Math.abs(r.amount), x = Math.abs(r.units) * r.price;
  return within3(a, x) && !within3(a, x * r.multiplier);
}

type Lot = { units: number; cost: number; openedAt: Date; verified: boolean }; // cost: per unit, entry fee included
type WalkState = { net: number; lots: Lot[]; tainted: boolean };
type Sink = { count: (c: Cause, r: OptionRow) => void; trade: (t: OptionTrade) => void };

// Matches every row of one user (any accounts). `asOf` is injected (dangling contracts are measured against it).
export function matchOptions(rows: OptionRow[], asOf: Date): { trades: OptionTrade[]; counts: Counts; short: number; other: number } {
  const counts = zeroCounts();
  const trades: OptionTrade[] = [];
  const groups = new Map<string, OptionRow[]>();
  for (const r of rows) {
    const keyed = contractKey(r) !== null && r.executedAt instanceof Date && !Number.isNaN(r.executedAt.getTime());
    const known = r.kind !== null && (OPTION_KINDS as readonly string[]).includes(r.kind);
    if (!keyed || !known) {
      // D4 (E2): an event row without its contract; otherwise a malformed row. Opening rows never count.
      if (isEvent(r.kind) && contractKey(r) === null) counts.noContract++;
      else if (!isOpenType(r.openClose)) counts.malformed++;
      continue;
    }
    const k = contractKey(r)!;
    const g = groups.get(k);
    if (g) g.push(r); else groups.set(k, [r]);
  }
  for (const g of groups.values()) matchContract(orderRows(g), asOf, counts, trades);
  const short = counts.short;
  return { trades, counts, short, other: Object.values(counts).reduce((a, b) => a + b, 0) - short };
}

// One contract (account, underlying, expiry, right, strike, multiplier). Fix round 1 (QA 4): only conflicting non-null
// values count: a currency, OCC ticker or underlying type missing on a row (an event row often has none) is no mismatch.
function matchContract(rows: OptionRow[], asOf: Date, counts: Counts, trades: OptionTrade[]) {
  const first = rows[0];
  // Contract-level exclusions: every long result of this contract is counted under the first that applies.
  let excluded: Cause | null = null;
  const present = <T,>(xs: (T | null)[]) => [...new Set(xs.filter((x): x is T => x !== null && x !== ''))];
  const types = present(rows.map((r) => r.underlyingType));
  if (present(rows.map((r) => r.currency)).length > 1) excluded = 'currency';
  // A missing type on every row is outside the allowlist (L3); conflicting types too.
  else if (types.length !== 1 || !(UNDERLYING_ALLOWLIST as readonly string[]).includes(types[0])) excluded = 'underlying';
  // ponytail: K5 a corporate action on the underlying during a hold is caught only when the OCC root changes — taint the
  // contract from the corporate-action rows once that importer (PR #40) is wired.
  // ponytail: a mini contract's conventional root (the underlying plus a trailing digit, e.g. XYZ7) counts as adjusted —
  // accept it only once the vendor marks such roots explicitly (never guessed from the digit).
  else if (rows.some((r) => { if (!r.occTicker) return false; const o = parseOcc(r.occTicker); return !o || bare(o.root) !== bare(r.underlying!); })) excluded = 'adjusted';
  else if (rows.some((r) => (r.kind === 'BUY' || r.kind === 'SELL') && (!finitePos(r.units) || !finiteNonNeg(r.price) || (r.fee !== null && !Number.isFinite(r.fee))))) excluded = 'malformed';
  else if (rows.some((r) => (r.kind === 'BUY' || r.kind === 'SELL') && cashScaleFails(r))) excluded = 'cashScale';

  const mult = first.multiplier!;
  const fee = (r: OptionRow) => Math.abs(r.fee ?? 0);
  const units = (r: OptionRow) => Math.abs(r.units ?? 0);
  // net: contracts, positive long, negative short (positions net within an account); tainted: after a contradicting or
  // flipping row, until the position is flat again. F4-2 review: the walk runs on a state and writes to a sink so one
  // day can be tried in two readings (lib/options.ts#settleDay) before anything is shown or counted.
  const real: Sink = { count: (c) => { counts[c]++; }, trade: (t) => { trades.push(t); } };
  const takeLots = (st: WalkState, n: number) => {
    let left = n;
    while (left > 1e-12 && st.lots.length) { const take = Math.min(st.lots[0].units, left); st.lots[0].units -= take; left -= take; if (st.lots[0].units <= 1e-12) st.lots.shift(); }
  };
  const longResult = (st: WalkState, sink: Sink, r: OptionRow, u: number, exit: number) => {
    // FIFO over long lots: basis = cost of the consumed contracts (entry fees included); proceeds net of the exit fee.
    let left = u, basis = 0, verified = r.verified;
    let openedAt = null as Date | null;
    while (left > 1e-12 && st.lots.length) {
      const lot = st.lots[0];
      const take = Math.min(lot.units, left);
      basis += take * lot.cost;
      openedAt = openedAt && openedAt < lot.openedAt ? openedAt : lot.openedAt;
      verified = verified && lot.verified;
      lot.units -= take; left -= take;
      if (lot.units <= 1e-12) st.lots.shift();
    }
    const proceeds = u * exit * mult - fee(r);
    if (excluded) { sink.count(excluded, r); return; }
    if (!(basis > 0) || !openedAt) { sink.count('malformed', r); return; }
    sink.trade({
      closeId: r.externalId, accountId: r.accountId!, underlying: r.underlying!, right: r.right as OptionRight, expiry: r.expiry!,
      openedAt, closedAt: r.executedAt!, returnPct: (proceeds - basis) / basis,
      holdingDays: (r.executedAt!.getTime() - openedAt.getTime()) / DAY, verified,
    });
  };
  const flat = (st: WalkState) => { if (Math.abs(st.net) < 1e-12) st.net = 0; };
  const taint = (st: WalkState, sink: Sink, r: OptionRow, cause: Cause, signed: number) => {
    sink.count(cause, r);
    st.net += signed;
    st.lots = [];
    st.tainted = st.net !== 0;
  };
  const races = racesAt(rows);

  // One row. `forced`: a day whose order cannot be settled (F4-2): the row goes through the tainted walk.
  const step = (r: OptionRow, st: WalkState, sink: Sink, forced: boolean) => {
    const u = units(r);
    // F4-2: on a flat net, an inferred row racing another at its instant moves the net without a basis: neither opening
    // row counts, and every close until flat is counted under contradict.
    if (!st.tainted && !forced && st.net === 0 && races(r)) {
      st.net += r.kind === 'BUY' ? u : -u;
      st.lots = [];
      st.tainted = st.net !== 0;
      return;
    }
    if (st.tainted || forced) {
      // Every row while tainted moves the net; a non-opening one is counted (its basis is unknown). Plan D4 (orchestrator
      // decision 2026-11-01): a short close while tainted stays counted under "other" (contradict), not "short": the
      // contract is tainted until flat, whatever the side of the close.
      const net = st.net;
      const signed = r.kind === 'BUY' ? u : r.kind === 'SELL' ? -u : net > 0 ? -Math.min(u || net, net) : net < 0 ? Math.min(u || -net, -net) : 0;
      if (r.kind === 'OPTIONASSIGNMENT') sink.count('short', r);
      else if (!isOpenType(r.openClose)) sink.count('contradict', r);
      st.net += signed;
      flat(st);
      st.tainted = st.net !== 0;
      st.lots = []; // basis unknown while tainted; flat leaves nothing
      return;
    }
    if (r.kind === 'BUY') {
      const oc = r.openClose ?? (st.net < 0 ? 'BUY_TO_CLOSE' : 'BUY_TO_OPEN');
      if (oc === 'BUY_TO_OPEN') {
        if (st.net < 0) return taint(st, sink, r, 'contradict', u);
        st.lots.push({ units: u, cost: u > 0 ? ((r.price ?? 0) * mult * u + fee(r)) / u : 0, openedAt: r.executedAt!, verified: r.verified });
        st.net += u;
      } else if (oc === 'BUY_TO_CLOSE') {
        if (st.net === 0) return sink.count('noOpen', r);
        if (st.net > 0) return taint(st, sink, r, 'contradict', u);
        if (u > -st.net + 1e-12) return taint(st, sink, r, 'flip', u);
        sink.count('short', r);
        st.net += u;
        flat(st);
      } else taint(st, sink, r, 'contradict', u);
    } else if (r.kind === 'SELL') {
      const oc = r.openClose ?? (st.net > 0 ? 'SELL_TO_CLOSE' : 'SELL_TO_OPEN');
      if (oc === 'SELL_TO_OPEN') {
        if (st.net > 0) return taint(st, sink, r, 'contradict', -u);
        st.net -= u;
      } else if (oc === 'SELL_TO_CLOSE') {
        if (st.net === 0) return sink.count('noOpen', r);
        if (st.net < 0) return taint(st, sink, r, 'contradict', -u);
        if (u > st.net + 1e-12) return taint(st, sink, r, 'flip', -u);
        longResult(st, sink, r, u, r.price ?? 0);
        st.net -= u;
        flat(st);
      } else taint(st, sink, r, 'contradict', -u);
    } else if (r.kind === 'OPTIONEXPIRATION') {
      // Fix round 1 (review 1): an expiry closes min(row units, net), like an exercise.
      if (st.net > 0) {
        const n = Math.min(u || st.net, st.net);
        if (r.amount !== null && Number.isFinite(r.amount) && r.amount !== 0) { sink.count('expiryCash', r); takeLots(st, n); }
        else longResult(st, sink, r, n, 0);
        st.net -= n;
        flat(st);
        if (st.net === 0) st.lots = [];
      } else if (st.net < 0) { sink.count('short', r); st.net += Math.min(u || -st.net, -st.net); flat(st); }
      else sink.count('noOpen', r);
    } else if (r.kind === 'OPTIONEXERCISE') {
      if (st.net > 0) {
        const n = Math.min(u || st.net, st.net);
        sink.count('exercise', r);
        // The exercised contracts leave FIFO (their premium belongs to the delivered shares, which are not priced).
        takeLots(st, n);
        st.net -= n;
        flat(st);
      } else if (st.net < 0) taint(st, sink, r, 'contradict', 0);
      else sink.count('noOpen', r);
    } else if (r.kind === 'OPTIONASSIGNMENT') {
      // Fix round 1 (QA 6): an assignment of a long lot contradicts the ledger: other, and tainted until flat.
      if (st.net > 0) taint(st, sink, r, 'contradict', 0);
      else { sink.count('short', r); if (st.net < 0) { st.net += Math.min(u || -st.net, -st.net); flat(st); } }
    }
  };

  // F4-2 review (finding 2, orchestrator decision): the trader picks the day of an exercise, so counting every close of
  // that day would let a loss be hidden by choice of day. Try the day in two readings, the stamped exercises and
  // assignments before the day's closes and after them. Show the day when both readings give every row the same result
  // and no close finds the position flat or would take it past flat (short); otherwise count the day as before.
  // ponytail: a narrower steerable case remains: lots L1 @5 then L2 @1, and on one day an exercise of 1 and a close of 1
  // @2; exercise-first gives +100%, close-first -60%, the readings differ and the close is counted, so a trader willing
  // to spend an exercise can still have a loss counted — fix: an exercise-order field from the vendor or a per-contract
  // lot id (owner item).
  const settleDay = (day: OptionRow[], st: WalkState): OptionRow[] | null => {
    const stamped = (r: OptionRow) => (r.kind === 'OPTIONEXERCISE' || r.kind === 'OPTIONASSIGNMENT') && r.executedAt!.getTime() % DAY !== 0;
    const ev = day.filter(stamped), rest = day.filter((r) => !stamped(r));
    const isClose = (r: OptionRow) => !isOpenType(r.openClose);
    const firstClose = rest.findIndex(isClose);
    if (firstClose < 0) return [...rest, ...ev]; // no close of the contract that day: nothing a reading could change
    const lastClose = rest.length - 1 - [...rest].reverse().findIndex(isClose);
    const before = [...rest.slice(0, firstClose), ...ev, ...rest.slice(firstClose)];
    const after = [...rest.slice(0, lastClose + 1), ...ev, ...rest.slice(lastClose + 1)];
    const run = (seq: OptionRow[]) => {
      const s: WalkState = { net: st.net, tainted: st.tainted, lots: st.lots.map((l) => ({ ...l })) };
      const out = new Map<string, string | OptionTrade>();
      let past = false;
      const sink: Sink = { count: (c, r) => { out.set(r.externalId, c); if (c === 'noOpen' || c === 'flip' || c === 'contradict') past = true; }, trade: (t) => { out.set(t.closeId, t); } };
      for (const r of seq) step(r, s, sink, false);
      return { s, out, past: past || s.tainted };
    };
    const a = run(before), b = run(after);
    const near = (x: number, y: number) => Math.abs(x - y) < 1e-9;
    // Lots left over, with neighbours of one cost, date and verified flag joined (two readings can split them differently).
    const joined = (lots: Lot[]) => lots.reduce<Lot[]>((acc, l) => {
      const p = acc[acc.length - 1];
      if (p && near(p.cost, l.cost) && p.openedAt.getTime() === l.openedAt.getTime() && p.verified === l.verified) p.units += l.units; else acc.push({ ...l });
      return acc;
    }, []);
    const la = joined(a.s.lots), lb = joined(b.s.lots);
    if (a.past || b.past || !near(a.s.net, b.s.net) || a.out.size !== b.out.size || la.length !== lb.length) return null;
    for (const [id, x] of a.out) {
      const y = b.out.get(id);
      if (typeof x === 'string' || typeof y === 'string' || !y) { if (x !== y) return null; continue; }
      if (!near(x.returnPct, y.returnPct) || x.openedAt.getTime() !== y.openedAt.getTime() || x.verified !== y.verified) return null;
    }
    if (la.some((l, i) => { const m = lb[i]; return !near(l.units, m.units) || !near(l.cost, m.cost) || l.openedAt.getTime() !== m.openedAt.getTime() || l.verified !== m.verified; })) return null;
    return before;
  };

  const st: WalkState = { net: 0, lots: [], tainted: false };
  const unordered = unorderedDays(rows);
  for (let i = 0; i < rows.length;) {
    const d = orderDay(rows[i]);
    if (!unordered.has(d)) { step(rows[i++], st, real, false); continue; }
    let j = i;
    while (j < rows.length && orderDay(rows[j]) === d) j++;
    const day = rows.slice(i, j);
    i = j;
    const settled = st.tainted ? null : settleDay(day, st);
    if (settled) for (const r of settled) step(r, st, real, false);
    else for (const r of day) step(r, st, real, true);
  }
  // D4: a dangling contract: long lots still open more than DANGLING_DAYS whole days after expiry.
  if (!st.tainted && st.net > 0 && st.lots.length) {
    const past = Math.floor((asOf.getTime() - Date.parse(`${first.expiry}T00:00:00Z`)) / DAY);
    if (past > DANGLING_DAYS) counts.dangling++;
  }
}

// D6 (E8): the options line's numbers. Pure; simple returns; the TR-9 cluster-robust t-interval clustered by underlying
// with overlapping holds (lib/bets.ts#betClusters); no range under MIN_BETS bets; no verdict or edge words. No floor
// at -100%: fees can take a long below it (D3), so the range is printed as computed.
export type OptionSummary = { n: number; winRate: number; avg: number; range: { low: number; high: number } | null; bets: number };
export function optionSummary(trades: Pick<OptionTrade, 'underlying' | 'openedAt' | 'closedAt' | 'returnPct'>[]): OptionSummary | null {
  const n = trades.length;
  if (!n) return null;
  const avg = trades.reduce((a, t) => a + t.returnPct, 0) / n;
  const winRate = trades.filter((t) => t.returnPct > 0).length / n;
  const bets = betClusters(trades.map((t) => ({ symbol: t.underlying, openedAt: t.openedAt, closedAt: t.closedAt, returnPct: t.returnPct })));
  const k = bets.length;
  let range: OptionSummary['range'] = null;
  if (k >= MIN_BETS) {
    const se = Math.sqrt((k / (k - 1)) * bets.reduce((a, b) => a + (b.sum - b.n * avg) ** 2, 0)) / n;
    const half = tCrit95(k - 1) * se;
    if (Number.isFinite(half)) range = { low: avg - half, high: avg + half };
  }
  return { n, winRate, avg, range, bets: k };
}
