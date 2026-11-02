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
  // F-24 (council cycle 5, RT-2): a possible re-issue no read has decided yet (lib/reconcile.ts). It is passed in, never
  // dropped, so the matcher counts what it cannot price instead of pricing later sells from a ledger missing a row.
  held?: boolean;
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

type Lot = { units: number; price: number; feePerUnit: number; at: Date; verified: boolean; tainted?: boolean };

const EPS = 1e-9;
const DAY = 86_400_000;
const BEFORE_HISTORY = new Date(-8.64e15); // the earliest Date: shares the history never shows (fixes cycle 4)
// Unit comparisons are relative to the size involved, so positions grown by splits compare like small ones.
const tiny = (x: number, scale: number) => x <= EPS * Math.max(1, Math.abs(scale));

// `excludedHeld` (F-24 RT-2): sells counted because of a held possible re-issue, present only when nonzero. They have
// their own count, never `excluded` (whose public reason is "no recorded entry").
export type MatchResult = { trades: ClosedTrade[]; excluded: number; excludedCorporate: number; excludedHeld?: number };
export type OpenLot = Readonly<Lot> & { accountId: string; symbol: string };

// FIFO, long only. One closed trade per SELL, or one count: every SELL is a shown trade, `excluded` or
// `excludedCorporate`, never dropped silently.
// - `excluded` (no recorded entry): a sell needing more units than the ledger holds, excluded whole (its matched part
//   is not shown either): the history is missing an inflow (a buy before the imported history, a transfer in, an
//   unrecorded split), so its basis is unknown (POLICY F3c). Sells shown earlier were priced from recorded lots and stay
//   (TR-1, orchestrator decision 2026-11-01). The oversell empties the ledger.
// - The gap (fixes cycle 4, C4-2; committee docs/features/logs/fixes-cycle4/committee-2026-11-01.md): the units an
//   oversell lacked are earlier history (later buys are ordinary lots), a short sale (the first units bought later cover
//   it), or a mix, and the readings then draw different buys for every later sell, for good. So after an oversell
//   (an activity sell, an F3-1 unusable sell with units, or an unpriceable removal beyond the ledger) every later sell of
//   the pair is counted in `excluded`, whatever its outcome (no sale size or timing the trader picks can bring one back:
//   the red-team rule of F-30). A rename moves the mark to the new symbol (F-28). Never cleared from the rows alone.
//   ponytail: the mark never clears, so one transfer in or pre-history sale counts every later sell of that stock in that
//   account — fix: clear it when a vendor position read with units shows which reading is true (lib/broker.ts is
//   protected, and storing units is a privacy call: owner item).
// - `excludedCorporate`: a sell drawing a unit an unpriceable corporate action touched (an oversell included), one
//   dated within LATE_POSTING_DAYS before a repricing action on its pair, or one on the same day as such an action
//   (the vendor may date the row on another day of the event than the trade's prices assume: lib/corporate-actions.ts).
// - Unusable trade rows (fixes cycle 3, F3-1): a vendor BUY/SELL with no usable price, units or date, never dropped. A
//   sell with units and a date consumes its units from the oldest lots and is counted in `excludedCorporate`; a buy with
//   units and a date opens a lot with no basis (a sell drawing it is counted). With no usable units or date, the pair's
//   ledger is unknown from that row on (from the start when undated): its lots and every later lot of the pair are
//   tainted, and a sell is counted. They are not repricing actions (no late-posting window, no same-day rule).
// - Symbol-less unusable trade rows (fixes cycle 4, F4-1): a vendor BUY/SELL with an id and no symbol is an F3-1 row with
//   scope 'account' (lib/corporate-actions.ts#unusableTrade). A sell is counted in `excludedCorporate` (once: the rebuild
//   replays each pair with the account's account-wide rows and de-duplicates the count, lib/sync.ts#rebuildTrades). In a
//   long-only ledger it sold shares some pair of the account held, which one is unknown, so every pair holding lots then
//   has an unknown ledger from that row on (as a unit-less row on its own pair): its lots and later lots are tainted. A
//   buy may have opened a lot in any pair, existing or new, so the whole account's ledger is unknown from that row on.
//   An undated symbol-less row, buy or sell, may sit anywhere in the history: the whole account is unknown from the start.
//   ponytail: a symbol-less sell is read as a long close of shares held; a pair holding none then (the sell a short or
//   of shares before the history) is left as it was, like F-30's residual — fix: the vendor's symbol on every trade row
//   (vendor question list) or a positions read with units (owner item).
//   ponytail: one symbol-less buy (or undated symbol-less row) marks its whole account unknown for good, so a vendor that
//   sends such rows routinely turns that account's record into counted rows only (over-counts, never a wrong figure) —
//   fix: the vendor's answer on when a trade row has no symbol (vendor question list).
// - Held possible re-issues (F-24, council cycle 5 RT-2; POLICY F3c "count, never guess"): a row the vendor may have
//   re-issued under a new id is passed in with `held`. It is either a second genuine fill or a duplicate, and the
//   readings price every later sell of the pair differently. So a held row opens no lot; a held sell is counted only when
//   no counted twin already stands for it (each real sell once: a shown twin leaves it a possible further sell); every sell of the pair after it in
//   the canonical order is counted in `excludedHeld` while the row is held (their own count: their reason is not "no
//   recorded entry"); a rename carries the mark. A row decided genuine is priced normally on the next rebuild. Only
//   undecided rows are held (pending, confirm, or a give-up); a row the count rule decided suspected is the excess
//   beyond what one vendor response showed, a duplicate, and never reaches the matcher (final review R1).
//   ponytail: a thesis on a later sell that a hold counts goes to kept_theses (lib/sync.ts#rebuildTrades) and comes back
//   when the sell is shown again, but the kept copy stays behind (a kept row is only removed when the trader edits or
//   clears that thesis) — fix: remove the kept row when its trade is shown again, in the same rebuild.
// - Same instant (F3-5): symbol changes, then other corporate actions, then buys, then sells, then the vendor id. In a
//   long-only ledger a sell is filled from shares held, so a same-instant buy before it is the only order that can be
//   true when the sell needs it; when older lots cover the sell, FIFO draws them first and the order changes nothing. A
//   sell is never matched to a buy dated after it. Fixes cycle 4 (C4-1): on a pair with evidence that a sell may not be a
//   long close (an earlier oversell, or an unknown ledger), every sell is counted, so no same-instant short is shown
//   there; without evidence the buy-first order stands (F-30's red-team rule; see the ponytail in `replay`).
// - Shares an action names that the ledger lacks (C4-1, engineer): a rename's units arrive in the new symbol, a split's
//   vendor count in the pair, as a lot with no basis at the front of FIFO (a sell drawing it is counted).
// Corporate actions (lib/corporate-actions.ts) adjust the lots: a split or stock dividend multiplies units by p/q and
// divides price and fee per unit by it (total cost and fees conserved, holding period from the original buy); a symbol
// change moves the lots, FIFO order kept by date; an unpriceable action taints them. At the same instant, actions apply
// before trades (trade dates are often day-only and an action is dated on its effective day).
// Bumped when a change to the matcher can change a published figure: a deploy then rebuilds every record once
// (lib/matcher-rebuild.ts). 2: fixes cycle 4 (C4-1 ties, C4-2 the gap).
export const MATCHER_VERSION = 2;

