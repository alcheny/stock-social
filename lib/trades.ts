// Pure trade math. No I/O — everything shown to users is derived here from raw activities,
// so a bug is fixed by recomputing (see docs/DESIGN.md §2.5).

import { count, counted, pct } from './format.ts';
import { MIN_BETS, RANK_MIN_BETS, tooWide } from './confidence.ts';
import { LATE_POSTING_DAYS, RATIO_TOLERANCE, renameRatio, resolveRatio, type CorporateAction, type Ratio } from './corporate-actions.ts';

export type Activity = {
  externalId: string;
  accountId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  units: number;
  price: number;
  fee: number;
  executedAt: Date;
  verified: boolean;
};

export type ClosedTrade = {
  sellId: string; // externalId of the closing SELL; stable key for re-attaching theses
  accountId: string;
  symbol: string;
  openedAt: Date;
  closedAt: Date;
  returnPct: number;
  holdingDays: number;
  verified: boolean;
};

type Lot = { units: number; price: number; feePerUnit: number; at: Date; verified: boolean; tainted?: boolean; tie?: TieGroup };
// C4-1: tied buys that differ (one group per pair and instant); their FIFO order among themselves is unknown.
type TieGroup = { sameAt: boolean; broken: boolean };

const EPS = 1e-9;
const DAY = 86_400_000;
// C4-1: the UTC span of a trading date in any time zone (UTC+14 to UTC-12), around its UTC midnight.
const DATE_BEFORE = 14 * 3_600_000, DATE_AFTER = 36 * 3_600_000;
// Unit comparisons are relative to the size involved, so positions grown by splits compare like small ones.
const tiny = (x: number, scale: number) => x <= EPS * Math.max(1, Math.abs(scale));

export type MatchResult = { trades: ClosedTrade[]; excluded: number; excludedCorporate: number };
export type OpenLot = Readonly<Lot> & { accountId: string; symbol: string };

// FIFO, long only. One closed trade per SELL, or one count: every SELL is a shown trade, `excluded` or
// `excludedCorporate`, never dropped silently.
// - `excluded` (no recorded entry): a sell needing more units than the ledger holds, excluded whole (its matched part
//   is not shown either): the history is missing an inflow (a buy before the imported history, a transfer in, an
//   unrecorded split), so its basis is unknown (POLICY F3c). Sells shown earlier were priced from recorded lots and stay
//   (TR-1, orchestrator decision 2026-11-01). The oversell empties the ledger.
// - The gap (fixes cycle 4, C4-2; committee docs/features/logs/fixes-cycle4/committee-2026-11-01.md): the k units an
//   oversell lacked are earlier history (later buys are ordinary lots), a short sale (the first k units bought later
//   cover it), or any mix. Every reading then holds the history reading's FIFO queue shifted by an offset in [0, G], for
//   good: the pair keeps a gap G (oversells, unusable sells and unpriceable removals beyond the ledger add to it; splits
//   with a known ratio scale it; renames move it; a ratio read from held units, or an unpriceable action, while G > 0
//   makes the ledger unknown). While G > 0 a sell of c units is shown only when the oldest c + G units sit in lots alike
//   in price, fee, date, trust and taint (so every offset draws the same figure); otherwise it is counted in `excluded`.
//   Never cleared from the rows alone.
//   ponytail: a gap never clears, so one transfer in or pre-history sale can count every later sell of that stock in that
//   account — fix: clear it when a vendor position read with units matches the history reading (lib/broker.ts is
//   protected, and storing units is a privacy call: owner item).
// - `excludedCorporate`: a sell drawing a unit an unpriceable corporate action touched (an oversell included), one
//   dated within LATE_POSTING_DAYS before a repricing action on its pair, or one on the same day as such an action
//   (the vendor may date the row on another day of the event than the trade's prices assume: lib/corporate-actions.ts).
// - Unusable trade rows (fixes cycle 3, F3-1): a vendor BUY/SELL with no usable price, units or date, never dropped. A
//   sell with units and a date consumes its units from the oldest lots and is counted in `excludedCorporate`; a buy with
//   units and a date opens a lot with no basis (a sell drawing it is counted). With no usable units or date, the pair's
//   ledger is unknown from that row on (from the start when undated): its lots and every later lot of the pair are
//   tainted, and a sell is counted. They are not repricing actions (no late-posting window, no same-day rule).
// - Same instant (F3-5, amended by fixes cycle 4, C4-1): symbol changes, then other corporate actions, then sells, then
//   buys. Rows the stamps can't order are tied (exact ties, and date-only rows within their trading date: see `runOf`).
//   A tied sell draws only older lots; when they cover it, FIFO gives the same result in every order (F3-5's case kept);
//   when they don't, it oversells (counted, gap), so a date-only same-day round trip with nothing older held is counted:
//   the rows can't tell it from a short and its cover. Tied sells are shown only when alike older lots cover them all;
//   tied buys that differ are drawn only whole (else counted). Callers whose input order is the true order (public
//   filings) pass `orderKnown`. A sell is never matched to a buy dated after it.
// - Shares an action names that the ledger lacks (C4-1, engineer): a rename's units arrive in the new symbol, a split's
//   vendor count in the pair, as a lot with no basis at the front of FIFO (a sell drawing it is counted).
// Corporate actions (lib/corporate-actions.ts) adjust the lots: a split or stock dividend multiplies units by p/q and
// divides price and fee per unit by it (total cost and fees conserved, holding period from the original buy); a symbol
// change moves the lots, FIFO order kept by date; an unpriceable action taints them. At the same instant, actions apply
// before trades (trade dates are often day-only and an action is dated on its effective day).
// Bumped when a change to the matcher can change a published figure: a deploy then rebuilds every record once
// (lib/matcher-rebuild.ts). 2: fixes cycle 4 (C4-1 ties, C4-2 the gap).
export const MATCHER_VERSION = 2;

