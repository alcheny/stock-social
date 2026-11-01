// Corporate actions (POLICY F3c): stock splits, reverse splits, stock dividends, symbol changes and spin-offs.
// Pure apart from the two DB helpers at the end, which take the caller's connection. The FIFO matcher
// (lib/trades.ts#matchTrades) applies these to its lots; anything it cannot price exactly is excluded and counted,
// never guessed. Decisions and their reasons: docs/features/logs/corporate-actions/committee-2026-11-01.md.
//
// ponytail: lib/broker.ts (protected) asks the vendor for BUY and SELL rows only, so in production no corporate-action
// row reaches the app yet. `fromVendorRows` is the transformation the owner's broker.ts change would call on the
// vendor's raw activity rows; until then only the matcher's oversell safety net protects records from unrecorded splits.

import type { PendingQuery, Row as PgRow, Sql, TransactionSql } from 'postgres';
import type { Activity } from './trades.ts';

// New shares per old share, as integers: 2:1 is {p: 2, q: 1}; a 1-for-10 reverse split is {p: 1, q: 10}.
export type Ratio = { p: number; q: number };

type Base = { externalId: string; accountId: string; symbol: string; executedAt: Date };
export type CorporateAction =
  // `ratio` when known (a parsed description or a test); otherwise `units`, the vendor's share count, read both as the
  // change in shares and as the new total against the ledger (resolveRatio).
  | (Base & { kind: 'split'; ratio?: Ratio; units?: number })
  // A share-for-share stock dividend: shares received with no cash paid. Basis spreads over old and new shares.
  | (Base & { kind: 'stock-dividend'; ratio?: Ratio; units?: number })
  // The position in `symbol` becomes `inUnits` of `newSymbol` (same account). `outUnits` must equal what the ledger
  // holds, else the action is unpriceable.
  | (Base & { kind: 'symbol-change'; newSymbol: string; outUnits: number; inUnits: number })
  // Anything that cannot be priced exactly. `units` > 0: shares received with no known basis (a spin-off's new shares);
  // < 0: shares removed. scope 'account' taints every open lot in the account (a spin-off whose parent is not named).
  | (Base & { kind: 'unpriceable'; reason: 'spin-off' | 'unknown'; units?: number; scope?: 'pair' | 'account' });

export const RATIO_TOLERANCE = 1e-6;
// A sell this soon before a repricing action may have traded at post-action prices against unadjusted lots (brokers
// often post the action row days after the effective date): it is excluded and counted.
export const LATE_POSTING_DAYS = 14;

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

// The ratios a split may resolve to: n:1 and 1:n up to 100, and anything with both sides up to 10 (3:2, 5:4, 2:3...).
// A stock dividend may be any (q + k):q with q up to 100 (5% is 21:20).
export function candidateRatios(kind: 'split' | 'stock-dividend'): Ratio[] {
  const out: Ratio[] = [];
  const add = (p: number, q: number) => { if (p !== q && gcd(p, q) === 1) out.push({ p, q }); };
  if (kind === 'split') {
    for (let n = 2; n <= 100; n++) { add(n, 1); add(1, n); }
    for (let p = 2; p <= 10; p++) for (let q = 2; q <= 10; q++) add(p, q);
  } else {
    for (let q = 1; q <= 100; q++) for (let p = q + 1; p <= 2 * q; p++) add(p, q);
  }
  return out;
}
const CANDIDATES = { split: candidateRatios('split'), 'stock-dividend': candidateRatios('stock-dividend') };

// "2 FOR 1", "1-for-10", "3:2" in a vendor description. Null when absent or not a ratio of positive integers.
export function parseRatio(description: string | null | undefined): Ratio | null {
  const m = description?.match(/(\d+)\s*(?:-\s*for\s*-|\s+for\s+|:)\s*(\d+)/i);
  if (!m) return null;
  const p = Number(m[1]), q = Number(m[2]);
  if (!(p > 0 && q > 0) || p === q) return null;
  const g = gcd(p, q);
  return { p: p / g, q: q / g };
}

// How a ratio fits the ledger: the post-action shares the vendor reports (`after`) must equal held × p/q exactly, or
// fall short of it by a cash-in-lieu leftover of less than one share (never more shares than the ratio gives).
function fit(held: number, after: number, r: Ratio): number | null {
  const expected = (held * r.p) / r.q;
  const leftover = expected - after;
  const tol = RATIO_TOLERANCE * Math.max(1, expected);
  if (Math.abs(leftover) <= tol) return 0;
  return leftover > 0 && leftover < 1 ? leftover : null;
}

