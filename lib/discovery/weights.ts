// F-2: the owner's signal weights (design session 2026-10-22, restored 2026-10-23 in the feature file). Pinned here
// so every PR reads the same numbers. PR-2 stores the explicit choices (follows, exclusions); PR-5 turns them into a
// ranking with these weights. "Not interested" and the reject swipe (PR-4) are one negative action: the same −4 and
// the same EXCLUSION_DAYS exclusion. Pure (lib/discovery/imports.test.ts).
export const WEIGHTS = {
  like: 3, // double tap, private (PR-4)
  swipeOpen: 2, // the opening swipe to the pane (SW-1)
  notInterested: -4, // "Not interested" (PR-2), the section reject swipe (PR-3) and a feed card's trade reject (PR-4)
  // PR-4 (O4, business lead ruling, committee-pr1b §5): a slight negative preference on the trader, signed in only, never
  // a hide; it ages out at UNFOLLOW_DAYS.
  unfollow: -1,
} as const;

// PR-4 (O3, committee recommendation): a rejected trade stays hidden for good (a trade_exclusions row); the trader-level
// −4 the reject also carries counts for this long, like a hidden trader's "Not interested".
export const TRADE_REJECT_TRADER_DAYS = 90;
export const UNFOLLOW_DAYS = 90;

// PR-4: one viewer's stored choices about a trader, as PR-5 will read them. `at`: when it was made (ms).
export type Signal = { trader: number; kind: 'like' | 'tradeReject' | 'unfollow'; at: number };
const DAY_MS = 86_400_000;

// The viewer's preference per trader from those choices: +3 per like, −4 per rejected trade (for 90 days), −1 for an
// unfollow (for 90 days). Stored and computed now; nothing shown uses it before PR-5 (the scoring waits for counsel, H1).
export function traderPreference(signals: readonly Signal[], now: number): Map<number, number> {
  const out = new Map<number, number>();
  for (const s of signals) {
    const w = s.kind === 'like' ? WEIGHTS.like
      : s.kind === 'tradeReject' ? (now - s.at < TRADE_REJECT_TRADER_DAYS * DAY_MS ? WEIGHTS.notInterested : 0)
      : now - s.at < UNFOLLOW_DAYS * DAY_MS ? WEIGHTS.unfollow : 0;
    if (w) out.set(s.trader, (out.get(s.trader) ?? 0) + w);
  }
  return out;
}

// O3 default (plan §3): 90 days. The Undo line says "Hidden for 90 days."; the copy changes with this constant.
export const EXCLUSION_DAYS = 90;

// Fix round 1 (committee, owner may reverse): the feed honors only "Not interested". An unfollow still writes its
// 90-day 'unfollow' row; since PR-4 (O4) it is the −1 signal only: neither the feed nor the section hides the trader.
// true restores the plan's reading (unfollow also hides from the feed and lists the trader as hidden).
export const FEED_HIDES_UNFOLLOWED = false;