// `orderKnown` (reliability, round 2): the caller's input order is the true order of every row, as for public filings
// (lib/public-trades.ts orders rows by filing position and prices only what its own queue can), so ties keep that order:
// buys before sells at one instant (F3-5) and no tie groups. Broker rows never pass it.
export type MatchOptions = { orderKnown?: boolean };
export function matchTrades(activities: Activity[], actions: CorporateAction[] = [], opts: MatchOptions = {}): MatchResult {
  return replay(activities, actions, opts).result;
}

// The lots still open after the history (test and property-check helper; the matcher's own state).
export function openLots(activities: Activity[], actions: CorporateAction[] = []): OpenLot[] {
  const out: OpenLot[] = [];
  for (const [key, book] of replay(activities, actions).books) {
    const [accountId, symbol] = [key.slice(0, key.lastIndexOf('|')), key.slice(key.lastIndexOf('|') + 1)];
    for (const l of book.lots) out.push({ ...l, accountId, symbol });
  }
  return out;
}

type Book = { lots: Lot[]; gap?: number };
type Event = { at: number; order: number; src: number; i: number; act?: Activity; ca?: CorporateAction };
type TradeRow = Extract<CorporateAction, { reason: 'trade' }>;
const isTradeRow = (ca: CorporateAction): ca is TradeRow => ca.kind === 'unpriceable' && ca.reason === 'trade';

