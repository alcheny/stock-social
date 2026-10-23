// F-2 PR-1 (criterion 6): at least 2 of every 10 feed cards are exploration picks.
// Pure (lib/discovery/imports.test.ts): the same list for every viewer, signed in or out, seeded by the UTC day only.
// - Exploration picks come from the eligible pool outside the top EXPLORE_TOP of the ranking (which is where "too
//   early to tell" records rank), in a seeded shuffle. No propensity is recorded.
// - One slot in every EXPLORE_EVERY is an exploration slot, at a seeded phase: any 10 consecutive slots hold exactly
//   2 of them, so the guarantee holds over every window, page joins included, not only aligned ones.
// - Every slot obeys the diversity caps (./diversity.ts#fits). A ranked slot takes the best-ranked card that fits
//   (any rank: past the top the list stays in rank order). An exploration slot takes the first fitting card of the
//   shuffled pool; if none fits, the best-ranked fitting card (so that window holds one pick fewer). When nothing fits,
//   the list ends: a cap is never relaxed.
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

export function mixFeed<T extends MixCard>(ranked: readonly T[], opts: { day: string; caps?: Caps; top?: number; every?: number }): Mixed<T>[] {
  const { caps = FEED_CAPS, top = EXPLORE_TOP, every = EXPLORE_EVERY } = opts;
  const rand = prng(daySeed(opts.day));
  const phase = Math.floor(rand() * every);
  const pool = ranked.slice(top);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const used = new Set<T>();
  const out: Mixed<T>[] = [];
  const placed: T[] = [];
  const take = (from: readonly T[]) => from.find((c) => !used.has(c) && fits(placed, c, caps)) ?? null;
  for (let slot = 0; ; slot++) {
    const exploreSlot = slot % every === phase;
    const picked = exploreSlot ? take(pool) : null;
    const card = picked ?? take(ranked);
    if (!card) return out;
    used.add(card);
    placed.push(card);
    out.push({ card, explore: !!picked, exploreSlot });
  }
}
