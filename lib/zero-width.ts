// FIXES-CYCLE5 part 2 (C5-4; legal committee 2026-11-02 §3c, C9-C13): the one zero-width rule. A 95% range whose two
// ends print as the same text ("+1.0% to +1.0%") is an artefact of near-identical returns, not evidence, so every surface
// that prints a range or a verdict prints "Too early to tell" instead and carries no verdict. Decided at printed
// precision (C9): the surface passes the `digits` its own pct() call uses. Symmetric (C10): gains and losses alike.
// Display only (C13): ranking (confidence(), confidenceFromSums, evidenceWeight, lib/feed.ts) never calls this.
// F-33 later owns the printed range and builds on this file instead of adding a second rule.
// Imports: none of these modules imports trades.ts at runtime, so there is no cycle.
import { pct } from './format.ts';
import { MIN_BETS } from './confidence.ts';
import { RECORD_STRIP } from './copy.ts';
import type { Confidence } from './trades.ts';

type Ends = { low: number; high: number };

/** True when the range's two ends print the same with pct(·, digits). */
export const zeroWidth = (iv: Ends | null | undefined, digits = 1): boolean => !!iv && pct(iv.low, digits) === pct(iv.high, digits);

/** The evidence a surface prints: a zero-width range is dropped with its verdict (tier 'too-early', no edge). Idempotent;
 *  a record whose range is not zero-width comes back as the same object. */
export function shownEvidence<C extends Pick<Confidence, 'perTrade' | 'edge' | 'tier'>>(c: C, digits = 1): C & { zeroWidth?: true } {
  return zeroWidth(c.perTrade, digits) ? { ...c, perTrade: null, edge: null, tier: 'too-early', zeroWidth: true } : c;
}

/** The range slot's fallback when no range prints: the bet count only while it is under the floor. */
export const earlyText = (k: number): string => (k < MIN_BETS ? `${RECORD_STRIP.early} (${k} of ${MIN_BETS} bets)` : RECORD_STRIP.early);

/** "(low to high)" for a range, or null when there is none or it is zero-width (the caller prints its early wording). */
export const rangePair = (iv: Ends | null | undefined, digits = 1): string | null =>
  iv && !zeroWidth(iv, digits) ? `(${pct(iv.low, digits)} to ${pct(iv.high, digits)})` : null;
