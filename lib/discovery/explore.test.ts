// F-2 PR-1 (criterion 6): at least 2 of every 10 feed cards are exploration picks from outside the top 30, seeded by
// the UTC day only; the diversity caps hold over every window, across page joins, and are never relaxed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daySeed, EXPLORE_EVERY, EXPLORE_TOP, mixFeed, prng } from './explore.ts';
import { fits, worstWindow, type MixCard } from './diversity.ts';
import { decodeCursor, encodeCursor, firstPage, pageOf } from './pager.ts';

type Card = MixCard & { returnPct: number };

// A generated ranked candidate list (≤ 200 cards, as FEED_CANDIDATES caps it). Traders and symbols are skewed: a few
// traders and symbols hold many cards, as a real feed's heavy traders do.
function generate(seed: number, shape: 'realistic' | 'adversarial'): Card[] {
  const r = prng(seed);
  // Realistic: a database with enough eligible closes fills FEED_CANDIDATES (200); 120 to 200 here. Adversarial: any
  // size from 30 (no pool) up, few traders and symbols.
  const n = shape === 'realistic' ? 120 + Math.floor(r() * 81) : 30 + Math.floor(r() * 171);
  const traders = shape === 'realistic' ? 20 + Math.floor(r() * 61) : 1 + Math.floor(r() * 10);
  const symbols = shape === 'realistic' ? 10 + Math.floor(r() * 51) : 1 + Math.floor(r() * 10);
  const skew = (k: number) => Math.min(k - 1, Math.floor(k * r() ** (shape === 'realistic' ? 1.6 : 3)));
  return Array.from({ length: n }, (_, i) => ({ key: `c${i}`, trader: skew(traders), symbol: `S${skew(symbols)}`, returnPct: (r() - 0.5) * 0.8 }));
}
const DAYS = ['2026-10-23', '2026-10-24', '2027-01-01', '2026-02-28'];

test('constants: exploration from outside the top 30, one pick in every 5 slots (2 of every 10)', () => {
  assert.equal(EXPLORE_TOP, 30);
  assert.equal(EXPLORE_EVERY, 5);
});

