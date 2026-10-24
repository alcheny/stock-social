'use client';
import { useState } from 'react';
import { LIKES } from '@/lib/copy.ts';
import { likeForm, likeTrade, rejectTradeForm, unlikeTrade } from './discovery-actions.ts';
import { MoreMenu } from './not-interested.tsx';

// F-2 PR-4: a feed card's "…" menu, signed in, never on the viewer's own trade: Like (the keyboard and screen-reader
// route for the double tap, aria-pressed) and "Hide this trade" (the route for the reject swipe). A like is private and
// quiet: the button reads "Liked" and a small mark sits by the menu; no count, no motion, no celebration (POLICY). The
// toggle is optimistic (a like is neither money nor a record) and a refusal puts it back. The double tap
// (app/feed-gestures.tsx) clicks the same button. Without JavaScript both are form posts.
export function CardMenu({ id, symbol, handle, liked: first }: { id: string; symbol: string; handle: string; liked: boolean }) {
  const [liked, setLiked] = useState(first);
  const [said, setSaid] = useState('');
  return (
    <div className="card-menu">
      {liked && <span className="like-mark" title={LIKES.mark}><span aria-hidden="true">♥</span><span className="sr-only">{LIKES.mark}</span></span>}
      <MoreMenu label={LIKES.more(symbol)}>
        <div className="menu-pop">
          <form action={likeForm.bind(null, id, first)} onSubmit={async (e) => {
            e.preventDefault();
            const now = !liked;
            setLiked(now);
            setSaid(now ? LIKES.saidLiked : LIKES.saidUnliked);
            const r = await (now ? likeTrade(id) : unlikeTrade(id)).catch(() => ({ ok: false }));
            if (!r.ok) { setLiked(!now); setSaid(''); }
          }}>
            <button type="submit" className="secondary" data-like aria-pressed={liked} aria-label={LIKES.likeLabel}>
              <span aria-hidden="true">{liked ? '♥' : '♡'}</span> {liked ? LIKES.liked : LIKES.like}
            </button>
          </form>
          <form action={rejectTradeForm.bind(null, id)} onSubmit={(e) => {
            e.preventDefault();
            const d = e.currentTarget.closest('details');
            if (d) d.open = false;
            dispatchEvent(new CustomEvent('ss:hide', { detail: { handle, trade: id, row: e.currentTarget.closest('.row') } }));
          }}>
            <button type="submit" className="secondary">{LIKES.hide}</button>
          </form>
        </div>
      </MoreMenu>
      <span className="sr-only" role="status">{said}</span>
    </div>
  );
}
