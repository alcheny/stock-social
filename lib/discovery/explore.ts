// F-2 PR-1 (criterion 6): at least 2 of every 10 feed cards are exploration picks.
// Pure (lib/discovery/imports.test.ts): the same list for every viewer, signed in or out, seeded by the UTC day only.
// - Exploration picks come from the eligible pool outside the top EXPLORE_TOP of the ranking (which is where "too
//   early to tell" records rank), in a seeded shuffle. No propensity is recorded.
// - One slot in every EXPLORE_EVERY is an exploration slot, at a seeded phase: any 10 consecutive slots hold exactly
//   2 of them, so the guarantee holds over every window, page joins included, not only aligned ones.
// - Every slot obeys the diversity caps (./diversity.ts#fits). A ranked slot takes the best-ranked card that fits
//   (any rank: past the top the list stays in rank order). An exploration slot takes a card from the pool; if none
//   fits, the best-ranked fitting card (so that window holds one pick fewer). When nothing fits, the list ends: a cap
//   is never relaxed.
// - F-2 PR-1 fix round 1 (business lead blocker 2): exploration explores traders, not closes. The pool's traders are
//   shuffled (seeded), each trader once however many of its closes are in the pool; an exploration slot takes the
//   best-ranked fitting card of the first trader in that order not yet placed in the list, and only when none of
//   those fits, of a trader already placed.
// - F-2 PR-1 fix round 1 (UX follow-up 6): every slot prefers a card whose trader differs from the previous card's,
//   within the same rule (the best-ranked such card); only when no other card fits does a trader appear twice in a
//   row. A preference, never a cap: it never ends the list.
// - F-2 PR-1 fix round 2 (business lead blocker): every slot first prefers a card whose trader is not among the last
//   window − 1 (9) cards, then one whose trader is not the previous card's, then any, each the best-ranked such card that
//   fits. Before, hyperactive traders (many fresh small moves, ranked high) filled their 2-per-10 allowance in every
//   window: 29 of the first 60 cards on the skewed fixture, 8 of 10 at worst. Still a preference, never a cap: it never
//   ends the list, and exploration is unchanged (a trader new to the list is never among the last 9).
// - It never reads a return (sign or size): it orders by the ranking it is given.
// A pool of EXPLORE_TOP cards or fewer has nothing outside the top to explore, so that feed has no exploration.
import { fits, FEED_CAPS, type Caps, type MixCard } from './diversity.ts';

export const EXPLORE_TOP = 30;
export const EXPLORE_EVERY = 5;

// FNV-1a over the day string, then mulberry32: small, fast, reproducible on any runtime.
export function daySeed(day: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < day.length; i++) h = Math.imul(h ^ day.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Mixed<T> = { card: T; explore: boolean; exploreSlot: boolean };

// The first card of `from` (in its order) that is unused and fits, preferring one whose trader is not among the last
// caps.window − 1 placed cards, then one whose trader is not the previous card's (fix round 2).
export function pick<T extends MixCard>(from: readonly T[], used: ReadonlySet<T>, placed: readonly T[], caps: Caps = FEED_CAPS): T | null {
  const prev = placed.length ? placed[placed.length - 1].trader : undefined;
  const recent = new Set(placed.slice(-(caps.window - 1)).map((c) => c.trader));
  let notPrev: T | null = null, any: T | null = null;
  for (const c of from) {
    if (used.has(c) || !fits(placed, c, caps)) continue;
    if (!recent.has(c.trader)) return c;
    if (c.trader !== prev) notPrev ??= c;
    else any ??= c;
  }
  return notPrev ?? any;
}

export function mixFeed<T extends MixCard>(ranked: readonly T[], opts: { day: string; caps?: Caps; top?: number; every?: number }): Mixed<T>[] {
  const { caps = FEED_CAPS, top = EXPLORE_TOP, every = EXPLORE_EVERY } = opts;
  const rand = prng(daySeed(opts.day));
  const phase = Math.floor(rand() * every);
  // The pool by trader: each trader's pool cards in rank order; the traders in a seeded shuffle.
  const byTrader = new Map<T['trader'], T[]>();
  for (const c of ranked.slice(top)) { const a = byTrader.get(c.trader); if (a) a.push(c); else byTrader.set(c.trader, [c]); }
  const traders = [...byTrader.keys()];
  for (let i = traders.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [traders[i], traders[j]] = [traders[j], traders[i]]; }
  const pool = traders.map((t) => byTrader.get(t)!);
  const used = new Set<T>();
  const seen = new Set<T['trader']>();
  const out: Mixed<T>[] = [];
  const placed: T[] = [];
  const explore = (): T | null => {
    // Traders not yet in the list first, then the rest, each in the shuffled order; within a trader, rank order.
    for (const fresh of [true, false]) {
      let fallback: T | null = null;
      for (const cards of pool) {
        if (seen.has(cards[0].trader) !== !fresh) continue;
        const c = pick(cards, used, placed, caps);
        if (!c) continue;
        if (c.trader !== placed[placed.length - 1]?.trader) return c;
        fallback ??= c;
      }
      if (fallback) return fallback;
    }
    return null;
  };
  for (let slot = 0; ; slot++) {
    const exploreSlot = slot % every === phase;
    const picked = exploreSlot ? explore() : null;
    const card = picked ?? pick(ranked, used, placed, caps);
    if (!card) return out;
    used.add(card);
    seen.add(card.trader);
    placed.push(card);
    out.push({ card, explore: !!picked, exploreSlot });
  }
}
