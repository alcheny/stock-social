import Link from 'next/link';
import { HIDDEN_TRADES, PERSONALIZE } from '@/lib/copy.ts';

// F-2 PR-5 (criterion 15, business lead demand 4): one quiet paragraph above the first card, signed in only: how the
// feed is ordered for this viewer (personalization On with at least one choice counted) and how many trades they hid
// (only when N > 0), each with its link. Absent when neither applies. The viewer's own count, never shown to anyone else.
export function FeedNotes({ order, hidden }: { order: { activity: boolean } | null; hidden: number }) {
  if (!order && hidden <= 0) return null;
  return (
    <p className="feed-notes muted small">
      {order && <>{order.activity ? PERSONALIZE.orderLineActivity : PERSONALIZE.orderLine}{' '}
        <Link href="/me/personalize" aria-label={PERSONALIZE.changeFor}>{PERSONALIZE.change}</Link></>}
      {order && hidden > 0 && <span aria-hidden="true"> · </span>}
      {hidden > 0 && <>{HIDDEN_TRADES.line(hidden)}{' '}<Link href="/me/hidden" aria-label={HIDDEN_TRADES.showThemFor(hidden)}>{HIDDEN_TRADES.showThem}</Link></>}
    </p>
  );
}
