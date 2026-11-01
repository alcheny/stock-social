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
export const CAUSES = ['short', 'exercise', 'expiryCash', 'noContract', 'contradict', 'flip', 'noOpen', 'dangling', 'adjusted',
  'multiplier', 'currency', 'underlying', 'malformed', 'cashScale'] as const;
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
const bare = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

// D2: the contract key, from the typed fields only. null when any part is missing (the row is counted, never keyed).
export function contractKey(r: Pick<OptionRow, 'accountId' | 'underlying' | 'expiry' | 'right' | 'strikeMilli' | 'multiplier'>): string | null {
  if (!r.accountId || !r.underlying || !r.expiry || (r.right !== 'CALL' && r.right !== 'PUT') || r.strikeMilli === null || !r.multiplier) return null;
  return [r.accountId, r.underlying, r.expiry, r.right, r.strikeMilli, r.multiplier].join('|');
}
const baseKey = (r: OptionRow) => [r.accountId, r.underlying, r.expiry, r.right, r.strikeMilli].join('|');

const isEvent = (k: string | null) => k === 'OPTIONEXPIRATION' || k === 'OPTIONASSIGNMENT' || k === 'OPTIONEXERCISE';
const isOpenType = (oc: string | null) => oc === 'BUY_TO_OPEN' || oc === 'SELL_TO_OPEN';
// D4 order: at equal instants opens first, then rows whose side the ledger infers, then closes and events; then by id.
const rank = (r: OptionRow) => (isOpenType(r.openClose) ? 0 : (r.kind === 'BUY' || r.kind === 'SELL') && !r.openClose ? 1 : 2);
export function orderRows(rows: OptionRow[]): OptionRow[] {
  return [...rows].sort((a, b) => (a.executedAt!.getTime() - b.executedAt!.getTime()) || (rank(a) - rank(b)) || (a.externalId < b.externalId ? -1 : a.externalId > b.externalId ? 1 : 0));
}

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
    const k = baseKey(r);
    const g = groups.get(k);
    if (g) g.push(r); else groups.set(k, [r]);
  }
  for (const g of groups.values()) matchContract(orderRows(g), asOf, counts, trades);
  const short = counts.short;
  return { trades, counts, short, other: Object.values(counts).reduce((a, b) => a + b, 0) - short };
}

