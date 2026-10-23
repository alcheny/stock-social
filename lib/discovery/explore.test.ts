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
    // than the previous card's when one fits; the previous card's trader only when no other card fits.
    const rank = new Map(ranked.map((x, i) => [x.key, i]));
    list.forEach((x, p) => {
      if (x.explore) { assert.ok(x.exploreSlot && rank.get(x.card.key)! >= EXPLORE_TOP, `feed ${f}: explore pick`); return; }
      const before = list.slice(0, p).map((y) => y.card);
      const placed = new Set(before.map((y) => y.key));
      const prev = before[before.length - 1]?.trader;
      const best = ranked.find((q) => !placed.has(q.key) && fits(before, q) && q.trader !== prev) ?? ranked.find((q) => !placed.has(q.key) && fits(before, q));
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

test('fix round 1: exploration picks a trader not yet in the list whenever one fits; ≥ 80% of picks in the first 4 pages are new traders', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const ranked = skewed(seed);
    assert.ok(new Set(ranked.map((c) => c.trader)).size >= 33, 'the 200 candidates span ≥ 33 traders');
    const list = mixFeed(ranked, { day: DAYS[seed % DAYS.length] });
    const pool = ranked.slice(EXPLORE_TOP);
    let picks = 0, fresh = 0;
    list.forEach((x, p) => {
      const before = list.slice(0, p).map((y) => y.card);
      const seen = new Set(before.map((y) => y.trader));
      const placed = new Set(before.map((y) => y.key));
      if (x.explore) {
        const freshFits = pool.some((q) => !placed.has(q.key) && !seen.has(q.trader) && fits(before, q));
        // A new trader whenever one fits; a trader already shown only when none does.
        assert.equal(!seen.has(x.card.trader), freshFits, `seed ${seed} slot ${p}`);
        if (p < 120) { picks++; if (!seen.has(x.card.trader)) fresh++; }
      }
    });
    assert.ok(fresh >= 0.8 * picks, `seed ${seed}: ${fresh} of ${picks} picks in the first 120 cards are new traders`);
    // No trader holds more than 6 cards in any 30 (one page), joins included.
    for (let s = 0; s + 30 <= list.length; s++) {
      const n = new Map<MixCard['trader'], number>();
      for (const x of list.slice(s, s + 30)) n.set(x.card.trader, (n.get(x.card.trader) ?? 0) + 1);
      assert.ok(Math.max(...n.values()) <= 6, `seed ${seed} window ${s}`);
    }
  }
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