function replay(activities: Activity[], actions: CorporateAction[], opts: MatchOptions = {}): { result: MatchResult; books: Map<string, Book> } {
  // Same-instant order (F3-5, C4-1): renames, other actions, sells, buys; then actions before activities, then input order.
  const sideOrder = (side: 'BUY' | 'SELL') => (side === 'SELL' ? (opts.orderKnown ? 3 : 2) : opts.orderKnown ? 2 : 3);
  // C4-1: a date-only stamp (exactly 00:00:00.000Z) names a trading date, which runs from 14 h before to 36 h after that
  // UTC midnight in some time zone. Two rows of a pair whose order that can't settle are tied: the same exact stamp; two
  // date-only stamps on the same date; a date-only stamp and an intraday one within its date's window (business lead,
  // round 2). Ties chain into runs in time order. In a run with a date-only row, the date-only sells are ordered at the
  // run's start (each draws only older lots) and the date-only buys at its end (their own dates still open the lots);
  // intraday rows keep the clock (engineer, round 2). The run's sells are decided together and its buys are one tie group
  // (tieKey below), so whatever depends on where a date-only row really sat is counted.
  // ponytail: a date-only value not stamped 00:00:00Z (a broker-local midnight) is read as intraday — fix: per-broker
  // date-only flags once the vendor names the brokerages (vendor question list, MRC2-10).
  const sortAt = new Map<object, number>();
  const runOf = new Map<object, string>();
  if (!opts.orderKnown) {
    const byPair = new Map<string, { t: number; r: Activity | TradeRow }[]>();
    const add = (r: Activity | TradeRow) => { const k = `${r.accountId}|${r.symbol}`, l = byPair.get(k), x = { t: r.executedAt.getTime(), r }; if (l) l.push(x); else byPair.set(k, [x]); };
    for (const act of activities) add(act);
    for (const ca of actions) if (isTradeRow(ca) && !ca.undated) add(ca);
    const dateOnly = (t: number) => t % DAY === 0;
    const tied = (x: number, y: number) => x === y || (dateOnly(x) && dateOnly(y) ? false
      : dateOnly(x) ? y >= x - DATE_BEFORE && y < x + DATE_AFTER : dateOnly(y) ? x >= y - DATE_BEFORE && x < y + DATE_AFTER : false);
    let runs = 0;
    for (const rows of byPair.values()) {
      rows.sort((p, q) => p.t - q.t);
      let run: typeof rows = [];
      const close = () => {
        if (run.length > 1 && run.some((x) => dateOnly(x.t))) {
          const lo = run[0].t, hi = run[run.length - 1].t, id = `run${runs++}`;
          for (const x of run) {
            runOf.set(x.r, id);
            if (dateOnly(x.t)) sortAt.set(x.r, x.r.side === 'SELL' ? lo : hi);
          }
        }
        run = [];
      };
      for (const x of rows) {
        if (run.length && !run.some((m) => tied(m.t, x.t)) && x.t > run[run.length - 1].t) close();
        run.push(x);
      }
      close();
    }
  }
  const at = (r: Activity | TradeRow) => sortAt.get(r) ?? r.executedAt.getTime();
  const events: Event[] = [
    ...actions.map((ca, i) => ({ at: isTradeRow(ca) && !ca.undated ? at(ca) : ca.executedAt.getTime(), order: ca.kind === 'symbol-change' ? 0 : isTradeRow(ca) ? sideOrder(ca.side) : 1, src: 0, i, ca })),
    ...activities.map((act, i) => ({ at: at(act), order: sideOrder(act.side), src: 1, i, act })),
  ].sort((a, b) => a.at - b.at || a.order - b.order || a.src - b.src || a.i - b.i);
  // C4-1 (engineer, round 1): rows of one pair and one side at one (sort) instant tie, so their order is unknown. Tied
  // sells are decided together (shown only when every order draws the same buy for each); tied buys that differ in
  // price, fee, date or trust share a TieGroup: a sell that takes every unit left of the group, from a group whose lots
  // share one date and that no sell has split before, gets the same figure in every order (split fills of one order:
  // UX lead, round 2); any other draw from it is counted, and a split group stays broken.
  const tieKey = (e: Event) => {
    const r = e.act ?? (e.ca && isTradeRow(e.ca) && !e.ca.undated ? e.ca : null);
    if (!r || opts.orderKnown) return null;
    const side = e.act ? e.act.side : (r as TradeRow).side;
    return `${runOf.get(r) ?? e.at}|${r.accountId}|${r.symbol}|${side}`;
  };
  const sellTies = new Map<string, { total: number; size: number; safe?: boolean; tainted?: boolean }>();
  const buyTies = new Map<string, { first: Event; size: number; alike: boolean; group?: TieGroup }>();
  for (const e of events) {
    const k = tieKey(e);
    if (!k) continue;
    const side = e.act ? e.act.side : (e.ca as TradeRow).side;
    if (side === 'SELL') {
      const units = e.act ? e.act.units : (e.ca as TradeRow).units ?? 0;
      const g = sellTies.get(k);
      if (g) { g.total += units; g.size++; } else sellTies.set(k, { total: units, size: 1 });
    } else {
      const g = buyTies.get(k);
      if (!g) { buyTies.set(k, { first: e, size: 1, alike: true, group: { sameAt: true, broken: false } }); continue; }
      g.size++;
      const x = g.first.act, y = e.act;
      if ((g.first.act ?? g.first.ca)!.executedAt.getTime() !== (e.act ?? e.ca)!.executedAt.getTime()) g.group!.sameAt = false;
      if (!x || !y || x.price !== y.price || x.fee / x.units !== y.fee / y.units || x.executedAt.getTime() !== y.executedAt.getTime() || x.verified !== y.verified) g.alike = false;
    }
  }
  const tieOf = (e: Event): { tie: TieGroup } | object => {
    const g = buyTies.get(tieKey(e) ?? '');
    if (!g || g.size < 2 || g.alike) return {};
    return { tie: g.group! };
  };
  const books = new Map<string, Book>();
  const book = (key: string) => { let b = books.get(key); if (!b) books.set(key, (b = { lots: [] })); return b; };
  // C4-2: units in the oldest lots alike in everything a figure reads (price, fee, date, trust), so every reading of the
  // gap that draws within them gives the same figure.
  const alikeUnits = (lots: Lot[]) => {
    if (!lots.length || lots[0].tie) return 0;
    const l0 = lots[0];
    let u = 0;
    for (const l of lots) {
      if (l.tie || l.price !== l0.price || l.feePerUnit !== l0.feePerUnit || l.at.getTime() !== l0.at.getTime() || l.verified !== l0.verified || !!l.tainted !== !!l0.tainted) break;
      u += l.units;
    }
    return u;
  };
  const trades: ClosedTrade[] = [];
  let excluded = 0, excludedCorporate = 0;

  // Repricing actions, for the late-posting window (a rename at 1:1 reprices nothing): their times per pair and, for
  // account-wide ones, per account, sorted once; each sell looks up the first time after it.
  const times = new Map<string, number[]>();
  for (const ca of actions) {
    if (isTradeRow(ca)) continue; // an unusable trade row reprices nothing (F3-1)
    if (ca.kind === 'symbol-change' && Math.abs(ca.inUnits - ca.outUnits) <= RATIO_TOLERANCE * ca.outUnits) continue;
    const k = ca.kind === 'unpriceable' && ca.scope === 'account' ? `${ca.accountId}|` : `${ca.accountId}|${ca.symbol}`;
    const list = times.get(k);
    if (list) list.push(ca.executedAt.getTime()); else times.set(k, [ca.executedAt.getTime()]);
  }
  for (const list of times.values()) list.sort((x, y) => x - y);
  const nextAfter = (list: number[] | undefined, t: number) => {
    if (!list) return Infinity;
    let lo = 0, hi = list.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (list[mid] <= t) lo = mid + 1; else hi = mid; }
    return lo < list.length ? list[lo] : Infinity;
  };
  // Same UTC day as a repricing action on the pair (or an account-wide one): the order within that day is unknown.
  const days = new Map<string, Set<number>>();
  for (const [k, list] of times) days.set(k, new Set(list.map((t) => Math.floor(t / DAY))));
  const sameDayAction = (a: Activity) => {
    const d = Math.floor(a.executedAt.getTime() / DAY);
    return !!(days.get(`${a.accountId}|${a.symbol}`)?.has(d) || days.get(`${a.accountId}|`)?.has(d));
  };
  const latePosted = (a: Activity) => {
    const t = a.executedAt.getTime();
    const next = Math.min(nextAfter(times.get(`${a.accountId}|${a.symbol}`), t), nextAfter(times.get(`${a.accountId}|`), t));
    return next - t <= LATE_POSTING_DAYS * DAY;
  };
  // In-window checks (tester round 1, reviewer round 2): a lot opened within LATE_POSTING_DAYS before a split may
  // already be in post-split shares (the lot's own date, so lots that arrived through a rename count too), and any
  // trade of the new symbol within that window before a rename may already hold the renamed shares. Lots touched that
  // way are tainted, never scaled or moved on a guess.
  const tradesAt = new Map<string, number[]>();
  for (const a of activities) {
    const k = `${a.accountId}|${a.symbol}`, list = tradesAt.get(k);
    if (list) list.push(a.executedAt.getTime()); else tradesAt.set(k, [a.executedAt.getTime()]);
  }
  for (const list of tradesAt.values()) list.sort((x, y) => x - y);
  const inWindowBefore = (list: number[] | undefined, at: number) => nextAfter(list, at - LATE_POSTING_DAYS * DAY - 1) < at;
  const openedInWindow = (lots: Lot[], at: number) => lots.some((l) => l.at.getTime() >= at - LATE_POSTING_DAYS * DAY && l.at.getTime() < at);
  // Pairs a rename emptied, by instant: an action on the old pair at that same instant is ambiguous (before or after the
  // rename?), so it taints the lots where the rename put them, never skips them.
  const movedTo = new Map<string, { at: number; to: string }>();
  // Pairs a rename with a share exchange filled, by instant: a split on that pair at the same instant may be the same
  // event reported twice (tester round 2), so it taints instead of scaling again.
  const exchangedInto = new Map<string, number>();
  // Pairs whose ledger an unusable trade row with no units or date made unknown (F3-1): every later lot is tainted.
  // ponytail: the mark never clears, so a ticker the exchange later recycles for another company is counted, never shown,
  // in that account for good (over-counts, never publishes a wrong figure) — fix: clear it at a vendor-confirmed zero
  // position (the positions read) for the pair.
  const unknownFrom = new Set<string>();
  const held = (lots: Lot[]) => lots.reduce((s, l) => s + l.units, 0);
  const taint = (lots: Lot[]) => { for (const l of lots) l.tainted = true; };
  // Removes `units` from the oldest lots (a cash-in-lieu fraction, shares removed by an unpriceable action).
  const removeOldest = (lots: Lot[], units: number) => {
    let left = units;
    while (!tiny(left, units) && lots.length) {
      const take = Math.min(lots[0].units, left);
      lots[0].units -= take; left -= take;
      if (tiny(lots[0].units, take)) lots.shift();
    }
    return tiny(left, units) ? 0 : left;
  };
  const addGap = (b: Book, units: number) => { if (units > 0) b.gap = (b.gap ?? 0) + units; };
  const scale = (lots: Lot[], r: Ratio) => { for (const l of lots) { l.units = (l.units * r.p) / r.q; l.price = (l.price * r.q) / r.p; l.feePerUnit = (l.feePerUnit * r.q) / r.p; } };

  for (const e of events) {
    const ca = e.ca;
    if (ca) {
      const key = `${ca.accountId}|${ca.symbol}`;
      const b = book(key);
      const moved = movedTo.get(key);
      if (isTradeRow(ca)) {
        // F3-1: an unusable vendor trade row (see the header). Counted when it is a sell, never priced.
        if (ca.side === 'SELL') excludedCorporate++;
        if (ca.units !== undefined && !ca.undated) {
          if (ca.side === 'SELL') addGap(b, removeOldest(b.lots, ca.units)); // C4-2: an unusable oversell leaves a gap too
          else b.lots.push({ units: ca.units, price: 0, feePerUnit: 0, at: ca.executedAt, verified: false, tainted: true, ...tieOf(e) });
        } else {
          taint(b.lots);
          unknownFrom.add(key);
        }
        continue;
      }
      if (!b.lots.length && moved?.at === e.at && ca.kind !== 'symbol-change') { taint(book(moved.to).lots); }
      if (ca.kind === 'split' || ca.kind === 'stock-dividend') {
        // C4-2: a gap in shares must split with them; when the ratio can't be known, the pair's ledger is unknown from here.
        const gapUnknown = () => { if (b.gap) { unknownFrom.add(key); taint(b.lots); } };
        if (exchangedInto.get(key) === e.at) { taint(b.lots); gapUnknown(); continue; }
        if (!b.lots.length) {
          if (b.gap) { if (ca.ratio) b.gap = (b.gap * ca.ratio.p) / ca.ratio.q; else gapUnknown(); }
          // C4-1 (engineer, round 1): a vendor share count says shares exist that the ledger lacks (earlier history). FIFO
          // would draw them before any later buy, so they are a lot with no basis (a total or a change: at least the shares
          // received). A ratio alone says nothing about a count, so nothing is added (as before).
          if (ca.units !== undefined && ca.units > 0) b.lots.push({ units: ca.units, price: 0, feePerUnit: 0, at: ca.executedAt, verified: false, tainted: true });
          continue;
        }
        // C4-2: a ratio read from the ledger's units is not knowable while a gap leaves the units held unknown.
        if (b.gap && !ca.ratio) { taint(b.lots); gapUnknown(); continue; }
        const r = resolveRatio(held(b.lots), ca);
        if (!r) { taint(b.lots); gapUnknown(); continue; }
        scale(b.lots, r.ratio);
        if (b.gap) b.gap = (b.gap * r.ratio.p) / r.ratio.q; // C4-2: the gap is in shares, so it splits with them
        if (r.leftover > 0) removeOldest(b.lots, r.leftover); // cash in lieu: not a trade, not counted
        if (openedInWindow(b.lots, e.at)) taint(b.lots);
      } else if (ca.kind === 'symbol-change') {
        // F3-1: an unknown ledger stays unknown under its new symbol, whether or not lots move (a unit-less or undated buy
        // leaves none; a share count that doesn't match leaves them behind, tainted).
        if (unknownFrom.has(key) && ca.newSymbol !== ca.symbol) {
          const unknownTo = `${ca.accountId}|${ca.newSymbol}`;
          unknownFrom.add(unknownTo);
          taint(book(unknownTo).lots);
        }
        // C4-2: a short renames with the shares, so the gap moves to the new symbol (scaled by the exchange ratio).
        if (b.gap && ca.newSymbol !== ca.symbol) {
          const gr = renameRatio(ca.outUnits, ca.inUnits), toKey = `${ca.accountId}|${ca.newSymbol}`;
          if (gr) addGap(book(toKey), (b.gap * gr.p) / gr.q); else { unknownFrom.add(toKey); taint(book(toKey).lots); }
          b.gap = 0;
        }
        // C4-1 (engineer, round 1): shares the rename says moved but the ledger doesn't hold arrive in the new symbol with
        // no basis, so FIFO draws them (counted) before any later buy there.
        const shadow = () => { if (ca.newSymbol !== ca.symbol && ca.inUnits > 0) book(`${ca.accountId}|${ca.newSymbol}`).lots.unshift({ units: ca.inUnits, price: 0, feePerUnit: 0, at: ca.executedAt, verified: false, tainted: true }); };
        if (!b.lots.length) { shadow(); continue; }
        const h = held(b.lots);
        const r = ca.newSymbol !== ca.symbol && Math.abs(h - ca.outUnits) <= RATIO_TOLERANCE * Math.max(1, h) ? renameRatio(ca.outUnits, ca.inUnits) : null;
        if (!r) { taint(b.lots); shadow(); continue; }
        scale(b.lots, r);
        const toKey = `${ca.accountId}|${ca.newSymbol}`;
        if (inWindowBefore(tradesAt.get(toKey), e.at) || (r.p !== r.q && openedInWindow(b.lots, e.at))) taint(b.lots);
        const to = book(toKey);
        to.lots = [...to.lots, ...b.lots].sort((x, y) => x.at.getTime() - y.at.getTime());
        if (unknownFrom.has(toKey)) taint(to.lots); // F3-1: lots moved into a pair whose ledger is unknown
        books.set(key, { lots: [] }); // a recycled ticker starts fresh lots
        movedTo.set(key, { at: e.at, to: `${ca.accountId}|${ca.newSymbol}` });
        if (r.p !== r.q) exchangedInto.set(toKey, e.at);
      } else {
        // C4-2: shares an unpriceable action moves in a pair with a gap may be on either side of the gap, so the pair's
        // ledger is unknown from here.
        const touch = (k: string, other: Book) => { taint(other.lots); if (other.gap) unknownFrom.add(k); };
        if (ca.scope === 'account') {
          for (const [k, other] of books) if (k.startsWith(`${ca.accountId}|`)) touch(k, other);
        } else touch(key, b);
        const u = ca.units ?? 0;
        if (u > 0) b.lots.push({ units: u, price: 0, feePerUnit: 0, at: ca.executedAt, verified: false, tainted: true });
        else if (u < 0) addGap(b, removeOldest(b.lots, -u));
      }
      continue;
    }

    const a = e.act!;
    const key = `${a.accountId}|${a.symbol}`;
    const b = book(key);
    const open = b.lots;
    if (a.side === 'BUY') {
      // A buy on the day of a repricing action may be at either side of it: tainted, never scaled or left on a guess.
      open.push({ units: a.units, price: a.price, feePerUnit: a.fee / a.units, at: a.executedAt, verified: a.verified, ...(sameDayAction(a) || unknownFrom.has(key) ? { tainted: true } : {}), ...tieOf(e) });
      continue;
    }

    // C4-1, C4-2: with a gap or tied sells, every reading must draw the same buy (see the header). Tied sells are decided
    // once, before the first of them draws.
    const tie = sellTies.get(tieKey(e) ?? '') ?? { total: a.units, size: 1 };
    const gap = b.gap && !tiny(b.gap, a.units) ? b.gap : 0;
    const fits = (need: number) => alikeUnits(open) + EPS * Math.max(1, need) >= need;
    if (tie.size > 1 && tie.safe === undefined) {
      tie.safe = fits(tie.total + gap);
      // The group's count bucket is decided once too (property test): which tied sell draws a tainted unit depends on
      // their order, so if any could, all of them count as the action's.
      let u = 0;
      tie.tainted = unknownFrom.has(key);
      for (const l of open) { if (u >= tie.total) break; tie.tainted ||= !!l.tainted; u += l.units; }
    }
    const orderSafe = tie.size > 1 ? tie.safe! : !gap || fits(a.units + gap);
    let remaining = a.units;
    let cost = 0;
    let entryFees = 0;
    let openedAt: Date | null = null;
    let verified = a.verified;
    let tainted = false;
    const touched = new Set<TieGroup>();
    while (!tiny(remaining, a.units) && open.length) {
      const lot = open[0];
      const take = Math.min(lot.units, remaining);
      cost += take * lot.price;
      entryFees += take * lot.feePerUnit;
      openedAt ??= lot.at;
      verified &&= lot.verified;
      tainted ||= !!lot.tainted;
      if (lot.tie) touched.add(lot.tie);
      lot.units -= take;
      remaining -= take;
      if (tiny(lot.units, a.units)) open.shift();
    }

    // C4-1: a draw from tied buys is order-proof only when it takes the whole group (see tieOf).
    let ambiguous = false;
    for (const g of touched) {
      const left = open.some((l) => l.tie === g && !tiny(l.units, a.units));
      if (g.broken || !g.sameAt || left) ambiguous = true;
      if (left) g.broken = true;
    }
    if (!tiny(remaining, a.units)) {
      // Oversold: this sell only. Drawing a unit a corporate action left unpriced makes it a corporate exclusion.
      // An oversell in a pair whose ledger an unusable trade row made unknown (F3-1) is that cause, not missing history.
      if (tainted || unknownFrom.has(key) || tie.tainted) excludedCorporate++; else excluded++;
      addGap(b, remaining); // C4-2: a short or earlier history
      continue;
    }
    if (tainted || tie.tainted || latePosted(a) || sameDayAction(a)) excludedCorporate++;
    else if (!orderSafe || ambiguous) excluded++; // C4-1, C4-2: the readings draw different buys
    else if (openedAt) {
      const exitFee = a.fee;
      const t: ClosedTrade = {
        sellId: a.externalId,
        accountId: a.accountId,
        symbol: a.symbol,
        openedAt,
        closedAt: a.executedAt,
        returnPct: (a.units * a.price - cost - entryFees - exitFee) / cost,
        holdingDays: (a.executedAt.getTime() - openedAt.getTime()) / DAY,
        verified,
      };
      trades.push(t);
    }
  }
  return { result: { trades, excluded, excludedCorporate }, books };
}