// Resolves a split or stock dividend against the shares the ledger holds. Exactly one ratio must fit across both
// readings of the vendor's units (change in shares, new total), or the given ratio must fit them; otherwise null
// (unpriceable, counted). `leftover` is the cash-in-lieu fraction, in post-action shares.
export function resolveRatio(held: number, a: { kind: 'split' | 'stock-dividend'; ratio?: Ratio; units?: number }): { ratio: Ratio; leftover: number } | null {
  if (!(held > 0)) return null;
  if (a.units === undefined) return a.ratio ? { ratio: a.ratio, leftover: 0 } : null;
  if (!Number.isFinite(a.units)) return null;
  const readings = [held + a.units];
  if (a.kind === 'split' && a.units > 0) readings.push(a.units); // a stock dividend's units are always the new shares
  const fits: { ratio: Ratio; leftover: number }[] = [];
  for (const after of readings) {
    if (!(after >= 0)) continue;
    for (const r of a.ratio ? [a.ratio] : CANDIDATES[a.kind]) {
      const leftover = fit(held, after, r);
      if (leftover !== null) fits.push({ ratio: r, leftover });
    }
  }
  // Prefer exact fits: a leftover reading only counts when nothing fits exactly.
  const exact = fits.filter((f) => f.leftover === 0);
  const pool = exact.length ? exact : fits;
  const values = new Set(pool.map((f) => f.ratio.p / f.ratio.q));
  if (values.size !== 1) return null;
  // Same ratio from both readings with different leftovers: ambiguous, unless one is exact (handled above).
  const leftovers = new Set(pool.map((f) => f.leftover));
  return leftovers.size === 1 ? pool[0] : null;
}

// A rename's share exchange must be 1:1 or a clean ratio, with no leftover (cash paid with an exchange is unpriceable).
export function renameRatio(outUnits: number, inUnits: number): Ratio | null {
  if (!(outUnits > 0 && inUnits > 0)) return null;
  if (Math.abs(inUnits - outUnits) <= RATIO_TOLERANCE * outUnits) return { p: 1, q: 1 };
  const r = resolveRatio(outUnits, { kind: 'split', units: inUnits - outUnits });
  return r && r.leftover === 0 ? r.ratio : null;
}

// ---- Vendor rows → actions (what lib/broker.ts would call; see the ponytail above) ----

// The raw vendor activity row (the integrated vendor's activity fields this module reads).
export type VendorRow = {
  id?: string; type?: string; trade_date?: string | null; units?: number | null; price?: number | null; fee?: number | null;
  description?: string | null; symbol?: { symbol?: string } | null; option_symbol?: unknown;
};

const SPIN = /spin[\s-]?off/i;
// Vendor types that can move shares without a trade. BUY and SELL stay with lib/broker.ts.
const SHARE_TYPES = new Set(['SPLIT', 'STOCK_DIVIDEND', 'REI', 'ADJUSTMENT', 'TRANSFER', 'EXTERNAL_ASSET_TRANSFER_IN', 'EXTERNAL_ASSET_TRANSFER_OUT']);

// REI (dividend reinvestment) is a purchase: with units and a price it becomes a BUY activity, otherwise unpriceable.
// A symbol change is accepted only as an explicit pair: shares out of one symbol and into another, same account, same
// trade date, one row each. Anything else that moves shares on a symbol is unpriceable (counted when a sell draws it).
export function fromVendorRows(accountId: string, rows: VendorRow[]): { activities: (Activity & { raw: unknown })[]; actions: (CorporateAction & { raw: unknown })[] } {
  const activities: (Activity & { raw: unknown })[] = [];
  const actions: (CorporateAction & { raw: unknown })[] = [];
  const moves: { row: VendorRow; symbol: string; at: Date; units: number }[] = [];
  for (const row of rows) {
    const symbol = row.symbol?.symbol;
    if (!row.id || !symbol || row.option_symbol || !row.trade_date || !row.type || !SHARE_TYPES.has(row.type)) continue;
    const at = new Date(row.trade_date);
    if (Number.isNaN(at.getTime())) continue;
    const units = Number(row.units ?? NaN);
    const base = { externalId: row.id, accountId, symbol, executedAt: at, raw: row };
    if (SPIN.test(row.description ?? '')) {
      actions.push({ ...base, kind: 'unpriceable', reason: 'spin-off', scope: 'account', ...(Number.isFinite(units) ? { units } : {}) });
    } else if (row.type === 'SPLIT') {
      const ratio = parseRatio(row.description);
      actions.push({ ...base, kind: 'split', ...(ratio ? { ratio } : {}), ...(Number.isFinite(units) ? { units } : {}) });
    } else if (row.type === 'STOCK_DIVIDEND') {
      actions.push(Number.isFinite(units) && units > 0 ? { ...base, kind: 'stock-dividend', units } : { ...base, kind: 'unpriceable', reason: 'unknown' });
    } else if (row.type === 'REI') {
      const price = Number(row.price ?? NaN);
      if (units > 0 && price > 0) {
        activities.push({ externalId: row.id, accountId, symbol, side: 'BUY', units, price, fee: Math.abs(row.fee ?? 0), executedAt: at, verified: true, raw: row });
      } else actions.push({ ...base, kind: 'unpriceable', reason: 'unknown' });
    } else if (Number.isFinite(units) && units !== 0) {
      moves.push({ row, symbol, at, units });
    }
  }
  // Pair moves: same trade date, exactly one out and one in on different symbols.
  const byDay = new Map<string, typeof moves>();
  for (const m of moves) { const k = m.at.toISOString().slice(0, 10); const g = byDay.get(k); if (g) g.push(m); else byDay.set(k, [m]); }
  for (const group of byDay.values()) {
    const out = group.filter((m) => m.units < 0), into = group.filter((m) => m.units > 0);
    if (group.length === 2 && out.length === 1 && into.length === 1 && out[0].symbol !== into[0].symbol) {
      const o = out[0], i = into[0];
      actions.push({ externalId: o.row.id!, accountId, symbol: o.symbol, executedAt: o.at, kind: 'symbol-change', newSymbol: i.symbol, outUnits: -o.units, inUnits: i.units, raw: { out: o.row, in: i.row } });
      continue;
    }
    for (const m of group) actions.push({ externalId: m.row.id!, accountId, symbol: m.symbol, executedAt: m.at, kind: 'unpriceable', reason: 'unknown', units: m.units, raw: m.row });
  }
  return { activities, actions };
}

