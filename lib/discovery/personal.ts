// F-2 PR-5 (criteria 1, 2, 4, 7, 8, 11): personal ordering of traders and closed records to read (POLICY F1a). Pure: it
// reads only what it is given (lib/discovery/personal.test.ts walks its imports). The loader is ./personal-load.ts.
// - The profile is computed on read from the viewer's own choices and (only with "Personalize with my activity" On) their
//   activity log, made at or before the feed session's asOf and within FADE_DAYS of it. Nothing derived is stored.
// - Every choice and event fades linearly to nothing over FADE_DAYS (owner 2026-11-01: likes and rejects affect ordering
//   for 90 days, fading). A follow counts while it stands.
// - It never reads a return: not its sign, not its size. A viewer who reads only losing records gets traders like those,
//   exactly as one who reads only gains (sign invariance, tested).
// - It orders traders and records to read; it never names, ranks or scores a security. Symbols enter only as a
//   similarity between records the viewer read and a trader's records; no reason line carries a ticker.
// - The watchlist is never an input (owner 2026-11-01).
import { WEIGHTS, IMPLICIT, FOLLOW_BONUS } from './weights.ts';
import { mixFeed, type Mixed } from './explore.ts';
import { holdBucket, type SectionTrader } from './section.ts';
import type { MixCard } from './diversity.ts';

export const FADE_DAYS = 90;
const DAY_MS = 86_400_000;
export const SIM_WEIGHT = 0.6;
export const BOOST = 0.5;
export const DIRECT_MIN = -4;
export const DIRECT_MAX = 6;

// The fading factor: 1 at the moment it was made, 0 at FADE_DAYS and after (and for anything dated after `now`).
export const fade = (at: number, now: number): number => {
  const age = now - at;
  return age < 0 ? 0 : Math.max(0, 1 - age / (FADE_DAYS * DAY_MS));
};

// The viewer's inputs, as the loader reads them. `symbol`: the close's symbol when it still exists.
export type Choice = { trader: number; at: number; symbol?: string | null };
export type Inputs = {
  follows: readonly number[];
  likes: readonly Choice[];
  rejects: readonly Choice[]; // rejected trades: the trade stays hidden for good; −4 on its trader fades over 90 days
  hidden: readonly Choice[]; // running "Not interested": the trader is hidden; −4 also lowers similar records
  unfollows: readonly Choice[];
  events: readonly { type: number; trader: number | null; symbol: string | null; at: number }[];
  activity?: boolean; // the events were read (activity On)
};
export type Profile = {
  direct: Map<number, number>; // per trader, faded and clamped
  symbols: Map<string, number>; // what the viewer read, by symbol, faded (similarity only; never shown)
  follows: Set<number>;
  liked: number[]; // traders of liked trades in the window, newest first (for "Similar holding period to @x")
  seen: Set<number>; // traders with any logged event in the window (activity On only), for "New to you"
  activity: boolean; // events were read (the activity switch is On)
  signals: number; // inputs that count now (> 0: the order line and "More like what you read")
  uses: Uses; // which kinds of input count now (the order line names only those)
};
export type Uses = { follows: boolean; likes: boolean; hides: boolean; activity: boolean };
export const EMPTY_INPUTS: Inputs = { follows: [], likes: [], rejects: [], hidden: [], unfollows: [], events: [] };

export function viewerProfile(i: Inputs, now: number): Profile {
  const direct = new Map<number, number>(), symbols = new Map<string, number>(), seen = new Set<number>();
  let signals = i.follows.length;
  const uses: Uses = { follows: i.follows.length > 0, likes: false, hides: false, activity: false };
  const add = (c: { trader: number | null; symbol?: string | null; at: number }, w: number, kind?: keyof Uses) => {
    const f = fade(c.at, now);
    if (!f || !w) return;
    signals++;
    if (kind) uses[kind] = true;
    if (c.trader !== null) direct.set(c.trader, (direct.get(c.trader) ?? 0) + w * f);
    if (c.symbol) symbols.set(c.symbol, (symbols.get(c.symbol) ?? 0) + w * f);
  };
  for (const c of i.likes) add(c, WEIGHTS.like, 'likes');
  for (const c of i.rejects) add(c, WEIGHTS.notInterested, 'hides');
  for (const c of i.hidden) add(c, WEIGHTS.notInterested, 'hides');
  for (const c of i.unfollows) add(c, WEIGHTS.unfollow); // counts, but names no kind in the order line ("choices")
  for (const e of i.events) {
    if (e.trader !== null && fade(e.at, now)) seen.add(e.trader);
    add(e, IMPLICIT[e.type] ?? 0, 'activity');
  }
  for (const [t, v] of direct) direct.set(t, Math.min(DIRECT_MAX, Math.max(DIRECT_MIN, v)));
  const liked = [...new Set([...i.likes].filter((c) => fade(c.at, now) > 0).sort((a, b) => b.at - a.at).map((c) => c.trader))];
  return { direct, symbols, follows: new Set(i.follows), liked, seen, activity: !!i.activity, signals, uses };
}