export type Stats = {
  trades: number;
  winRate: number;
  avgReturn: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number | null; // null when there are no losses
  medianHoldingDays: number;
  maxDrawdown: number; // of an equal-weighted per-trade equity curve, NOT account return
};

export type CurvePoint<T> = { trade: T; cumulative: number }; // cumulative: 0.1 = +10% compounded

// Compounded equal-weight series, one step per close (ties keep input order). The chart draws its 0%
// start just before the first point. stats().maxDrawdown reads this same series.
export function equityCurve<T extends { returnPct: number; closedAt: Date }>(trades: T[]): CurvePoint<T>[] {
  let equity = 1;
  return [...trades]
    .sort((a, b) => a.closedAt.getTime() - b.closedAt.getTime())
    .map((trade) => ({ trade, cumulative: (equity *= 1 + trade.returnPct) - 1 }));
}

export function maxDrawdown(curve: { cumulative: number }[]): number {
  let peak = 1, worst = 0;
  for (const { cumulative } of curve) {
    const equity = 1 + cumulative;
    peak = Math.max(peak, equity);
    worst = Math.max(worst, (peak - equity) / peak);
  }
  return worst;
}

// Y range for the chart: always contains 0% and every point, never cropped to flatter the curve.
export function curveDomain(curve: { cumulative: number }[]): { min: number; max: number } {
  const v = curve.map((p) => p.cumulative);
  return { min: Math.min(0, ...v), max: Math.max(0, ...v) };
}