// `orderKnown` (independent review, finding 1): the input order is the true order at a tie (public filings pass rows in
// filing order, lib/public-trades.ts), so ties fall back to it instead of the vendor id.
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
  // Same-instant order (F3-5): renames, other actions, buys, sells; then actions before activities; then the vendor id, a
  // canonical order (as the rebuild's own sort), so the result never depends on the input order (fixes cycle 4, engineer
  // round 1: two rows on one side at one instant were matched in input order); then input order.
  // ponytail: a date-only same-day short with no evidence on its pair (no earlier oversell, no unknown ledger) is still
  // read buy first and shown as a long (C4-1's residual, accepted by F-30: counting every same-day round trip would let a
  // trader close losers the same day and keep winners overnight) — fix: F-30 (blocked on owner Q1(a)) and the vendor's
  // per-brokerage date-only answer (MRC2-10).
  // ponytail: rows on one side at one instant (two buys at different prices, for one) are matched in vendor-id order, which
  // is deterministic and not the trader's choice but may not be the true fill order (off by at most the instant's price
  // spread) — fix: pool the cost of tied buys and split tied sells pro rata (engineer, committee round 4).
  const sideOrder = (side: 'BUY' | 'SELL') => (side === 'BUY' ? 2 : 3);
  const idOf = (e: Event) => (opts.orderKnown ? '' : e.act?.externalId ?? e.ca?.externalId ?? '');
  const events: Event[] = [
    ...actions.map((ca, i) => ({ at: ca.executedAt.getTime(), order: ca.kind === 'symbol-change' ? 0 : isTradeRow(ca) ? sideOrder(ca.side) : 1, src: 0, i, ca })),
    ...activities.map((act, i) => ({ at: act.executedAt.getTime(), order: sideOrder(act.side), src: 1, i, act })),
  ].sort((a, b) => a.at - b.at || a.order - b.order || a.src - b.src || (idOf(a) < idOf(b) ? -1 : idOf(a) > idOf(b) ? 1 : 0) || a.i - b.i);
  const books = new Map<string, Book>();
  const book = (key: string) => { let b = books.get(key); if (!b) books.set(key, (b = { lots: [] })); return b; };
  const trades: ClosedTrade[] = [];
  let excluded = 0, excludedCorporate = 0, excludedHeld = 0;
  // F-24 RT-2 (final review R2): the pairs a held row has been reached in, in the canonical order. Every later sell of
  // such a pair is counted, so no shown figure depends on how the held row is decided: a sell before it in the order is
  // priced the same under both readings (held → genuine, held → dropped), and every sell after it is counted. A rename
  // carries the mark to the new symbol, as the gap (F-28).
  const heldKeys = new Set<string>();
  // Each real sell is counted once (final review): a held sell repeats, or adds to, an unheld twin. Its twin counted here
  // already stands for it; a twin shown means the held sell may be one more sell, so it is counted itself.
  const sig = (a: Activity) => `${a.accountId}|${a.symbol}|${a.executedAt.getTime()}|${a.units}|${a.price}`;
  const countedTwins = new Map<string, number>(), heldSells: Activity[] = [];

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
  // F4-1: accounts a symbol-less unusable buy made unknown (every pair, existing or later, from that row on).
  const unknownAccounts = new Set<string>();
  const unknown = (key: string) => unknownFrom.has(key) || unknownAccounts.has(key.slice(0, key.lastIndexOf('|')));
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
        if (ca.scope === 'account') {
          // F4-1: no symbol, so no pair (see the header): a sell leaves every pair holding lots unknown, a buy the account.
          // An undated row (replayed first, at the epoch) may sit anywhere in the history: the account, whatever its side.
          const wholeAccount = ca.side === 'BUY' || !!ca.undated;
          if (wholeAccount) unknownAccounts.add(ca.accountId);
          for (const [k, other] of books) if (k.startsWith(`${ca.accountId}|`) && (wholeAccount || other.lots.length)) { taint(other.lots); unknownFrom.add(k); }
          continue;
        }
        if (ca.units !== undefined && !ca.undated) {
          if (ca.side === 'SELL') addGap(b, removeOldest(b.lots, ca.units)); // C4-2: an unusable oversell leaves a gap too
          else b.lots.push({ units: ca.units, price: 0, feePerUnit: 0, at: ca.executedAt, verified: false, tainted: true });
        } else {
          taint(b.lots);
          unknownFrom.add(key);
        }
        continue;
      }
      if (!b.lots.length && moved?.at === e.at && ca.kind !== 'symbol-change') { taint(book(moved.to).lots); }
      if (ca.kind === 'split' || ca.kind === 'stock-dividend') {
        if (exchangedInto.get(key) === e.at) { taint(b.lots); continue; }
        if (!b.lots.length) {
          // C4-1 (engineer, round 1; final and independent reviews): the vendor sends a split or stock dividend only for
          // shares held, so on an empty ledger it says shares exist that the ledger lacks (earlier history), whatever its
          // count (a total, a change, a reverse split's negative change) or a ratio alone. A no-basis lot of some size could
          // hide a later oversell, so the pair gets the gap instead: every later sell is counted.
          if (moved?.at !== e.at) addGap(b, Math.abs(ca.units ?? 0) || 1);
          continue;
        }
        const r = resolveRatio(held(b.lots), ca);
        if (!r) { taint(b.lots); continue; }
        scale(b.lots, r.ratio);
        if (r.leftover > 0) removeOldest(b.lots, r.leftover); // cash in lieu: not a trade, not counted
        if (openedInWindow(b.lots, e.at)) taint(b.lots);
      } else if (ca.kind === 'symbol-change') {
        // F3-1: an unknown ledger stays unknown under its new symbol, whether or not lots move (a unit-less or undated buy
        // leaves none; a share count that doesn't match leaves them behind, tainted).
        if (unknown(key) && ca.newSymbol !== ca.symbol) {
          const unknownTo = `${ca.accountId}|${ca.newSymbol}`;
          unknownFrom.add(unknownTo);
          taint(book(unknownTo).lots);
        }
        // C4-2 (F-28: the pending count travels with a rename): a short renames with the shares, so the gap moves too.
        if (b.gap && ca.newSymbol !== ca.symbol) { addGap(book(`${ca.accountId}|${ca.newSymbol}`), b.gap); b.gap = 0; }
        if (heldKeys.has(key) && ca.newSymbol !== ca.symbol) heldKeys.add(`${ca.accountId}|${ca.newSymbol}`); // F-24 RT-2
        // C4-1 (engineer, round 1): shares the rename says moved but the ledger doesn't hold arrive in the new symbol with
        // no basis, so FIFO draws them (counted) before any later buy there. They predate the history, so they are dated
        // before all of it and stay first when a later rename merges lots by date (independent review, finding 4).
        const shadow = () => { if (ca.newSymbol !== ca.symbol && ca.inUnits > 0) book(`${ca.accountId}|${ca.newSymbol}`).lots.unshift({ units: ca.inUnits, price: 0, feePerUnit: 0, at: BEFORE_HISTORY, verified: false, tainted: true }); };
        if (!b.lots.length) { shadow(); continue; }
        const h = held(b.lots);
        const r = ca.newSymbol !== ca.symbol && Math.abs(h - ca.outUnits) <= RATIO_TOLERANCE * Math.max(1, h) ? renameRatio(ca.outUnits, ca.inUnits) : null;
        if (!r) { taint(b.lots); shadow(); continue; }
        scale(b.lots, r);
        const toKey = `${ca.accountId}|${ca.newSymbol}`;
        if (inWindowBefore(tradesAt.get(toKey), e.at) || (r.p !== r.q && openedInWindow(b.lots, e.at))) taint(b.lots);
        const to = book(toKey);
        to.lots = [...to.lots, ...b.lots].sort((x, y) => x.at.getTime() - y.at.getTime());
        if (unknown(toKey)) taint(to.lots); // F3-1: lots moved into a pair whose ledger is unknown
        books.set(key, { lots: [] }); // a recycled ticker starts fresh lots
        movedTo.set(key, { at: e.at, to: `${ca.accountId}|${ca.newSymbol}` });
        if (r.p !== r.q) exchangedInto.set(toKey, e.at);
      } else {
        if (ca.scope === 'account') {
          for (const [k, other] of books) if (k.startsWith(`${ca.accountId}|`)) taint(other.lots);
        } else taint(b.lots);
        const u = ca.units ?? 0;
        // Independent review (finding 3): an unpriceable action on a pair the ledger holds none of (not shares it hands
        // over: a spin-off's received shares) says earlier shares exist: the gap.
        if (u <= 0 && ca.scope !== 'account' && !b.lots.length && moved?.at !== e.at) addGap(b, Math.abs(u) || 1);
        else if (u > 0) b.lots.push({ units: u, price: 0, feePerUnit: 0, at: ca.executedAt, verified: false, tainted: true });
        else if (u < 0) addGap(b, removeOldest(b.lots, -u));
      }
      continue;
    }

    const a = e.act!;
    const key = `${a.accountId}|${a.symbol}`;
    const b = book(key);
    const open = b.lots;
    // F-24 RT-2: a held row opens no lot and prices nothing. A held sell itself is not counted: it may repeat a sell that
    // is already shown or counted, and each real sell is counted once (final review); it is counted, or shown, when a
    // read decides it genuine.
    if (a.held) { heldKeys.add(key); if (a.side === 'SELL') heldSells.push(a); continue; }
    if (a.side === 'BUY') {
      // A buy on the day of a repricing action may be at either side of it: tainted, never scaled or left on a guess.
      open.push({ units: a.units, price: a.price, feePerUnit: a.fee / a.units, at: a.executedAt, verified: a.verified, ...(sameDayAction(a) || unknown(key) ? { tainted: true } : {}) });
      continue;
    }

    // C4-2: after an oversell the pair's later sells are counted (see the header), whatever their outcome.
    // Independent review (finding 5): any gap counts, at whatever scale this sell is (addGap already ignores a residual
    // that is tiny at the oversell's own scale), so a large later sell can't slip past a small gap.
    const gapped = (b.gap ?? 0) > 0;
    if (heldKeys.has(key)) { // F-24 RT-2: the ledger may be missing (or doubling) a held row
      excludedHeld++;
      continue;
    }
    let remaining = a.units;
    let cost = 0;
    let entryFees = 0;
    let openedAt: Date | null = null;
    let verified = a.verified;
    let tainted = false;
    while (!tiny(remaining, a.units) && open.length) {
      const lot = open[0];
      const take = Math.min(lot.units, remaining);
      cost += take * lot.price;
      entryFees += take * lot.feePerUnit;
      openedAt ??= lot.at;
      verified &&= lot.verified;
      tainted ||= !!lot.tainted;
      lot.units -= take;
      remaining -= take;
      if (tiny(lot.units, a.units)) open.shift();
    }

    if (!tiny(remaining, a.units)) {
      // Oversold: this sell, and every later sell of the pair through the gap (C4-2). Drawing a unit a corporate action left unpriced makes it a corporate exclusion.
      // An oversell in a pair whose ledger an unusable trade row made unknown (F3-1) is that cause, not missing history.
      if (tainted || unknown(key)) excludedCorporate++; else excluded++;
      addGap(b, remaining); // C4-2: a short or earlier history
      continue;
    }
    if (tainted || latePosted(a) || sameDayAction(a)) excludedCorporate++;
    else if (gapped) excluded++; // C4-2: a short or earlier history: no buy can be matched for certain
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
  // Every unheld sell not shown is counted (excludedHeld, excluded or excludedCorporate): each stands for one held twin
  // (test author's fuzz: a twin counted as "no recorded entry" counted the same real sell twice).
  const shownIds = new Set(trades.map((t) => t.sellId));
  for (const a of activities) if (a.side === 'SELL' && !a.held && !shownIds.has(a.externalId)) countedTwins.set(sig(a), (countedTwins.get(sig(a)) ?? 0) + 1);
  for (const h of heldSells) {
    const n = countedTwins.get(sig(h)) ?? 0;
    if (n > 0) countedTwins.set(sig(h), n - 1); // its twin is counted already
    else excludedHeld++; // a possible further sell beyond a shown twin
  }
  return { result: { trades, excluded, excludedCorporate, ...(excludedHeld ? { excludedHeld } : {}) }, books };
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