// One contract (account, underlying, expiry, right, strike; the multiplier and currency are checked to agree).
function matchContract(rows: OptionRow[], asOf: Date, counts: Counts, trades: OptionTrade[]) {
  const first = rows[0];
  // Contract-level exclusions: every long result of this contract is counted under the first that applies.
  let excluded: Cause | null = null;
  if (new Set(rows.map((r) => r.multiplier)).size > 1) excluded = 'multiplier';
  else if (new Set(rows.map((r) => r.currency ?? '')).size > 1) excluded = 'currency';
  else if (!first.underlyingType || !(UNDERLYING_ALLOWLIST as readonly string[]).includes(first.underlyingType)
    || new Set(rows.map((r) => r.underlyingType)).size > 1) excluded = 'underlying';
  else if (rows.some((r) => { const o = parseOcc(r.occTicker); return !o || bare(o.root) !== bare(r.underlying!); })) excluded = 'adjusted';
  else if (rows.some((r) => (r.kind === 'BUY' || r.kind === 'SELL') && (!finitePos(r.units) || !finiteNonNeg(r.price) || (r.fee !== null && !Number.isFinite(r.fee))))) excluded = 'malformed';
  else if (rows.some((r) => (r.kind === 'BUY' || r.kind === 'SELL') && cashScaleFails(r))) excluded = 'cashScale';

  const mult = first.multiplier!;
  let net = 0; // contracts: positive long, negative short (positions net within an account)
  let longLots: Lot[] = [];
  let tainted = false; // after a contradicting or flipping row, until the position is flat again
  const fee = (r: OptionRow) => Math.abs(r.fee ?? 0);
  const units = (r: OptionRow) => Math.abs(r.units ?? 0);
  const longResult = (r: OptionRow, u: number, exit: number) => {
    // FIFO over long lots: basis = cost of the consumed contracts (entry fees included); proceeds net of the exit fee.
    let left = u, basis = 0, openedAt: Date | null = null, verified = r.verified;
    while (left > 1e-12 && longLots.length) {
      const lot = longLots[0];
      const take = Math.min(lot.units, left);
      basis += take * lot.cost;
      openedAt = openedAt && openedAt < lot.openedAt ? openedAt : lot.openedAt;
      verified = verified && lot.verified;
      lot.units -= take; left -= take;
      if (lot.units <= 1e-12) longLots.shift();
    }
    const proceeds = u * exit * mult - fee(r);
    if (excluded) { counts[excluded]++; return; }
    if (!(basis > 0) || !openedAt) { counts.malformed++; return; }
    trades.push({
      closeId: r.externalId, accountId: r.accountId!, underlying: r.underlying!, right: r.right as OptionRight, expiry: r.expiry!,
      openedAt, closedAt: r.executedAt!, returnPct: (proceeds - basis) / basis,
      holdingDays: (r.executedAt!.getTime() - openedAt.getTime()) / DAY, verified,
    });
  };
  const taint = (cause: Cause, signed: number) => {
    counts[cause]++;
    net += signed;
    longLots = [];
    tainted = net !== 0;
  };

  for (const r of rows) {
    const u = units(r);
    if (tainted) {
      // Every row while tainted moves the net; a non-opening one is counted (its basis is unknown).
      const signed = r.kind === 'BUY' ? u : r.kind === 'SELL' ? -u : net > 0 ? -Math.min(u || net, net) : net < 0 ? Math.min(u || -net, -net) : 0;
      if (r.kind === 'OPTIONASSIGNMENT') counts.short++;
      else if (!isOpenType(r.openClose)) counts.contradict++;
      net += signed;
      if (Math.abs(net) < 1e-12) { net = 0; tainted = false; longLots = []; }
      continue;
    }
    if (r.kind === 'BUY') {
      const oc = r.openClose ?? (net < 0 ? 'BUY_TO_CLOSE' : 'BUY_TO_OPEN');
      if (oc === 'BUY_TO_OPEN') {
        if (net < 0) { taint('contradict', u); continue; }
        longLots.push({ units: u, cost: u > 0 ? ((r.price ?? 0) * mult * u + fee(r)) / u : 0, openedAt: r.executedAt!, verified: r.verified });
        net += u;
      } else if (oc === 'BUY_TO_CLOSE') {
        if (net === 0) { counts.noOpen++; continue; }
        if (net > 0) { taint('contradict', u); continue; }
        if (u > -net + 1e-12) { taint('flip', u); continue; }
        counts.short++;
        net += u;
        if (Math.abs(net) < 1e-12) net = 0;
      } else { taint('contradict', u); }
    } else if (r.kind === 'SELL') {
      const oc = r.openClose ?? (net > 0 ? 'SELL_TO_CLOSE' : 'SELL_TO_OPEN');
      if (oc === 'SELL_TO_OPEN') {
        if (net > 0) { taint('contradict', -u); continue; }
        net -= u;
      } else if (oc === 'SELL_TO_CLOSE') {
        if (net === 0) { counts.noOpen++; continue; }
        if (net < 0) { taint('contradict', -u); continue; }
        if (u > net + 1e-12) { taint('flip', -u); continue; }
        longResult(r, u, r.price ?? 0);
        net -= u;
        if (Math.abs(net) < 1e-12) net = 0;
      } else { taint('contradict', -u); }
    } else if (r.kind === 'OPTIONEXPIRATION') {
      if (net > 0) {
        const n = net;
        if (r.amount !== null && Number.isFinite(r.amount) && r.amount !== 0) { counts.expiryCash++; longLots = []; }
        else longResult(r, n, 0);
        net = 0; longLots = [];
      } else if (net < 0) { counts.short++; net = 0; }
      else counts.noOpen++;
    } else if (r.kind === 'OPTIONEXERCISE') {
      if (net > 0) {
        const n = Math.min(u || net, net);
        counts.exercise++;
        // The exercised contracts leave FIFO (their premium belongs to the delivered shares, which are not priced).
        let left = n;
        while (left > 1e-12 && longLots.length) { const take = Math.min(longLots[0].units, left); longLots[0].units -= take; left -= take; if (longLots[0].units <= 1e-12) longLots.shift(); }
        net -= n;
        if (Math.abs(net) < 1e-12) net = 0;
      } else if (net < 0) taint('contradict', 0);
      else counts.noOpen++;
    } else if (r.kind === 'OPTIONASSIGNMENT') {
      counts.short++;
      if (net < 0) { net += Math.min(u || -net, -net); if (Math.abs(net) < 1e-12) net = 0; }
      else if (net > 0) { tainted = true; longLots = []; }
    }
  }
  // D4: a dangling contract: long lots still open more than DANGLING_DAYS whole days after expiry.
  if (!tainted && net > 0 && longLots.length) {
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
