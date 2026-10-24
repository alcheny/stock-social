// F-2 PR-4 (owner decisions O1 and O4, business lead committee PR-1b §5): a signed-in viewer's negative preferences and
// the card gestures, pure. An unfollow is a slight negative on that trader (−1), never a hide; a trade reject hides that
// trade (−4) and is a slight negative on its trader (−1) that ends at 90 days; read at asOf, so a same-day cursor's
// list never changes. Double tap (300 ms, 24 px) and the card's reject swipe (half the card, armed at rest only).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as W from './weights.ts';
import { prefsAt, prefFactor, rerank, preferPool, prefRows } from './prefs.ts';
import { shapeList, splitRejects, displayFilter, splitExclusions, type ExclusionRow, type RejectRow } from './exclusions.ts';
import { mixFeed, prng, discounted } from './explore.ts';
import { worstWindow } from './diversity.ts';
import { chooseRows, sectionCandidates, type SectionTrader } from './section.ts';
import { canArm, cardOutcome, isDoubleTap, DOUBLE_TAP_MS, DOUBLE_TAP_PX } from './reject.ts';
import { pageOf, firstPage } from './pager.ts';
import { rankTraders } from '../trades.ts';

const DAY = 86_400_000;
const asOf = Date.parse('2026-10-24T09:00:00Z');

test('the owner\'s weights: unfollow −1 and a trade reject −4 on the trade and −1 on its trader; one 90-day constant for the trade (O3 default), 90 days for the trader part; FEED_HIDES_UNFOLLOWED retired', () => {
  assert.equal(W.WEIGHTS.unfollow, -1);
  assert.equal(W.WEIGHTS.reject, -4);
  assert.equal(W.WEIGHTS.rejectTrader, -1);
  assert.ok(W.WEIGHTS.unfollow > W.WEIGHTS.notInterested && W.WEIGHTS.unfollow < 0, 'slight: smaller than "Not interested"');
  assert.equal(W.TRADE_REJECT_DAYS, W.EXCLUSION_DAYS);
  assert.equal(W.PREF_DAYS, 90);
  assert.ok(!('FEED_HIDES_UNFOLLOWED' in W));
  assert.equal(prefFactor(0), 1);
  assert.equal(prefFactor(-1), 0.8);
  assert.ok(Math.abs(prefFactor(-2) - 0.64) < 1e-12);
  assert.equal(prefFactor(3), 1, 'nothing positive before PR-5');
});

test('prefsAt: a running unfollow and a reject of the last 90 days count at asOf; one made after asOf, ended by asOf or older than 90 days does not; a permanent trade reject still ends its trader part at 90 days; they add up', () => {
  const ex: ExclusionRow[] = [
    { trader: 1, createdAt: asOf - DAY, until: asOf + 89 * DAY, reason: 'unfollow' },
    { trader: 2, createdAt: asOf + 1000, until: asOf + 90 * DAY, reason: 'unfollow' }, // after asOf: next page 1
    { trader: 3, createdAt: asOf - 91 * DAY, until: asOf - DAY, reason: 'unfollow' }, // aged out
    { trader: 4, createdAt: asOf - DAY, until: asOf + 89 * DAY, reason: 'not_interested' }, // a hide, not a preference
  ];
  const rj: RejectRow[] = [
    { key: 'k1', trader: 1, createdAt: asOf - DAY, until: asOf + 89 * DAY },
    { key: 'k5', trader: 5, createdAt: asOf - 89 * DAY, until: Infinity }, // permanent trade, trader part 1 day left
    { key: 'k6', trader: 6, createdAt: asOf - 90 * DAY - 1, until: Infinity }, // trader part over
  ];
  const p = prefsAt(prefRows(ex, rj), asOf);
  assert.deepEqual([...p].sort((a, b) => a[0] - b[0]), [[1, -2], [5, -1]]);
  // Undo after asOf (until = now) keeps the cursor's preferences; a new page 1 after it has none.
  const undone = prefRows([{ ...ex[0], until: asOf + 5000 }], []);
  assert.deepEqual([...prefsAt(undone, asOf)], [[1, -1]]);
  assert.deepEqual([...prefsAt(undone, asOf + 6000)], []);
});

type Card = { key: string; trader: number; symbol: string; score: number; weight: number; rank: number };
function ranked(seed: number, n = 120): Card[] {
  const r = prng(seed), traders = 12 + Math.floor(r() * 30);
  const raw = Array.from({ length: n }, (_, i) => ({ key: `c${i}`, trader: Math.floor(r() * traders), symbol: `S${Math.floor(r() * 40)}`, score: Math.round(r() * 50) / 10, weight: r() < 0.5 ? 0 : Math.round(r() * 20) / 10 }));
  return discounted(rankTraders(raw).map((c, rank) => ({ ...c, rank })));
}