test('property, 1,000 generated feeds × 3 pages: caps on every window (page joins included), never relaxed; ≥ 2 exploration picks per full window', () => {
  let windows = 0, joins = 0, explores = 0;
  for (let f = 0; f < 1000; f++) {
    const shape = f % 4 === 3 ? 'adversarial' : 'realistic';
    const ranked = generate(f + 1, shape);
    const day = DAYS[f % DAYS.length];
    const list = mixFeed(ranked, { day });
    // Pages 1 to 3 through real cursors equal the list's first 90 cards.
    const NOW = Date.parse(`${day}T12:00:00Z`);
    let c = firstPage(NOW);
    const shown: typeof list = [];
    for (let p = 0; p < 3; p++) {
      const page = pageOf(list, c);
      shown.push(...page.items);
      if (!page.next) break;
      c = decodeCursor(encodeCursor(page.next), NOW, 200)!;
      joins++;
    }
    assert.deepEqual(shown, list.slice(0, 90), `feed ${f}`);
    // Every card at most once.
    assert.equal(new Set(list.map((x) => x.card.key)).size, list.length);
    // Caps on every 10-card window of the whole list (so of every window crossing a page join).
    const w = worstWindow(list.map((x) => x.card));
    assert.ok(w.trader <= 2 && w.symbol <= 2, `feed ${f}: ${JSON.stringify(w)}`);
    // Never relaxed: when the list ends, nothing left fits.
    const used = new Set(list.map((x) => x.card.key));
    for (const left of ranked.filter((x) => !used.has(x.key))) assert.equal(fits(list.map((x) => x.card), left), false, `feed ${f}: ${left.key} fits but was dropped`);
    // Exploration picks come from outside the top 30, in exploration slots; every other card is the best-ranked card
    // that fits its slot (the list stays in rank order past the top). Fix round 1 (UX follow-up 6): of another trader
    // than the previous card's when one fits; the previous card's trader only when no other card fits. Fix round 2
    // (business lead blocker): before that, of a trader not among the last 9 cards when one fits.
    const rank = new Map(ranked.map((x, i) => [x.key, i]));
    list.forEach((x, p) => {
      if (x.explore) { assert.ok(x.exploreSlot && rank.get(x.card.key)! >= EXPLORE_TOP, `feed ${f}: explore pick`); return; }
      const before = list.slice(0, p).map((y) => y.card);
      const placed = new Set(before.map((y) => y.key));
      const prev = before[before.length - 1]?.trader;
      const recent = new Set(before.slice(-9).map((y) => y.trader));
      const free = (q: Card) => !placed.has(q.key) && fits(before, q);
      const best = ranked.find((q) => free(q) && !recent.has(q.trader)) ?? ranked.find((q) => free(q) && q.trader !== prev) ?? ranked.find(free);
      assert.equal(x.card.key, best?.key, `feed ${f} slot ${p}: not the best-ranked card that fits`);
    });
    // ≥ 2 per full window on realistic feeds. An exploration slot takes a top-30 card only when no card from outside
    // the top 30 fits there (checked on every feed, adversarial ones included).
    const pool = ranked.slice(EXPLORE_TOP);
    list.forEach((x, p) => {
      if (x.explore || !x.exploreSlot) return;
      const before = list.slice(0, p).map((y) => y.card);
      const placed = new Set(before.map((y) => y.key));
      for (const q of pool) if (!placed.has(q.key)) assert.equal(fits(before, q), false, `feed ${f} slot ${p}: ${q.key} fits`);
    });
    // A window counts while the pool still holds a card at each of its exploration slots (a pool of 30 + k cards runs
    // dry after k picks; from then on the ranked top fills those slots).
    const poolLeft = list.map((_, p) => { const placed = new Set(list.slice(0, p).map((y) => y.card.key)); return pool.filter((q) => !placed.has(q.key)).length; });
    const live = (s: number) => list.slice(s, s + 10).every((x, i) => !x.exploreSlot || poolLeft[s + i] > 0);
    if (shape === 'realistic') {
      for (let s = 0; s + 10 <= list.length && live(s); s++, windows++) {
        const n = list.slice(s, s + 10).filter((x) => x.explore).length;
        assert.ok(n >= 2, `feed ${f}, window at ${s}: ${n} exploration picks`);
        explores += n;
      }
    }
  }
  assert.ok(windows > 20_000, `${windows} windows checked`);
  assert.ok(joins > 500, `${joins} page joins crossed`);
  assert.equal(explores, windows * 2, 'exactly 2 of every 10 while the pool supplies them (not more: the list stays ranked)');
});

test('seeded by the UTC day only: the same day gives the same list, other days differ', () => {
  let differ = 0;
  for (let f = 0; f < 100; f++) {
    const ranked = generate(5000 + f, 'realistic');
    const a = mixFeed(ranked, { day: '2026-10-23' });
    assert.deepEqual(mixFeed(ranked, { day: '2026-10-23' }), a);
    if (JSON.stringify(mixFeed(ranked, { day: '2026-10-24' })) !== JSON.stringify(a)) differ++;
  }
  assert.ok(differ >= 95, `${differ} of 100 differ by day`);
  assert.equal(daySeed('2026-10-23'), daySeed('2026-10-23'));
  assert.notEqual(daySeed('2026-10-23'), daySeed('2026-10-24'));
});

test('sign invariance: negating every return leaves the list unchanged (the mix never reads a return)', () => {
  for (let f = 0; f < 200; f++) {
    const ranked = generate(9000 + f, f % 2 ? 'realistic' : 'adversarial');
    const neg = ranked.map((c) => ({ ...c, returnPct: -c.returnPct }));
    const keys = (l: ReturnType<typeof mixFeed<Card>>) => l.map((x) => [x.card.key, x.explore]);
    assert.deepEqual(keys(mixFeed(neg, { day: '2026-10-23' })), keys(mixFeed(ranked, { day: '2026-10-23' })));
  }
});