// One independent bet: x = sum of log returns, d = sum of hold days (each at least 1), n = trades in it.
export type Cluster = { x: number; d: number; n: number };

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
  const spanDays = n ? (Math.max(...trades.map((t) => t.closedAt.getTime())) - Math.min(...trades.map((t) => t.openedAt.getTime()))) / DAY : 0;
  return confidenceFromClusters(clusters, n, spanDays);
}

// The statistics on already-clustered bets. app/t/ticker-sql.ts clusters in SQL and calls this with one row per bet, so
// both paths share every formula below. n = trades, spanDays = (last exit - first entry) in days.
export function confidenceFromClusters(clusters: Cluster[], n: number, spanDays: number): Confidence {
  const k = clusters.length;
  if (k < MIN_BETS) return confidenceFromSums({ n, k, spanDays, sumX: 0, sumD: 0, ssM: 0, ssR: 0 });
  const sumX = clusters.reduce((a, c) => a + c.x, 0);
  const sumD = clusters.reduce((a, c) => a + c.d, 0);
  const m = sumX / n;
  const R = sumX / sumD;
  const ssM = clusters.reduce((a, c) => a + (c.x - c.n * m) ** 2, 0);
  const ssR = clusters.reduce((a, c) => a + (c.x - R * c.d) ** 2, 0);
  return confidenceFromSums({ n, k, spanDays, sumX, sumD, ssM, ssR });
}