// ---- Rebuild support: renames link (account, symbol) pairs into one chain matched together ----

export const pairKey = (accountId: string, symbol: string) => `${accountId}|${symbol}`;

// Each pair linked by a symbol change maps to its chain id (the smallest key in the chain); unlinked pairs are absent.
export function chainsOf(actions: CorporateAction[]): Map<string, string> {
  const parent = new Map<string, string>();
  const find = (k: string): string => { const p = parent.get(k) ?? k; if (p === k) return k; const r = find(p); parent.set(k, r); return r; };
  for (const a of actions) {
    if (a.kind !== 'symbol-change') continue;
    const x = find(pairKey(a.accountId, a.symbol)), y = find(pairKey(a.accountId, a.newSymbol));
    parent.set(x, x); parent.set(y, y);
    if (x !== y) parent.set(x < y ? y : x, x < y ? x : y);
  }
  const out = new Map<string, string>();
  for (const k of parent.keys()) out.set(k, find(k));
  return out;
}

// The actions a pair (or a chain of pairs) needs: its own, plus account-wide ones in the same account.
export function actionsFor(actions: CorporateAction[], keys: Set<string>): CorporateAction[] {
  const accounts = new Set([...keys].map((k) => k.slice(0, k.lastIndexOf('|'))));
  return actions.filter((a) => keys.has(pairKey(a.accountId, a.symbol))
    || (a.kind === 'symbol-change' && keys.has(pairKey(a.accountId, a.newSymbol)))
    || (a.kind === 'unpriceable' && a.scope === 'account' && accounts.has(a.accountId)));
}

// ---- Storage (append-only, like activities): the caller passes its connection or transaction ----

type Db = Sql | TransactionSql;
type Row = { external_id: string; account_id: string; symbol: string; kind: CorporateAction['kind']; detail: Record<string, unknown>; executed_at: Date };

// The action's own fields (ratio, units, newSymbol, reason, scope), stored in `detail`.
function detailOf(a: CorporateAction & { raw?: unknown }): Record<string, unknown> {
  const rest: Record<string, unknown> = { ...a };
  for (const k of ['externalId', 'accountId', 'symbol', 'executedAt', 'kind', 'raw']) delete rest[k];
  return rest;
}

// Idempotent like insertActivities: a row already stored (same source and vendor id) is left as it was.
// ponytail: not called by the sync yet; the owner's broker.ts change wires it in (see the header).
export async function insertCorporateActions(db: Db, userId: number, source: 'snaptrade' | 'demo', actions: (CorporateAction & { raw: unknown })[]) {
  for (let i = 0; i < actions.length; i += 1000) {
    const rows = actions.slice(i, i + 1000).map((a) => ({
      user_id: userId, source, external_id: a.externalId, account_id: a.accountId, symbol: a.symbol, kind: a.kind,
      detail: db.json(detailOf(a) as never), executed_at: a.executedAt, raw: db.json(a.raw as never),
    }));
    await db`insert into corporate_actions ${db(rows)} on conflict (source, external_id) do nothing`;
  }
}

// The user's actions as the matcher reads them: simulated accounts' rows left out and rows dated in the future
// quarantined like activities (`notFuture` is the caller's fragment, lib/sync.ts).
export async function loadCorporateActions(db: Db, userId: number, notFuture: PendingQuery<PgRow[]>): Promise<CorporateAction[]> {
  const rows = await db<Row[]>`select external_id, account_id, symbol, kind, detail, executed_at from corporate_actions a
    where a.user_id = ${userId} and ${notFuture}
    and not exists (select 1 from broker_accounts b where b.account_id = a.account_id and b.user_id = ${userId} and b.is_paper)
    order by a.executed_at, a.external_id`;
  return rows.map((r) => ({ ...r.detail, externalId: r.external_id, accountId: r.account_id, symbol: r.symbol, executedAt: r.executed_at, kind: r.kind }) as CorporateAction);
}
