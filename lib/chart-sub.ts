// FIXES-LABELS (D-05, code review): the performance chart's at-rest subline. "‹range› · last close ‹date›" when the record
// has a last close; with none (no trades, a stand-in series still loading: chartSeries' t1 is 0) the plain range label,
// never "last close Jan 1, 1970".
import { FIXES_LABELS } from './copy.ts';
import { dateText } from './date-text.ts';

export function chartRestSub(rangeLabel: string, t1: number | null | undefined, now: Date): string {
  return typeof t1 === 'number' && Number.isFinite(t1) && t1 > 0 ? FIXES_LABELS.chartSub(rangeLabel, dateText(new Date(t1), now)) : rangeLabel;
}