// What the ordering knows of each candidate trader: their holding bucket and the symbols of their listed closes.
export type TraderShape = { hold?: number; symbols: ReadonlySet<string> };

// Relevance of trader `t` for this viewer: direct + 0.6·cos(symbols) + 0.6·cos(holding) + follow bonus.
// The holding vector is built from the viewer's direct affinities, by each trader's holding bucket.
export function relevanceOf(p: Profile, shapes: ReadonlyMap<number, TraderShape>): (t: number) => number {
  const hold = [0, 0, 0, 0, 0];
  for (const [t, v] of p.direct) { const s = shapes.get(t); if (s?.hold !== undefined) hold[holdBucket(s.hold)] += v; }
  for (const t of p.follows) { const s = shapes.get(t); if (s?.hold !== undefined) hold[holdBucket(s.hold)] += FOLLOW_BONUS; }
  const holdNorm = Math.hypot(...hold);
  let symNorm = 0;
  for (const v of p.symbols.values()) symNorm += v * v;
  symNorm = Math.sqrt(symNorm);
  const memo = new Map<number, number>();
  return (t) => {
    let r = memo.get(t);
    if (r !== undefined) return r;
    const s = shapes.get(t);
    r = p.direct.get(t) ?? 0;
    if (p.follows.has(t)) r += FOLLOW_BONUS;
    if (s?.hold !== undefined && holdNorm > 0) r += SIM_WEIGHT * (hold[holdBucket(s.hold)] / holdNorm);
    if (s && s.symbols.size && symNorm > 0) {
      let dot = 0;
      for (const sym of s.symbols) dot += p.symbols.get(sym) ?? 0;
      r += SIM_WEIGHT * (dot / (symNorm * Math.sqrt(s.symbols.size)));
    }
    memo.set(t, r);
    return r;
  };
}

// The personal order of the ranked list (TR-9 order, before the mix): each card's position key is its rank divided by
// (1 + BOOST·rel) when its trader's relevance is positive, multiplied by (1 + BOOST·|rel|) when negative; ties keep rank
// order. Then the same mix as everyone's (caps and seeded exploration): the caps hold for every viewer.
export function personalOrder<T extends MixCard & { trader: number }>(ranked: readonly T[], rel: (t: number) => number): T[] {
  return ranked.map((c, i) => {
    const r = rel(c.trader);
    return { c, i, key: (i + 1) * (r >= 0 ? 1 / (1 + BOOST * r) : 1 + BOOST * -r) };
  }).sort((a, b) => a.key - b.key || a.i - b.i).map((x) => x.c);
}
export function personalList<T extends MixCard & { trader: number }>(ranked: readonly T[], rel: (t: number) => number, day: string, extra: readonly T[] = []): Mixed<T>[] {
  return mixFeed(personalOrder(ranked, rel), { day, extra });
}

// The section's pool for this viewer: the most relevant first (ties keep the TR-9 lower-bound order), and the section
// then shows its rows in evidence order (lib/discovery/section.ts#chooseRows).
export const SECTION_PICK = 20;
export function personalPool(pool: readonly SectionTrader[], rel: (t: number) => number): SectionTrader[] {
  const scored = pool.map((t, i) => ({ t, i, r: rel(t.trader) }));
  const picked = scored.filter((x) => x.r > 0).sort((a, b) => b.r - a.r || a.i - b.i).slice(0, SECTION_PICK);
  const set = new Set(picked.map((x) => x.t.trader));
  return [...picked.map((x) => x.t), ...scored.filter((x) => !set.has(x.t.trader)).map((x) => x.t)];
}

// A row's reason, a fact about the trader's record or the viewer's own actions (POLICY F1a), never a security:
// - 'similarHold': a trader the viewer follows or liked (`handle`) has the same typical holding period;
// - 'symbolsRead': the trader's listed records share a symbol with records the viewer read or liked (no ticker shown);
// - 'newToYou': only with activity On, nothing of this trader's is in the viewer's signals or logged reading;
// - otherwise the impersonal holding-period line.
export type PersonalReason = { kind: 'similarHold'; handle: string } | { kind: 'symbolsRead' } | { kind: 'newToYou' };
export function personalReason(t: number, p: Profile, shapes: ReadonlyMap<number, TraderShape>, handles: ReadonlyMap<number, string>): PersonalReason | null {
  const s = shapes.get(t);
  if (s?.hold !== undefined) {
    const b = holdBucket(s.hold);
    // Engineer demand 5: only traders the viewer follows or liked (a like newest first), never an implicit signal.
    for (const x of [...p.follows, ...p.liked]) {
      const xs = shapes.get(x), h = handles.get(x);
      if (x !== t && h && xs?.hold !== undefined && holdBucket(xs.hold) === b) return { kind: 'similarHold', handle: h };
    }
  }
  if (s) for (const sym of s.symbols) if ((p.symbols.get(sym) ?? 0) > 0) return { kind: 'symbolsRead' };
  if (p.activity && !p.direct.has(t) && !p.follows.has(t) && !p.seen.has(t)) return { kind: 'newToYou' };
  return null;
}
