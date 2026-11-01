// F-13 (D27): the signed-out first-visit line, page 1 only. Placed at the top of page 1's first card by app/feed-rows.tsx
// (so F-10's first screen, return + strip + disclaimer, holds); it renders only for a signed-out viewer at offset 0. While any card on the page is demo, the Demo badge sits beside the line at the cards'
// own weight (POLICY F3a, P2): it holds for a mixed feed, where the first card may be verified.
import Link from 'next/link';
import type { FeedPage } from '@/lib/feed.ts';
import { paneTrust } from '@/lib/pane.ts';
import { FIRST_VISIT } from '@/lib/copy.ts';
import { Badge } from './ui.tsx';
import { FirstVisitBox } from './first-visit-client.tsx';

export function FirstVisit({ page }: { page: FeedPage }) {
  if (page.viewer || page.offset !== 0 || !page.cards.length) return null;
  // The record-level rule F-10's strip badge uses (paneTrust over the trader's rows): a verified card from a demo record
  // still puts Demo beside the line (orchestrator review, blocking 1).
  const demo = page.cards.some((c) => paneTrust(page.byUser.get(c.user_id) ?? [c], page.records.get(c.user_id)?.state ?? 'connected').badge === 'demo');
  return (
    <FirstVisitBox dismissLabel={FIRST_VISIT.dismiss}>
      <p className="fv-line"><span>{FIRST_VISIT.line}</span> <Link href="/how">{FIRST_VISIT.how}<span aria-hidden="true"> →</span></Link></p>
      {/* Committee F1 fallback (business lead): the Demo badge inline with the line; its sentence is read, not drawn, so
          the line fits F-10's first-screen budget in card 1. */}
      {demo && <p className="fv-demo"><Badge verified={false} /><span className="sr-only"> {FIRST_VISIT.demo}</span></p>}
    </FirstVisitBox>
  );
}
