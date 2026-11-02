// F-21 · the exclusions line under the headline (pane, record strip on trade and month pages): one muted line stating
// the record's exclusion sum (lib/exclusions.ts) as a real link to the profile's per-reason lines (#excluded, focus lands
// there). Neutral words (lib/copy.ts EXCLUSIONS), the muted token only: no warning colour, no icon, and no setting turns
// it off. Nothing renders at 0 (and the count is 0 while a record imports). Never on a feed card (D22).
import Link from 'next/link';
import { EXCLUSIONS } from '@/lib/copy.ts';

export function ExclusionsLine({ n, handle }: { n?: number; handle: string }) {
  if (!n || n <= 0) return null;
  return <p className="muted small exclusions-line" data-exclusions><Link className="tap44" href={`/u/${encodeURIComponent(handle)}#excluded`}>{EXCLUSIONS.line(n)}</Link></p>;
}