test('the ranking leads: with no cap in the way the non-exploration cards are the ranking in order, on every page', () => {
  const ranked = Array.from({ length: 200 }, (_, i) => ({ key: `k${i}`, trader: i, symbol: `S${i}` }));
  const list = mixFeed(ranked, { day: '2026-10-23' });
  const rest = list.filter((x) => !x.explore).map((x) => x.card.key);
  assert.deepEqual(rest, ranked.map((x) => x.key).filter((k) => rest.includes(k)));
  const picked = new Set(list.filter((x) => x.explore).map((x) => x.card.key));
  assert.deepEqual(rest.slice(0, 72), ranked.map((x) => x.key).filter((k) => !picked.has(k)).slice(0, 72), 'pages 1 to 3: the 72 best-ranked cards not explored, in order');
  assert.deepEqual(rest.slice(0, 30), ranked.slice(0, 30).map((x) => x.key), 'the top 30 lead, in order');
  assert.equal(list.slice(0, 90).filter((x) => x.explore).length, 18);
  assert.equal(list.length, 200);
});

test('a pool of 30 or fewer cards has nothing outside the top 30: no exploration, the caps still hold', () => {
  const ranked = Array.from({ length: 30 }, (_, i) => ({ key: `k${i}`, trader: i % 3, symbol: `S${i}` }));
  const list = mixFeed(ranked, { day: '2026-10-23' });
  assert.equal(list.length, 6); // 3 traders, 2 each per 10 cards
  assert.ok(list.every((x) => !x.explore));
  assert.deepEqual(mixFeed([], { day: '2026-10-23' }), []);
});

// F-2 PR-1 fix round 1 (business lead blocker 2): exploration explores traders. A skewed fixture: 5 hyperactive traders
// (60 fresh closes each, small moves) and 55 ordinary ones (6 to 20 closes over 30 days, larger moves), scored like the
// feed (size of move × recency), at most 6 candidates per trader (lib/feed.ts#FEED_PER_TRADER), 200 candidates.
function skewed(seed: number) {
  const r = prng(seed);
  const all: (MixCard & { score: number })[] = [];
  for (let t = 0; t < 60; t++) {
    const hyper = t < 5, n = hyper ? 60 : 6 + Math.floor(r() * 15);
    for (let i = 0; i < n; i++) {
      const ageH = hyper ? r() * 20 : r() * 720, ret = hyper ? r() * 0.08 : r() * 0.25;
      all.push({ key: `${t}-${i}`, trader: t, symbol: `S${Math.floor(r() * 45)}`, score: Math.log1p(ret * 100) * Math.exp(-ageH / 48) });
    }
  }
  all.sort((a, b) => b.score - a.score);
  const per = new Map<MixCard['trader'], number>();
  return all.filter((c) => { const k = (per.get(c.trader) ?? 0) + 1; per.set(c.trader, k); return k <= 6; }).slice(0, 200);
}

// Fix round 2 (business lead, accepted): the criterion reads "≥ 80% of exploration picks are new traders while a new
// pool trader exists" (100% here). Over the whole list it cannot hold: by card ~120 every candidate trader is listed.
test('fix round 1: exploration picks a trader not yet in the list whenever one fits; ≥ 80% of exploration picks are new traders while a new pool trader exists (and in the first 4 pages)', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const ranked = skewed(seed);
    assert.ok(new Set(ranked.map((c) => c.trader)).size >= 33, 'the 200 candidates span ≥ 33 traders');
    const list = mixFeed(ranked, { day: DAYS[seed % DAYS.length] });
    const pool = ranked.slice(EXPLORE_TOP);
    let picks = 0, fresh = 0, whileNew = 0, freshWhileNew = 0;
    list.forEach((x, p) => {
      const before = list.slice(0, p).map((y) => y.card);
      const seen = new Set(before.map((y) => y.trader));
      const placed = new Set(before.map((y) => y.key));
      if (x.explore) {
        const freshFits = pool.some((q) => !placed.has(q.key) && !seen.has(q.trader) && fits(before, q));
        // A new trader whenever one fits; a trader already shown only when none does.
        assert.equal(!seen.has(x.card.trader), freshFits, `seed ${seed} slot ${p}`);
        if (p < 120) { picks++; if (!seen.has(x.card.trader)) fresh++; }
        if (pool.some((q) => !placed.has(q.key) && !seen.has(q.trader))) { whileNew++; if (!seen.has(x.card.trader)) freshWhileNew++; }
      }
    });
    assert.ok(fresh >= 0.8 * picks, `seed ${seed}: ${fresh} of ${picks} picks in the first 120 cards are new traders`);
    assert.ok(freshWhileNew >= 0.8 * whileNew, `seed ${seed}: ${freshWhileNew} of ${whileNew} picks made while a new pool trader exists are new traders`);
    // No trader holds more than 6 cards in any 30 (one page), joins included.
    for (let s = 0; s + 30 <= list.length; s++) {
      const n = new Map<MixCard['trader'], number>();
      for (const x of list.slice(s, s + 30)) n.set(x.card.trader, (n.get(x.card.trader) ?? 0) + 1);
      assert.ok(Math.max(...n.values()) <= 6, `seed ${seed} window ${s}`);
    }
  }
});

