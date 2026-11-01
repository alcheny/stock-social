// F-1 PR-3 fix round 4 (UX lead demand 2): every count a person reads is grouped by thousands ("2,828", never "2828").
// One helper, so the profile, the banner, the cards, the images and the metadata cannot drift.
const GROUPED = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
export const count = (n: number): string => GROUPED.format(n);
// "1 closed trade", "2,828 closed trades".
export const counted = (n: number, one: string, many = `${one}s`): string => `${count(n)} ${n === 1 ? one : many}`;

// ---- F-19 · Number format and tone, first slice (docs/features/F-19-number-format-and-ranges.md; committee record
// docs/features/logs/F-19/committee-2026-11-01.md). This file is the one home of pct(), tone() and winPct():
// lib/trades.ts and lib/open-split.ts re-export these same functions and app/open-rows.tsx#toneClass delegates to
// tone(), so no second implementation exists (lib/format.f19.test.ts fails on one).
//
// ponytail: these call sites still format or tone a number on their own, not through this file. The F-19 sweep rework
// (after F-10..F-12, F-18 and fix #7 merge) moves each onto pct()/tone()/toneWord()/winPct(); they are listed here, not
// commented in place, because the sessions editing those files now would conflict (committee decision 8).
// lib/format.f19.test.ts checks that every file named still exists.
export const F19_SWEEP_SITES = [
  // tone decided inline (`> 0 ? 'up' : 'down'`, `>= 0`, `r < 0 ? … : r > 0 ? …` on the raw value): 0.0% is painted
  // green or red instead of Flat
  'app/u/[handle]/chart.tsx',
  'app/u/[handle]/page.tsx',
  'app/pane.tsx',
  'app/ui.tsx',
  'app/me/likes/page.tsx',
  'app/t/[symbol]/page.tsx',
  'app/t/[symbol]/Theses.tsx',
  'app/t/[symbol]/Spread.tsx',
  'app/t/compare/page.tsx',
  'app/u/[handle]/similar-section.tsx',
  'lib/record-tools.ts',
  // screen-reader labels announcing "Gain " for anything not below zero, so 0.0% is read as a gain
  'app/u/[handle]/new-trades-prompt.tsx',
  'app/u/[handle]/month/[ym]/page.tsx',
  'app/u/[handle]/trade/[sellId]/page.tsx',
  // win rate by toFixed(0) / Math.round, so 199 of 200 prints "100%" (winPct() clamps; D23 keeps the output for now)
  'lib/copy.ts',
  'lib/insights.ts',
  'lib/month-card.ts',
  'lib/ticker.ts',
  'app/me/record/page.tsx',
  'app/t/[symbol]/Baseline.tsx',
  'app/t/[symbol]/HoldTime.tsx',
  'app/t/[symbol]/Concentration.tsx',
  'app/t/[symbol]/opengraph-image.tsx',
  'app/u/[handle]/trade/[sellId]/opengraph-image.tsx',
  // (lib/ticker.ts#signed is also a percent formatter under another name; the rules module's signedPct carries its own
  // ponytail note in place)
] as const;

// Signed percent. A value that rounds to zero reads "0.0%" (never "-0.0%" or "+0.0%", same as an exact zero). A loss
// short of -100% never rounds to a total loss: it gets up to 4 more digits ("-99.98%"), and past that reads "≈-100.0%".
// ponytail: ASCII hyphen sign, up to `digits + 4` decimals near -100% and no thousands comma at 1,000% and above — the
// F-19 sweep rework replaces this algorithm (not a second one beside it) with the design system §3 form (U+2212, a
// whole number with a comma at 1,000% and above, at most two decimals, "≈−100.0%" strictly between -100% and
// -99.995%), and share images and the display log keep the hyphen through it until a render test shows U+2212 drawn.
export function pct(x: number, digits = 1): string {
  const fixed = (d: number) => (x * 100).toFixed(d);
  let s = fixed(digits);
  if (Number(s) === 0) return `${fixed(digits).replace('-', '')}%`;
  if (x > -1 && Number(s) <= -100) {
    for (let d = digits + 1; d <= digits + 4 && Number(s) <= -100; d++) s = fixed(d);
    if (Number(s) <= -100) return `≈${fixed(digits)}%`;
  }
  return `${x > 0 ? '+' : ''}${s}%`;
}

// The sign of the value as pct(x, digits) prints it: a printed zero ("0.0%", "0%") is flat, never coloured and never
// called up or down, so colour and words can't contradict the number shown. NaN prints "NaN%" and is flat.
export type Tone = 'up' | 'down' | 'flat';
export function tone(x: number, digits = 1): Tone {
  const shown = Number((x * 100).toFixed(digits));
  return shown > 0 ? 'up' : shown < 0 ? 'down' : 'flat';
}

// The visible word for a tone. Flat has its own word, so a printed zero is never announced as a gain (POLICY A1: gain
// and loss are never shown by colour alone).
const TONE_WORD = { up: 'Gain', down: 'Loss', flat: 'Flat' } as const;
export const toneWord = (t: Tone): (typeof TONE_WORD)[Tone] => TONE_WORD[t];

// Win rate as a whole percent from counts (exact, no float ratio): never "100%" while a trade lost, never "0%" while a
// trade won. Null when there are no trades or the counts are not whole numbers with 0 <= wins <= n.
export function winPct(wins: number, n: number): string | null {
  if (!Number.isInteger(wins) || !Number.isInteger(n) || n <= 0 || wins < 0 || wins > n) return null;
  const w = wins;
  const r = Math.floor((200 * w + n) / (2 * n)); // round half up in integers: 23 of 40 is 57.5%, prints "58%"
  return `${w < n && r === 100 ? 99 : w > 0 && r === 0 ? 1 : r}%`;
}
