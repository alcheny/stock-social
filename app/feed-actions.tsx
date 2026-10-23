'use server';
import { FEED_CANDIDATES, loadFeedPage } from '@/lib/feed.ts';
import { decodeCursor } from '@/lib/discovery/pager.ts';
import { FeedEnd, feedRowNodes } from './feed-rows.tsx';

// F-2 PR-1: the next 30 server-rendered cards for the auto-append (app/feed-pager.tsx). Public and read-only: it
// reads no cookie or session and writes nothing; the cursor is validated (a stale or tampered one starts over).
// Fix round 1: the rows one by one (the client leaves out a card it already shows), and the end card after the last.
export async function nextFeedPage(cursor: unknown): Promise<{ rows: { id: string; node: React.ReactNode }[]; end: React.ReactNode; next: string | null } | { stale: true }> {
  if (typeof cursor !== 'string' || !decodeCursor(cursor, Date.now(), FEED_CANDIDATES)) return { stale: true };
  const page = await loadFeedPage(cursor);
  return { rows: feedRowNodes(page), end: page.next ? null : <FeedEnd />, next: page.next };
}
