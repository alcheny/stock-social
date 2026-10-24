// F-2 PR-2 (plan demand B): a hide between pages. 1,000 seeded feeds: no card repeats, every card but the hidden
// trader's stays in the same relative order, the hidden trader appears nowhere after the hide, every 10-card window
// obeys the stated bound (4 after one hide, 6 after two, 8 after three), and the next page 1 obeys the caps exactly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mixFeed, prng } from './explore.ts';
import { worstWindow, type MixCard } from './diversity.ts';
import { decodeCursor, encodeCursor, firstPage, pageOf, type Cursor } from './pager.ts';
import { displayFilter, shapeList, splitExclusions, type ExclusionRow } from './exclusions.ts';
import { EXCLUSION_DAYS, WEIGHTS } from './weights.ts';

const DAY_MS = 86_400_000;
function generate(seed: number): MixCard[] {
  const r = prng(seed);
  const n = 90 + Math.floor(r() * 111), traders = 15 + Math.floor(r() * 50), symbols = 10 + Math.floor(r() * 40);
  const skew = (k: number) => Math.min(k - 1, Math.floor(k * r() ** 1.6));
  return Array.from({ length: n }, (_, i) => ({ key: `c${i}`, trader: skew(traders), symbol: `S${skew(symbols)}` }));
}
const DAYS = ['2026-10-23', '2026-10-24', '2027-01-01', '2026-02-28'];

test('the owner\'s weights are pinned: "not interested" is −4 (the reject swipe\'s weight), like +3, opening swipe +2, unfollow −1 (F-2 PR-4, O4); exclusions last 90 days', () => {
  assert.deepEqual({ ...WEIGHTS }, { like: 3, swipeOpen: 2, notInterested: -4, unfollow: -1 });
  assert.equal(EXCLUSION_DAYS, 90);
});

test('splitExclusions: made by asOf and running at asOf shapes; made after asOf and running now filters; ended or purged rows change nothing for a same-day cursor', () => {
  const asOf = Date.parse('2026-10-23T09:00:00Z'), now = asOf + 3_600_000;
  const rows: ExclusionRow[] = [
    { trader: 1, createdAt: asOf - 1000, until: asOf + EXCLUSION_DAYS * DAY_MS }, // shaping
    { trader: 2, createdAt: asOf + 1000, until: asOf + EXCLUSION_DAYS * DAY_MS }, // hidden mid-session
    { trader: 3, createdAt: asOf + 1000, until: asOf + 2000 }, // hidden, then undone: shown again
    { trader: 4, createdAt: asOf - 5 * DAY_MS, until: asOf - 1000 }, // ended before asOf
  ];
  const base = splitExclusions(rows, asOf, now);
  assert.deepEqual([...base.shaping], [1]);
  assert.deepEqual([...base.hidden], [2]);
  // Undo / "Show again" on the shaping row after asOf (until = now): the cursor's list is unchanged.
  const ended = rows.map((r) => (r.trader === 1 ? { ...r, until: now } : r));
  assert.deepEqual([...splitExclusions(ended, asOf, now + 1).shaping], [1]);
  // A row ended over a day ago is purged mid-day: nothing a same-day cursor reads changes.
  const purged = rows.filter((r) => r.trader !== 4);
  assert.deepEqual(splitExclusions(purged, asOf, now), base);
  // Boundary: excluded at 89 d 23 h 59 m, back at 90 d + 1 s.
  const made = asOf - 1000, until = made + EXCLUSION_DAYS * DAY_MS;
  assert.ok(splitExclusions([{ trader: 9, createdAt: made, until }], until - 60_000, until - 60_000).shaping.has(9));
  assert.equal(splitExclusions([{ trader: 9, createdAt: made, until }], until + 1000, until + 1000).shaping.size, 0);
});

test('property, 1,000 seeded feeds, a hide between pages 1 and 2 (and after the trader\'s cards were rendered on page 1): no repeat, order kept, hidden trader gone, stated bound per window, next page 1 exact', () => {
  let rendered = 0, checked = 0;
  for (let f = 0; f < 1000; f++) {
    const ranked = generate(f + 7);
    const day = DAYS[f % DAYS.length];
    const asOf = Date.parse(`${day}T12:00:00Z`);
    const list = shapeList(ranked, new Set(), day);
    assert.deepEqual(list, mixFeed(ranked, { day }), 'no exclusions: the impersonal list');
    const first90 = list.slice(0, 90).map((x) => x.card);
    const page1 = pageOf(list, firstPage(asOf));
    if (!page1.next) continue;
    // Hide k traders who have cards on pages 2 to 3; even feeds pick ones already rendered on page 1.
    const k = [1, 1, 1, 2, 3][f % 5];
    const onP1 = new Set(page1.items.map((x) => x.card.trader));
    const later = [...new Set(first90.slice(30).map((c) => c.trader))];
    const pref = later.filter((t) => onP1.has(t) === (f % 2 === 0));
    const hides = [...pref, ...later.filter((t) => !pref.includes(t))].slice(0, k);
    if (hides.length < k) continue;
    if (hides.some((t) => onP1.has(t))) rendered++;
    const rows: ExclusionRow[] = hides.map((trader) => ({ trader: trader as number, createdAt: asOf + 1000, until: asOf + 1000 + EXCLUSION_DAYS * DAY_MS }));
    const now = asOf + 2000;
    const { shaping, hidden } = splitExclusions(rows, asOf, now);
    assert.equal(shaping.size, 0);
    // Page 1 as displayed after the hide (the client collapses the hidden trader's rendered cards), then pages 2 and 3.
    const shown = displayFilter(page1.items.map((x) => x.card), hidden);
    let c: Cursor | null = decodeCursor(encodeCursor(page1.next), now, 200);
    for (let p = 0; p < 2 && c; p++) {
      const page = pageOf(shapeList(ranked, shaping, day), c);
      shown.push(...displayFilter(page.items.map((x) => x.card), hidden));
      c = page.next && decodeCursor(encodeCursor(page.next), now, 200);
    }
    assert.equal(new Set(shown.map((x) => x.key)).size, shown.length, `feed ${f}: a card repeats`);
    assert.deepEqual(shown.map((x) => x.key), first90.filter((x) => !hidden.has(x.trader as number)).map((x) => x.key), `feed ${f}: order or membership changed`);
    assert.ok(shown.every((x) => !hidden.has(x.trader as number)), `feed ${f}: the hidden trader appears`);
    const w = worstWindow(shown);
    assert.ok(w.trader <= 2 + 2 * k && w.symbol <= 2 + 2 * k, `feed ${f}, ${k} hide(s): ${JSON.stringify(w)}`);
    // The viewer's next page 1 (a new asOf): the hide shapes the list and the caps hold exactly.
    const next = splitExclusions(rows, now + 1000, now + 1000);
    assert.deepEqual([...next.shaping].sort(), [...hides].sort());
    const list2 = shapeList(ranked, next.shaping, day).map((x) => x.card);
    const w2 = worstWindow(list2);
    assert.ok(w2.trader <= 2 && w2.symbol <= 2, `feed ${f}: next page 1 ${JSON.stringify(w2)}`);
    assert.ok(list2.every((x) => !hides.includes(x.trader as number)));
    checked++;
  }
  assert.ok(checked >= 900, `${checked} feeds checked`);
  assert.ok(rendered >= 300, `${rendered} feeds hid a trader already rendered on page 1`);
});
