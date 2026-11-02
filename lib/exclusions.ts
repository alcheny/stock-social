// F-21 · Exclusion counts beside the headline (docs/features/F-21-exclusion-counts-beside-the-headline.md; committee
// docs/features/logs/F-21/committee-2026-11-02.md, decisions 1-14, and the legal committee's conditions R1-R6).
// The one function that sums a record's exclusions for the profile's #excluded section, the pane line and the record
// strip line, and the profile's per-reason lines as data. Pure: stored counters in, numbers and copy out (no db import),
// so every surface gets the same number. Every exclusion counter the record keeps is classified here, summed or named
// as deliberately left out with its reason; lib/f21-exclusions.test.ts fails on a counter that is neither.
import { OPTIONS, PROFILE, PUBLIC, EXCLUSIONS } from './copy.ts';
import { closesOf, openOf, type OptionCounts } from './options-view.ts';
import type { Cause } from './options.ts';
import type { PublicReason } from './public-trades.ts';

// The users counters the share side of the sum reads (stored columns only, no per-request scan).
export type ShareCounts = {
  excluded_positions: number; excluded_future_sells: number; excluded_corporate: number; excluded_held: number; excluded_shared: number;
  excluded_transfer: number; // F-32 Part A
};
export type ExclusionInput = ShareCounts & {
  public?: Record<string, number> | null; // public_filers.excluded for an F-7 record
  options: OptionCounts; gate: 'open' | 'closed';
};
export type Reason = { key: string; n: number; text: string };

type Kind = { summed: true; why: string } | { summed: false; why: string };
const summed = (why: string): Kind => ({ summed: true, why });
const left = (why: string): Kind => ({ summed: false, why });

/** Every exclusion counter on users, summed or left out with the reason. */
export const COUNTERS = {
  excluded_positions: summed('sells with no recorded entry'),
  excluded_future_sells: summed('sells dated in the future by the broker'),
  excluded_future: left('counts buys too; its sell part is excluded_future_sells (cycle-5 unit rule: sells and option closes only)'),
  // F-35: option rows dated after now(), opens and closes alike: not classed as closes until matched, so never in the sum.
  excluded_future_options: left('option rows dated in the future, opens and closes alike; not a close until its date passes and it is matched (F-35)'),
  excluded_corporate: summed('sells a share move, corporate action or unusable broker row touches (F3-1 rows included)'),
  excluded_held: summed('sells counted while a possible re-issue in their pair is checked (F-24)'),
  excluded_transfer: summed('sells a share transfer row excludes (F-32 Part A, its own reason)'),
  excluded_shared: summed('sells and option closes in accounts marked as another profile\'s'),
  excluded_options_short: summed('closed short options (R2: every option close counts)'),
  excluded_options_other: summed('option closes the importer cannot price exactly (R2)'),
  excluded_exercise_shares: summed('share trades held over an exercise or assignment day, once (R2)'),
} as const satisfies Record<string, Kind>;
export type Counter = keyof typeof COUNTERS;

/** What is deliberately not a trade exclusion, with the reason. */
export const NOT_EXCLUSIONS = {
  paper: 'whole simulated accounts the record never includes; not a trade exclusion (the profile keeps its own line)',
  open_options: 'open options (long, short, unpriceable) are open positions, not closed trades (R2: open options never count)',
  open_unsupported: 'futures and similar open contracts: open positions, not closed trades',
} as const;

/** F-7 filing reasons (lib/public-trades.ts#PUBLIC_REASONS). Typed over every reason, so a new one fails the type check
 *  too. */
export const PUBLIC_KINDS: Record<PublicReason, Kind> = {
  no_price: summed('open-market sales with no priced purchase before them'),
  unreconciled: summed('open-market sales whose holdings did not reconcile'),
  derivative: left('derivative rows, purchases and disposals alike: never a trade in the headline unit'),
  gift: left('a gift is not an open-market sale, so never a trade in the headline unit'),
  other: left('a disposal that is not an open-market sale (for example shares withheld for tax)'),
  indirect: left('indirectly held shares, purchases and disposals alike: never a trade in the headline unit'),
};

/** Option matcher causes (lib/options.ts#CAUSES) and the counter each fills (rebuildOptionTrades). */
export const CAUSE_COUNTER: Record<Cause, Counter> = {
  short: 'excluded_options_short', exercise: 'excluded_options_other', expiryCash: 'excluded_options_other', noContract: 'excluded_options_other',
  contradict: 'excluded_options_other', flip: 'excluded_options_other', noOpen: 'excluded_options_other', dangling: 'excluded_options_other',
  adjusted: 'excluded_options_other', currency: 'excluded_options_other', underlying: 'excluded_options_other', malformed: 'excluded_options_other',
  cashScale: 'excluded_options_other', duplicate: 'excluded_options_other',
};