// The two headline numbers (win rate, average return), in one pass. stats() reads them from here, and so does the feed
// pane (lib/pane.ts#paneSummary, F-2 PR-1 fix round 2: it needs only these two, not the sorted holds and drawdown curve),
// so the pane and the profile can never disagree.
export function headline(trades: Pick<ClosedTrade, 'returnPct'>[]): { winRate: number; avgReturn: number } {
  let wins = 0, sum = 0;
  for (const t of trades) { if (t.returnPct > 0) wins++; sum += t.returnPct; }
  return { winRate: trades.length ? wins / trades.length : 0, avgReturn: trades.length ? sum / trades.length : 0 };
}

export function stats(trades: Pick<ClosedTrade, 'returnPct' | 'holdingDays' | 'closedAt'>[]): Stats {
  const r = trades.map((t) => t.returnPct);
  const wins = r.filter((x) => x > 0);
  const losses = r.filter((x) => x <= 0);
  const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
  const avg = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);

  const holds = trades.map((t) => t.holdingDays).sort((a, b) => a - b);
  const mid = holds.length >> 1;
  const median = !holds.length ? 0 : holds.length % 2 ? holds[mid] : (holds[mid - 1] + holds[mid]) / 2;

  const lossSum = Math.abs(sum(losses));
  const { winRate, avgReturn } = headline(trades);
  return {
    trades: r.length,
    winRate,
    avgReturn,
    avgWin: avg(wins),
    avgLoss: avg(losses),
    profitFactor: lossSum ? sum(wins) / lossSum : null,
    medianHoldingDays: median,
    maxDrawdown: maxDrawdown(equityCurve(trades)),
  };
}

