// Fixes-labels plan §1 (docs/features/logs/fixes-labels/plan.md): one date style for every surface. UTC, one cached
// formatter per variant. `dateText` is 'Mon D' in `now`'s UTC year and 'Mon D, YYYY' otherwise; `year: 'always'` is for
// images, share text and cached renders (a cached render can outlive the year it was made in). `asOfDay` (lib/copy.ts)
// is untouched and prints the same text as the 'auto' form.
const SHORT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const LONG = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

export function dateText(d: Date, now: Date, opts: { year?: 'auto' | 'always' } = {}): string {
  const always = opts.year === 'always';
  return always || d.getUTCFullYear() !== now.getUTCFullYear() ? LONG.format(d) : SHORT.format(d);
}

const HOUR = 3_600_000, DAY = 24 * HOUR;
// Relative time for dynamic pages only, always shown beside the absolute date (F-11). A time in the future (clock skew)
// reads as the most recent bucket, never as "in N".
export function relativeText(from: Date, now: Date): string {
  const ms = now.getTime() - from.getTime();
  if (ms < HOUR) return 'less than an hour ago';
  if (ms < DAY) { const h = Math.floor(ms / HOUR); return h === 1 ? '1 hour ago' : `${h} hours ago`; }
  const days = Math.floor(ms / DAY);
  if (days < 2) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks <= 12) return `${weeks} weeks ago`;
  return `${Math.max(3, Math.floor(days / 30.44))} months ago`;
}