test('rerank: with no preference the list is exactly the impersonal ranking (rankTraders, then the per-card discount); with one, the same cards, nothing hidden', () => {
  for (let s = 1; s <= 200; s++) {
    const base = ranked(s);
    assert.deepEqual(rerank(base, new Map()), base);
    assert.deepEqual(rerank(base, new Map([[999, -1]])), base, 'a preference on a trader not in the list changes nothing');
    const t = base[7].trader;
    const out = rerank(base, new Map([[t, -1]]));
    assert.deepEqual(out.map((c) => c.key).sort(), base.map((c) => c.key).sort());
  }
});

test('rerank: an unfollowed trader ranks below an otherwise identical trader (same weight and scores), with or without evidence and at a zero score; slight: still above a record scoring under 0.8× its own', () => {
  for (const weight of [0, 1.5]) for (const score of [0, 2]) {
    const cards: Card[] = [
      { key: 'a', trader: 1, symbol: 'A', score, weight, rank: 0 },
      { key: 'b', trader: 2, symbol: 'B', score, weight, rank: 1 },
      { key: 'c', trader: 3, symbol: 'C', score: score * 0.79, weight, rank: 2 },
    ];
    assert.deepEqual(rerank(cards, new Map()).map((c) => c.key), ['a', 'b', 'c']);
    const out = rerank(cards, new Map([[1, -1]])).map((c) => c.key);
    assert.ok(out.indexOf('b') < out.indexOf('a'), `${weight}/${score}: ${out}`);
    if (score > 0) assert.ok(out.indexOf('a') < out.indexOf('c'), 'slight, not a hide');
  }
});

test('shapeList: a rejected trade leaves the list (its trader\'s other cards stay); exploration-only cards are filtered too; no shaping and no preference is PR-1b\'s mix exactly', () => {
  for (let s = 1; s <= 100; s++) {
    const base = ranked(s), day = '2026-10-24';
    const extra = Array.from({ length: 20 }, (_, i) => ({ key: `x${i}`, trader: 500 + i, symbol: `X${i}`, score: 0, weight: 0, rank: 1000 + i }));
    assert.deepEqual(shapeList(base, new Set(), day, { extra }), mixFeed(base, { day, extra }));
    const k = base[3];
    const out = shapeList(base, new Set(), day, { keys: new Set([k.key, 'x2']), prefs: new Map([[k.trader, W.WEIGHTS.rejectTrader]]), extra }).map((m) => m.card);
    assert.ok(!out.some((c) => c.key === k.key || c.key === 'x2'));
    const kept = base.filter((c) => c.trader === k.trader && c.key !== k.key).length;
    assert.ok(out.filter((c) => c.trader === k.trader).length >= Math.min(1, kept));
    const w = worstWindow(out);
    assert.ok(w.trader <= 2 && w.symbol <= 2, 'the caps hold exactly on a new page 1');
  }
});

test('splitRejects: a reject made by asOf shapes; one made after asOf drops that card in place; Undo after asOf leaves the cursor\'s list alone; a permanent reject never ends', () => {
  const now = asOf + 3_600_000;
  const rows: RejectRow[] = [
    { key: 'a', trader: 1, createdAt: asOf - 1000, until: asOf + 90 * DAY },
    { key: 'b', trader: 1, createdAt: asOf + 1000, until: asOf + 90 * DAY },
    { key: 'c', trader: 2, createdAt: asOf + 1000, until: asOf + 2000 }, // undone
    { key: 'd', trader: 3, createdAt: asOf - 400 * DAY, until: Infinity },
  ];
  const r = splitRejects(rows, asOf, now);
  assert.deepEqual([...r.shaping].sort(), ['a', 'd']);
  assert.deepEqual([...r.hidden], ['b']);
  assert.deepEqual([...splitRejects(rows.map((x) => (x.key === 'a' ? { ...x, until: now } : x)), asOf, now + 1).shaping].sort(), ['a', 'd']);
  // "Not interested" ignores unfollow rows (O4: never a hide).
  const ex = splitExclusions([{ trader: 9, createdAt: asOf - 1, until: asOf + DAY, reason: 'unfollow' }, { trader: 8, createdAt: asOf + 1, until: now + DAY, reason: 'unfollow' }], asOf, now);
  assert.deepEqual([ex.shaping.size, ex.hidden.size], [0, 0]);
  const slice = [{ key: 'a', trader: 1 }, { key: 'b', trader: 1 }, { key: 'z', trader: 4 }];
  assert.deepEqual(displayFilter(slice, new Set(), new Set(['b'])).map((c) => c.key), ['a', 'z']);
});