// Fix round 2 (business lead blocker): the first minute is not half five people. On the skewed fixture the 5 hyperactive
// traders held 27 to 30 of the first 60 cards (8 of 10 at worst) when only the previous card's trader was avoided.
test('fix round 2: on 50 skewed fixtures the 5 hyperactive traders hold ≤ 5 of any 10 cards and ≤ 28 of the first 60 (median ≤ 25); list length and exploration unchanged', () => {
  const first60: number[] = [];
  for (let seed = 1; seed <= 50; seed++) {
    const ranked = skewed(seed);
    const list = mixFeed(ranked, { day: DAYS[seed % DAYS.length] });
    const hyper = list.map((x) => (x.card.trader as number) < 5);
    for (let s = 0; s + 10 <= list.length; s++) assert.ok(hyper.slice(s, s + 10).filter(Boolean).length <= 5, `seed ${seed} window ${s}`);
    for (let s = 0; s + 30 <= list.length; s++) assert.ok(hyper.slice(s, s + 30).filter(Boolean).length <= 15, `seed ${seed} 30-window ${s}`);
    const n = hyper.slice(0, 60).filter(Boolean).length;
    assert.ok(n <= 28, `seed ${seed}: ${n} of the first 60`);
    first60.push(n);
    // Every pick slot still goes to a new trader while one fits (the exploration test checks it card by card); the list
    // keeps its length (the preference never ends it): 198 to 200 cards before and after.
    assert.ok(list.length >= 198, `seed ${seed}: ${list.length} cards`);
  }
  first60.sort((a, b) => a - b);
  assert.ok(first60[25] <= 25, `median ${first60[25]} of the first 60`);
  assert.ok(first60.filter((n) => n <= 27).length >= 49, `${first60.join(',')}`);
});

test('fix round 1: a trader appears twice in a row only when no other trader\'s card fits that slot', () => {
  const check = (ranked: MixCard[], label: string) => {
    const list = mixFeed(ranked, { day: '2026-10-23' });
    let repeats = 0;
    list.forEach((x, p) => {
      if (!p || x.card.trader !== list[p - 1].card.trader) return;
      repeats++;
      const before = list.slice(0, p).map((y) => y.card);
      const placed = new Set(before.map((y) => y.key));
      assert.ok(!ranked.some((q) => !placed.has(q.key) && q.trader !== x.card.trader && fits(before, q)), `${label} slot ${p}: another trader fits`);
    });
    return { list, repeats };
  };
  // The demo seed's shape: three traders, six closes each, interleaved by score.
  const demo = check(Array.from({ length: 18 }, (_, i) => ({ key: `d${i}`, trader: i % 3 === 2 && i > 9 ? 0 : i % 3, symbol: `S${i}` })), 'demo');
  assert.equal(demo.list.length, 6);
  assert.equal(demo.repeats, 0);
  // Ranked in blocks of one trader: the greedy rule defers the repeat to the end, where nothing else fits.
  check(Array.from({ length: 18 }, (_, i) => ({ key: `b${i}`, trader: Math.floor(i / 6), symbol: `S${i}` })), 'blocks');
  // One trader alone: twice in a row is all that fits, and the list still holds it (a preference, never a cap).
  assert.equal(check(Array.from({ length: 6 }, (_, i) => ({ key: `o${i}`, trader: 1, symbol: `S${i}` })), 'one').list.length, 2);
  // Generated feeds: no avoidable repeat anywhere (the property test checks the same rule card by card).
  for (let f = 0; f < 200; f++) check(generate(7000 + f, f % 4 ? 'realistic' : 'adversarial'), `feed ${f}`);
});

