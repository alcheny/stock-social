'use client';
import { FOLLOW } from '@/lib/copy.ts';
import { notInterestedForm } from './discovery-actions.ts';

// F-2 PR-2: the "…" menu with "Not interested in @x", the single negative action (a 90-day exclusion, weight −4).
// Never on a feed card. With JavaScript the feed (app/feed-hides.tsx) hides the trader's cards in place and offers Undo
// for 5 s; without it the form posts the action and the page comes back without them ("Show again" on /me/following).
export function NotInterested({ handle }: { handle: string }) {
  return (
    <details className="more-menu">
      <summary aria-label={FOLLOW.more(handle)}><span aria-hidden="true">…</span></summary>
      <form action={notInterestedForm.bind(null, handle)} onSubmit={(e) => {
        e.preventDefault();
        const d = e.currentTarget.closest('details');
        if (d) d.open = false;
        dispatchEvent(new CustomEvent('ss:hide', { detail: { handle, row: e.currentTarget.closest('.row') } }));
      }}>
        <button type="submit" className="secondary">{FOLLOW.notInterested(handle)}</button>
      </form>
    </details>
  );
}
