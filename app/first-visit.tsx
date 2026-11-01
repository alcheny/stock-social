// F-13 (D27): the signed-out first-visit line, page 1 only. Placed at the top of page 1's first card by app/feed-rows.tsx
// (so F-10's first screen, return + strip + disclaimer, holds); it renders only for a signed-out viewer at offset 0. While any card on the page is demo, the Demo badge sits beside the line at the cards'
// own weight (POLICY F3a, P2): it holds for a mixed feed, where the first card may be verified.
import Link from 'next/link';
import type { FeedPage } from '@/lib/feed.ts';
import { cardTrust } from '@/lib/pane.ts';
import { FIRST_VISIT } from '@/lib/copy.ts';
import { Badge } from './ui.tsx';
import { FirstVisitBox } from './first-visit-client.tsx';

export function FirstVisit({ page }: { page: FeedPage }) {
  if (page.viewer || page.offset !== 0 || !page.cards.length) return null;
  const demo = page.cards.some((c) => cardTrust(c, page.records.get(c.user_id)?.state).badge === 'demo');
  return (
    <FirstVisitBox dismissLabel={FIRST_VISIT.dismiss}>
      <p className="fv-line"><span>{FIRST_VISIT.line}</span> <Link href="/how">{FIRST_VISIT.how}</Link></p>
      {demo && <p className="fv-demo"><Badge verified={false} /> {FIRST_VISIT.demo}</p>}
    </FirstVisitBox>
  );
}