// F-2 PR-1b (business lead §5 items 1 and 3).
test('PR-1b discounted: each trader\'s best card keeps its rank order; the k-th card moves to (rank + 1) × 3^k; pure and sign-blind', async () => {
  const { discounted, CARD_DISCOUNT } = await import('./explore.ts');
  assert.equal(CARD_DISCOUNT, 2);
  const ranked = ['A', 'A', 'B', 'A', 'C', 'B', 'D', 'E', 'F', 'G'].map((trader, i) => ({ key: `k${i}`, trader, symbol: `S${i}` }));
  // keys: A1 1, A2 6, B1 3, A3 36, C1 5, B2 18, D 7, E 8, F 9, G 10
  assert.deepEqual(discounted(ranked).map((c) => c.key), ['k0', 'k2', 'k4', 'k1', 'k6', 'k7', 'k8', 'k9', 'k5', 'k3']);
  const firsts = (l: typeof ranked) => l.filter((c, i) => l.findIndex((d) => d.trader === c.trader) === i).map((c) => c.key);
  assert.deepEqual(firsts(discounted(ranked)), firsts(ranked));
  assert.deepEqual(discounted(ranked, 0), ranked);
  assert.deepEqual(discounted([]), []);
});

test('PR-1b extra pool: exploration slots reach traders outside the ranked list (new ones first); ranked slots never take them; caps hold', async () => {
  for (let seed = 1; seed <= 50; seed++) {
    const ranked = skewed(seed);
    const extra = Array.from({ length: 40 }, (_, i) => ({ key: `x${i}`, trader: 1000 + i, symbol: `X${i}`, score: 0 }));
    const list = mixFeed(ranked, { day: DAYS[seed % DAYS.length], extra });
    const ex = new Set(extra.map((c) => c.key));
    list.forEach((x) => { if (ex.has(x.card.key)) assert.ok(x.explore, `seed ${seed}: an extra card in a ranked slot`); });
    const w = worstWindow(list.map((x) => x.card));
    assert.ok(w.trader <= 2 && w.symbol <= 2);
    const reached = new Set(list.slice(0, 120).filter((x) => ex.has(x.card.key)).map((x) => x.card.trader));
    assert.ok(reached.size >= 5, `seed ${seed}: ${reached.size} outside traders in the first 120`);
    // Every exploration pick in the first 120 is a trader new to the list (the pool still has new ones).
    const seen = new Set<MixCard['trader']>();
    for (const x of list.slice(0, 120)) { if (x.explore) assert.ok(!seen.has(x.card.trader), `seed ${seed}`); seen.add(x.card.trader); }
    // Without extra the list is exactly PR-1's.
    assert.deepEqual(mixFeed(ranked, { day: DAYS[seed % DAYS.length], extra: [] }), mixFeed(ranked, { day: DAYS[seed % DAYS.length] }));
  }
});

test('PR-1b: on 50 skewed fixtures, the discounted ranking breaks the hyperactive cycle (no 3-trader run repeats in the first 60 on most) and keeps PR-1\'s pinned shares', async () => {
  const { discounted } = await import('./explore.ts');
  const runs = (l: MixCard['trader'][]) => { const s = new Set<string>(); let rep = 0; for (let i = 0; i + 3 <= l.length; i++) { const k = l.slice(i, i + 3).join(); if (s.has(k)) rep++; s.add(k); } return rep; };
  let before = 0, after = 0;
  for (let seed = 1; seed <= 50; seed++) {
    const ranked = skewed(seed), day = DAYS[seed % DAYS.length];
    const old = mixFeed(ranked, { day }), now = mixFeed(discounted(ranked), { day });
    if (runs(old.slice(0, 60).map((x) => x.card.trader))) before++;
    if (runs(now.slice(0, 60).map((x) => x.card.trader))) after++;
    const w = worstWindow(now.map((x) => x.card));
    assert.ok(w.trader <= 2 && w.symbol <= 2);
    assert.ok(now.slice(0, 60).filter((x) => (x.card.trader as number) < 5).length <= 27, `seed ${seed}`);
    assert.ok(now.length >= 198);
  }
  console.log(`# discount: fixtures with a repeated 3-trader run in the first 60: ${before} of 50 before, ${after} of 50 after`);
  assert.ok(after <= 2 && after < before, `${after} of 50`);
});