test('a trade rejected between pages, 500 seeded feeds: no card repeats, every other card keeps its relative order, the rejected card appears nowhere after; the trader\'s other cards stay', () => {
  for (let s = 1; s <= 500; s++) {
    const list = mixFeed(ranked(s, 150), { day: '2026-10-24' }).map((m) => m.card);
    const c = firstPage(asOf);
    const p1 = pageOf(list, c);
    if (!p1.next) continue;
    const later = list.slice(30, 60);
    if (!later.length) continue;
    const gone = later[Math.floor(prng(s)() * later.length)];
    const p2 = displayFilter(pageOf(list, p1.next).items, new Set(), new Set([gone.key]));
    const seen = [...p1.items, ...p2].map((x) => x.key);
    assert.equal(new Set(seen).size, seen.length);
    assert.deepEqual(p2.map((x) => x.key), later.filter((x) => x.key !== gone.key).map((x) => x.key));
    assert.ok(!p2.some((x) => x.key === gone.key));
  }
});

test('section: an unfollowed trader stays a candidate and reads below an otherwise identical trader; the rows still read in evidence order; the new-record slot prefers the trader with no preference', () => {
  const t = (trader: number, weight: number, n = 12, hold = 3 * trader): SectionTrader => ({ trader, score: 1, weight, hold, n, verified: true });
  const pool = [t(1, 0.5), t(2, 0.5), t(3, 0.4), t(4, 0.1), t(5, 0.3)];
  const prefs = new Map([[1, -1]]);
  const mine = preferPool(pool, prefs);
  assert.deepEqual(mine.map((x) => x.trader), [2, 1, 3, 5, 4], 'below 2 (identical), above 3 (0.8 × 0.5 = 0.4 ties 3 on weight·f, more evidence)');
  const cands = sectionCandidates(mine, [], 0, new Set());
  assert.ok(cands.some((x) => x.trader === 1), 'never a hide');
  const rows = chooseRows(cands)!;
  assert.deepEqual(rows.map((x) => x.trader), [2, 1, 3]);
  assert.deepEqual(chooseRows(sectionCandidates(pool, [], 0, new Set()))!.map((x) => x.trader), [1, 2, 3], 'signed out: id order between equals');
  // The slot (weight 0, fewest closes): an identical newcomer with no preference wins it.
  const fresh = [t(1, 0.5, 12, 0.5), t(2, 0.4, 12, 14), t(6, 0, 5, 60), t(7, 0, 5, 300)];
  const slot = (p: Map<number, number>) => chooseRows(sectionCandidates(preferPool(fresh, p), [], 0, new Set()))!.map((x) => x.trader);
  assert.ok(slot(new Map()).includes(6));
  assert.ok(slot(new Map([[6, -1]])).includes(7) && !slot(new Map([[6, -1]])).includes(6));
  assert.deepEqual(preferPool(pool, new Map()), pool);
});

test('double tap: two taps on the same card within 300 ms and 24 px like; 301 ms, 25 px, another card or a tap on a link, button or chart does not', () => {
  assert.equal(DOUBLE_TAP_MS, 300);
  assert.equal(DOUBLE_TAP_PX, 24);
  const a = { t: 1000, x: 100, y: 200, card: 'k', plain: true };
  assert.equal(isDoubleTap(a, { ...a, t: 1299 }), true);
  assert.equal(isDoubleTap(a, { ...a, t: 1300, x: 124 }), true);
  assert.equal(isDoubleTap(a, { ...a, t: 1301 }), false);
  assert.equal(isDoubleTap(a, { ...a, t: 1100, x: 125 }), false);
  assert.equal(isDoubleTap(a, { ...a, t: 1100, y: 225 }), false);
  assert.equal(isDoubleTap(a, { ...a, t: 1100, card: 'j' }), false);
  assert.equal(isDoubleTap(a, { ...a, t: 1100, plain: false }), false);
  assert.equal(isDoubleTap({ ...a, plain: false }, { ...a, t: 1100 }), false);
  assert.equal(isDoubleTap(null, a), false);
});

test('card reject swipe: armed only on a card at rest with no pane open and not within 400 ms after one closed; commits when the finger travelled half the card; 49% snaps back; unarmed never commits', () => {
  assert.equal(canArm({ atRest: true, paneOpen: false, sinceClose: 400 }), true);
  assert.equal(canArm({ atRest: true, paneOpen: false, sinceClose: 399 }), false);
  assert.equal(canArm({ atRest: false, paneOpen: false, sinceClose: 9e9 }), false);
  assert.equal(canArm({ atRest: true, paneOpen: true, sinceClose: 9e9 }), false);
  assert.equal(cardOutcome(true, 188, 375), 'reject');
  assert.equal(cardOutcome(true, 183, 375), 'back');
  assert.equal(cardOutcome(false, 375, 375), 'back');
  assert.equal(cardOutcome(true, -300, 375), 'back');
});
