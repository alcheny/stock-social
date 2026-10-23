'use server';
import { FEED_CANDIDATES, loadFeedPage } from '@/lib/feed.ts';
import { decodeCursor } from '@/lib/discovery/pager.ts';
import { FeedEnd, feedRowNodes } from './feed-rows.tsx';
import { viewerId } from '@/lib/viewer.ts';

// F-2 PR-1: the next 30 server-rendered cards for the auto-append (app/feed-pager.tsx). Public and read-only: it
// reads no cookie or session and writes nothing; the cursor is validated (a stale or tampered one starts over).
// Fix round 1: the rows one by one (the client leaves out a card it already shows), and the end card after the last.
export async function nextFeedPage(cursor: unknown): Promise<{ rows: { id: string; node: React.ReactNode }[]; end: React.ReactNode; next: string | null; from: number; to: number } | { stale: true }> {
  if (typeof cursor !== 'string' || !decodeCursor(cursor, Date.now(), FEED_CANDIDATES)) return { stale: true };
  const page = await loadFeedPage(cursor, { viewer: await viewerId() }); // F-2 PR-2: the viewer's own exclusions and follows
  // Fix round 2: the page's list positions, for the live line.
  return { rows: feedRowNodes(page), end: page.next ? null : <FeedEnd />, next: page.next, from: page.from, to: page.to };
}
