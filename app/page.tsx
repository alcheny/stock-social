import Link from 'next/link';
import type { Metadata } from 'next';
import { loadFeedPage } from '@/lib/feed.ts';
import { FEED, FEED_COUNTS } from '@/lib/copy.ts';
import { FeedKeys } from './feed-keys.tsx';
import { FeedEnd, FeedRows } from './feed-rows.tsx';
import { FeedPager } from './feed-pager.tsx';
import { FeedHides } from './feed-hides.tsx';
import { viewerId } from '@/lib/viewer.ts';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// A later page (`?after=`) is a slice of one day's list: not a page of its own for search engines.
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return (await searchParams).after ? { robots: { index: false } } : {};
}

// Public, no signup: every shared link lands here (DESIGN §2 BL feedback).
// Ranking (DESIGN §2.6, lib/feed.ts): size of move × recency, |return| so losses rank as high as equal gains, then the
// TR-9 lower bound. F-2 PR-1: diversity caps and seeded exploration (lib/discovery/), 30 cards a page; the next page
// appends with no tap (app/feed-pager.tsx), or through a plain link without JavaScript.
export default async function Feed({ searchParams }: Props) {
  // F-2 PR-2: signed in, the viewer's own exclusions and follows (lib/viewer.ts gives the id only).
  const page = await loadFeedPage((await searchParams).after, { viewer: await viewerId() });

  if (!page.cards.length && page.offset === 0) {
    return (
      <main className="page">
        <h1>No trades yet</h1>
        <p className="muted">Run <code>npm run db:seed</code> for demo data, or <Link href="/login">publish your own</Link>.</p>
      </main>
    );
  }

  return (
    <main className="feed">
      {/* Fix round 1 (UX follow-up 9): a later page (no JS) says where in the list it starts. Fix round 2: page 1 has its
          own level-1 heading too (visually hidden; the cards are the page). */}
      <h1 className="sr-only">{page.offset > 0 ? FEED_COUNTS.position(page.from, page.to) : FEED.heading}</h1>
      <FeedKeys />
      {page.viewer && <FeedHides />}
      <FeedRows page={page} />
      {page.next ? <FeedPager key={page.next} next={page.next} /> : <FeedEnd />}
    </main>
  );
}