// pct() lives in lib/format.ts (F-19: one home); re-exported here so existing imports keep working.
export { pct };

// Chart navigation: arrow keys move the active point, clamped at the ends (no wrap, so the ends are obvious).
export const stepIndex = (i: number, delta: number, n: number) => Math.min(Math.max(i + delta, 0), n - 1);

// Scrubbing snaps to the point whose x is closest to the pointer (first wins on ties).
export function nearestIndex(xs: number[], px: number): number {
  let best = 0;
  for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - px) < Math.abs(xs[best] - px)) best = i;
  return best;
}

// Chart range tabs. A range keeps trades closed within `days` of `now` (all trades for ALL) and
// re-compounds them from 0%, so the header reads "return over this range".
export const RANGES = [
  { key: '1W', days: 7, label: 'Past week' },
  { key: '1M', days: 30, label: 'Past month' },
  { key: '3M', days: 91, label: 'Past 3 months' },
  { key: '1Y', days: 365, label: 'Past year' },
  { key: 'ALL', days: null, label: 'All time' },
] as const;
export type RangeKey = (typeof RANGES)[number]['key'];

export function rangeTrades<T extends { closedAt: Date }>(trades: T[], key: RangeKey, now: Date): T[] {
  const days = RANGES.find((r) => r.key === key)!.days;
  if (days === null) return trades;
  const from = now.getTime() - days * 86_400_000;
  return trades.filter((t) => t.closedAt.getTime() >= from);
}