/** The rebuild results' count keys and the counter each one is stored in (the guard's camelCase → column map). */
export const RESULT_KEYS = {
  MatchResult: { excluded: 'excluded_positions', excludedCorporate: 'excluded_corporate', excludedHeld: 'excluded_held', excludedTransfer: 'excluded_transfer' },
  options: { short: 'excluded_options_short', other: 'excluded_options_other' },
  public: { excluded: 'public' },
} as const;
/** Result keys that are not counts. */
export const RESULT_DATA = { MatchResult: ['trades'], options: ['trades', 'counts'], public: ['trades', 'openSymbols'] } as const;

const pub = (c: ExclusionInput) => c.public ?? {};
const publicSum = (c: ExclusionInput) =>
  (Object.keys(PUBLIC_KINDS) as PublicReason[]).filter((k) => PUBLIC_KINDS[k].summed).reduce((a, k) => a + (Number(pub(c)[k]) || 0), 0);

/** The one sum: share exclusions + every option close (shown, short, other) + exercise shares once (R2). Open options
 *  and simulated accounts never count. */
// ponytail: E6 an option-pair sell (OCC symbol on the share path) that the share matcher already counted under corporate or
// held stays counted there and is counted again under options (excluded_options_other via extraOther) — must-fix before
// real users (owner flag, R4): count each such sell once, in removeOptionPairs, by leaving it out of the share counters.
// ponytail: future-dated option rows are counted (users.excluded_future_options, F-35) but not summed: a waiting option row
// is not yet a close — fix: count the waiting option closes apart once the matcher can class them before their date.
// (Future-dated unusable sells are in excluded_future_sells since F-35.)
export function exclusionTotal(c: ExclusionInput): number {
  const share = c.excluded_positions + c.excluded_future_sells + c.excluded_corporate + c.excluded_transfer + c.excluded_held + c.excluded_shared;
  return share + publicSum(c) + closesOf(c.options) + c.options.exerciseShares;
}

/** The profile's per-reason lines, in order, from the existing copy constants (held only via PROFILE.excludedHeld). The
 *  summed `n` equals exclusionTotal in both gate states (R4). Lines with n = 0 (open options) are context, not counts. */
export function exclusionReasons(c: ExclusionInput): Reason[] {
  const out: Reason[] = [];
  const add = (key: string, n: number, text: string) => out.push({ key, n, text });
  if (c.excluded_positions > 0) add('positions', c.excluded_positions, PROFILE.excludedPositions(c.excluded_positions));
  if (c.excluded_future_sells > 0) add('future', c.excluded_future_sells, PROFILE.excludedFuture(c.excluded_future_sells));
  if (c.excluded_corporate > 0) add('corporate', c.excluded_corporate, PROFILE.excludedCorporate(c.excluded_corporate));
  if (c.excluded_transfer > 0) add('transfer', c.excluded_transfer, PROFILE.excludedTransfer(c.excluded_transfer)); // F-32: among the lines the link lands on
  if (c.excluded_held > 0) add('held', c.excluded_held, PROFILE.excludedHeld(c.excluded_held));
  if (c.excluded_shared > 0) add('shared', c.excluded_shared, EXCLUSIONS.excludedShared(c.excluded_shared));
  for (const k of Object.keys(PUBLIC.excluded) as PublicReason[]) {
    const n = Number(pub(c)[k]) || 0;
    if (PUBLIC_KINDS[k]?.summed && n > 0) add(`public.${k}`, n, PUBLIC.excluded[k](n));
  }
  const o = c.options, closes = closesOf(o);
  if (c.gate === 'closed') {
    // R1: the gated line word for word (its closes part is the count, R4), plus the exercise-share line.
    if (closes + openOf(o) > 0) add('options.gated', closes, OPTIONS.gated(closes, openOf(o)));
    if (o.exerciseShares > 0) add('options.exerciseShares', o.exerciseShares, OPTIONS.exerciseShares(o.exerciseShares));
    return out;
  }
  // R1/R3, gate open: the long closes, the closed shorts (open shorts named, not counted), the technical line with the
  // exercise shares named once (OPTIONS.technical's either/or), and the unpriceable open options (not counted).
  if (o.shown > 0) add('options.summarized', o.shown, EXCLUSIONS.optionsSummarized(o.shown));
  if (o.short + o.openShort > 0) add('options.short', o.short, OPTIONS.short(o.short, o.openShort));
  if (o.other > 0) add('options.technical', o.other + o.exerciseShares, OPTIONS.technical(o.other, o.exerciseShares));
  else if (o.exerciseShares > 0) add('options.exerciseShares', o.exerciseShares, OPTIONS.exerciseShares(o.exerciseShares));
  if (o.openOther > 0) add('options.openOther', 0, OPTIONS.openOther(o.openOther));
  return out;
}

/** The pane's and the strip's count: 0 while the record imports (TR-3: counts are partial mid-import). */
export const lineCount = (c: ExclusionInput, state: string) => (state === 'importing' ? 0 : exclusionTotal(c));