// FIXES-LABELS (round 3, engineer): the one formula, on the clustering sums. k = bets, sumX/sumD = Σx/Σd over bets,
// ssM = Σ(x − n·m)² with m = sumX / n, ssR = Σ(x − R·d)² with R = sumX / sumD. app/t/ticker-sql.ts#othersConfidence
// computes these in SQL as one row, so a pool of many bets never ships one row per bet.
export type BetSums = { n: number; k: number; spanDays: number; sumX: number; sumD: number; ssM: number; ssR: number };
export function confidenceFromSums(s: BetSums): Confidence {
  const { n, k, spanDays, sumX, sumD, ssM, ssR } = s;
  const tradesPerMonth = (n / Math.max(spanDays, 30)) * 30; // display only
  // F-4: below MIN_BETS (5) independent bets there is no range; from there it is always computed (t with K − 1 df).
  const tier: Tier = k < MIN_BETS ? 'too-early' : k >= 100 && spanDays >= 365 ? 'strong' : k >= 30 && spanDays >= 90 ? 'moderate' : 'thin';
  const base = { n, k, spanDays, tradesPerMonth };
  if (tier === 'too-early') return { ...base, tier, edge: null, perTrade: null, pace30: null };

  const t = tCrit95(k - 1);
  const m = sumX / n;
  const seM = Math.sqrt((k / (k - 1)) * ssM) / n;
  const R = sumX / sumD;
  const seR = Math.sqrt((k / (k - 1)) * ssR) / sumD;
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