// Cumulative return of the range (0 when empty). Green when it ends at or above its start.
export function rangeReturn(trades: { returnPct: number; closedAt: Date }[], key: RangeKey, now: Date): number {
  const c = equityCurve(rangeTrades(trades, key, now));
  return c.length ? c[c.length - 1].cumulative : 0;
}

// ---- TR-9: how much evidence stands behind the average return (DESIGN Stage 5.2) ----
// ponytail: the interval reads closed trades only; open positions (TR-4, stored by F-6 in open_positions) are not bets
// here yet — fix: count each open position as a provisional bet at its unrealized percent.
// ponytail: bets are clustered by symbol, so a position renamed by a corporate action (lib/corporate-actions.ts) whose
// closes straddle the rename counts as two bets (at most one extra per rename: it can move the 5-bet floor and the
// degrees of freedom) — fix: a chain key per closed trade (a closed_trades column set by the rebuild).
// Closed trades only. Open positions exist since F-6 (lib/open-split.ts shows them beside every realized figure), but
// the F-6 decision of 2026-11-01 keeps this range closed-only and says so in words. Including them at their unrealized
// return and days held so far (DESIGN TR-9 inputs; design council D-48) is its own feature: open_positions stores no
// opening date (it needs an additive opened_at, the earliest unmatched FIFO lot), and the change moves feed ranking
// (lib/feed.ts weights). docs/features/F-6-open-positions.md → Open questions.

export type ConfidenceInput = Pick<ClosedTrade, 'symbol' | 'openedAt' | 'closedAt' | 'returnPct' | 'holdingDays'>;
export type Tier = 'too-early' | 'thin' | 'moderate' | 'strong';
export type Edge = 'positive' | 'negative' | 'unclear';
export const edgeText = (e: Edge | null) => (e === 'positive' ? 'above zero' : e === 'negative' ? 'below zero' : 'unclear');

export type Interval = { low: number; mid: number; high: number };
export type Confidence = {
  n: number; k: number; spanDays: number;
  tier: Tier; edge: Edge | null;
  perTrade: Interval | null; // simple returns (0.013 = +1.3%)
  pace30: Interval | null; // per 30 days invested
  tradesPerMonth: number;
};

const T95 = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.160, 2.145, 2.131,
  2.120, 2.110, 2.101, 2.093, 2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042];
// Exact table for df 1..30. Beyond that 1.96 + 2.4/df: 2.040 at df=30 (table: 2.042), tends to 1.96.
export const tCrit95 = (df: number) => (df <= 30 ? T95[Math.max(df, 1) - 1] : 1.96 + 2.4 / df);

type Cluster = { x: number; d: number; n: number };

