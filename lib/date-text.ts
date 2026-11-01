// FIXES-LABELS (D-05, fix #24): one date text for the app. "Mon D" when the date falls in `now`'s UTC year,
// "Mon D, YYYY" otherwise; `year: 'always'` for images, share text and cached renders, which outlive the year they
// were drawn in. UTC, one cached formatter per variant (a formatter per call costs ~0.1 ms). `asOfDay` (lib/copy.ts)
// reads the same (lib/date-text.test.ts pins the parity).
const SHORT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const LONG = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

export function dateText(d: Date, now: Date, o: { year?: 'auto' | 'always' } = {}): string {
  return o.year !== 'always' && d.getUTCFullYear() === now.getUTCFullYear() ? SHORT.format(d) : LONG.format(d);
}

const H = 3_600_000, D = 24 * H;
const n = (k: number, w: string) => `${k} ${w}${k === 1 ? '' : 's'} ago`;

// "less than an hour ago", "N hours ago" (1–23), "yesterday", "N days ago" (2–29), "N weeks ago" (to 12), then
// "N months ago" (30-day months). A time in the future reads as under an hour (clock skew, never "in N hours").
export function relativeText(from: Date, now: Date): string {
  const ms = Math.max(0, now.getTime() - from.getTime());
  if (ms < H) return 'less than an hour ago';
  if (ms < D) return n(Math.floor(ms / H), 'hour');
  if (ms < 2 * D) return 'yesterday';
  if (ms < 30 * D) return n(Math.floor(ms / D), 'day');
  const weeks = Math.floor(ms / (7 * D));
  if (weeks <= 12) return n(weeks, 'week');
  return n(Math.floor(ms / (30 * D)), 'month');
}