export function confidence(trades: ConfidenceInput[], today: Date): Confidence {
  void today; // reserved for open positions (TR-4, see above)
  const n = trades.length;
  const bySymbol = new Map<string, ConfidenceInput[]>();
  // F-2 PR-1 fix round 1 (load check): push, not copy (a copy per trade was quadratic in a symbol's trade count).
  for (const t of trades) { const g = bySymbol.get(t.symbol); if (g) g.push(t); else bySymbol.set(t.symbol, [t]); }
  // A cluster = same-symbol trades whose holds overlap (inclusive of the boundary instant): one bet.
  const clusters: Cluster[] = [];
  for (const group of bySymbol.values()) {
    group.sort((a, b) => a.openedAt.getTime() - b.openedAt.getTime());
    let maxClose = -Infinity;
    let cur: Cluster | null = null;
    for (const t of group) {
      const x = Math.log(Math.max(1 + t.returnPct, 1e-9));
      const d = Math.max(t.holdingDays, 1);
      if (cur && t.openedAt.getTime() <= maxClose) {
        cur.x += x; cur.d += d; cur.n++;
      } else {
        cur = { x, d, n: 1 };
        clusters.push(cur);
      }
      maxClose = Math.max(maxClose, t.closedAt.getTime());
    }
  }
  const k = clusters.length;
  const spanDays = n ? (Math.max(...trades.map((t) => t.closedAt.getTime())) - Math.min(...trades.map((t) => t.openedAt.getTime()))) / DAY : 0;
  const tradesPerMonth = (n / Math.max(spanDays, 30)) * 30; // display only
  // F-4: below MIN_BETS (5) independent bets there is no range; from there it is always computed (t with K − 1 df).
  const tier: Tier = k < MIN_BETS ? 'too-early' : k >= 100 && spanDays >= 365 ? 'strong' : k >= 30 && spanDays >= 90 ? 'moderate' : 'thin';
  const base = { n, k, spanDays, tradesPerMonth };
  if (tier === 'too-early') return { ...base, tier, edge: null, perTrade: null, pace30: null };

  const t = tCrit95(k - 1);
  const sumX = clusters.reduce((a, c) => a + c.x, 0);
  const sumD = clusters.reduce((a, c) => a + c.d, 0);
  const m = sumX / n;
  const seM = Math.sqrt((k / (k - 1)) * clusters.reduce((a, c) => a + (c.x - c.n * m) ** 2, 0)) / n;
  const R = sumX / sumD;
  const seR = Math.sqrt((k / (k - 1)) * clusters.reduce((a, c) => a + (c.x - R * c.d) ** 2, 0)) / sumD;
  const perTrade = { low: Math.expm1(m - t * seM), mid: Math.expm1(m), high: Math.expm1(m + t * seM) };
  const pace30 = { low: Math.expm1(30 * (R - t * seR)), mid: Math.expm1(30 * R), high: Math.expm1(30 * (R + t * seR)) };
  if (![...Object.values(perTrade), ...Object.values(pace30)].every(Number.isFinite)) {
    return { ...base, tier: 'too-early', edge: null, perTrade: null, pace30: null };
  }
  // F-4: "too early" is a model state, not a count. A per-trade range wider than ±10 points keeps its interval (it is
  // shown, widening as the sample thins) but carries no verdict and no ranking weight.
  if (tooWide(perTrade)) return { ...base, tier: 'too-early', edge: null, perTrade, pace30 };
  const edge: Edge = pace30.low > 0 ? 'positive' : pace30.high < 0 ? 'negative' : 'unclear';
  return { ...base, tier, edge, perTrade, pace30 };
}

const plural = (n: number, w: string) => counted(n, w);

// Plain text shared by the profile, the share card and page metadata. Negative edges read the same as positive.
// F-1 PR-3 fix round 4 (UX lead note 3): when trades outnumber bets, the line says why. Same-stock trades whose holds
// overlap (in any account) are one bet, so a trader who scales in and out of a held position, or holds one stock in
// several accounts, has few independent bets however many trades: "2,828 trades in 9 overlapping positions".
export function evidenceLine(c: Confidence): string {
  const grouped = c.n > c.k;
  if (c.tier === 'too-early' || !c.edge) {
    if (c.perTrade) return `Too early to tell: the range is still too wide to say much (${plural(c.k, 'bet')}${grouped ? ` from ${counted(c.n, 'trade')}` : ''})`;
    return grouped
      ? `Too early to tell: ${counted(c.n, 'trade')} in ${counted(c.k, 'overlapping position')} (${MIN_BETS} independent bets needed)`
      : `Too early to tell (${count(c.k)} of ${MIN_BETS} bets)`;
  }
  return `Past results: ${edgeText(c.edge)} · Evidence: ${c.tier} (${plural(c.k, 'bet')}${grouped ? ` from ${counted(c.n, 'trade')}` : ''}, ${plural(Math.round(c.spanDays), 'day')})`;
}

export const rangeText = (c: Confidence): string | null =>
  c.perTrade ? `(${pct(c.perTrade.low)} to ${pct(c.perTrade.high)})` : null;

// TR-7: under 30 days of history or fewer than 10 closed trades.
export function isNewRecord(trades: { openedAt: Date }[], closedCount: number, today: Date): boolean {
  if (!trades.length) return true;
  const first = Math.min(...trades.map((t) => t.openedAt.getTime()));
  return (today.getTime() - first) / DAY < 30 || closedCount < 10;
}

// Feed order: traders with a confident edge first (weight > 0), by weight × score; the rest keep score order.
// weight = log-distance of the pace interval from zero in either direction, so equal losses and gains tie.
// F-4: a too-early record (a range wider than ±10 points) never ranks ahead on its pace interval, and ranking keeps
// its pre-F-4 floor of RANK_MIN_BETS (10) bets: F-4 changes what a record shows, not the feed order.
export const evidenceWeight = (c: Confidence): number =>
  (c.pace30 && c.tier !== 'too-early' && c.k >= RANK_MIN_BETS ? Math.max(0, Math.log1p(c.pace30.low), -Math.log1p(c.pace30.high)) : 0);

export function rankTraders<T extends { weight: number; score: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if ((a.weight > 0) !== (b.weight > 0)) return a.weight > 0 ? -1 : 1;
    return b.weight * b.score - a.weight * a.score || b.score - a.score;
  });
}
