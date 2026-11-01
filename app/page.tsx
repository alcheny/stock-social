import Link from 'next/link';
import type { Metadata } from 'next';
// F-2 PR-5: lib/feed.ts#loadFeedPage plus, signed in, the viewer's own profile and switches.
import { loadFeedPage } from '@/lib/discovery/personal-feed.ts';
import { FEED, FEED_COUNTS, LIKES, FEED_EMPTY } from '@/lib/copy.ts';
// CHORES-3 (K20): the home link preview.
import { siteOrigin } from '@/lib/site-origin.ts';
import { demoShown, homePreview } from '@/lib/home-preview.ts';
import { FeedKeys } from './feed-keys.tsx';
import { FeedEnd, FeedRows } from './feed-rows.tsx';
import { FeedPager } from './feed-pager.tsx';
import { FeedHides } from './feed-hides.tsx';
import { viewerId } from '@/lib/viewer.ts';
import { likedAmong } from '@/lib/likes.ts';
import { FeedGestures } from './feed-gestures.tsx';
// F-2 PR-5: the hidden-trades count, the order line and the activity logger.
import { hiddenTradeCount } from '@/lib/likes.ts';
import { FeedNotes } from './feed-notes.tsx';
import { DiscoveryLog } from './discovery-log.tsx';
// F-13: the signed-out twin of the notes slot (it renders only signed out, page 1).

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// A later page (`?after=`) is a slice of one day's list: not a page of its own for search engines.
// CHORES-3 (K20): every feed page carries the home link preview (lib/home-preview.ts); the page sets no title.
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const after = (await searchParams).after;
  const demo = await demoShown();
  const p = homePreview(demo);
  // The card's URL carries the demo state, so its public cache always matches this page (app/home-card/route.tsx).
  const image = { url: `/home-card?d=${demo ? 1 : 0}`, width: 1200, height: 630, type: 'image/png', alt: p.cardText };
  const preview: Metadata = {
    metadataBase: new URL(siteOrigin()),
    description: p.metaDescription,
    openGraph: { type: 'website', url: '/', title: p.title, description: p.description, images: [image] },
    twitter: { card: 'summary_large_image', title: p.title, description: p.description, images: [image] },
  };
  return { ...preview, ...(after ? { robots: { index: false } } : {}) };
}

// Public, no signup: every shared link lands here (DESIGN §2 BL feedback).
// Ranking (DESIGN §2.6, lib/feed.ts): size of move × recency, |return| so losses rank as high as equal gains, then the
// TR-9 lower bound. F-2 PR-1: diversity caps and seeded exploration (lib/discovery/), 30 cards a page; the next page
// appends with no tap (app/feed-pager.tsx), or through a plain link without JavaScript.
export default async function Feed({ searchParams }: Props) {
  // F-2 PR-2: signed in, the viewer's own exclusions and follows (lib/viewer.ts gives the id only).
  const sp = await searchParams;
  const page = await loadFeedPage(sp.after, { viewer: await viewerId() });
  // F-2 PR-4: signed in, which of the page's cards this viewer liked (their own rows only).
  if (page.viewer) page.liked = await likedAmong(page.viewer.id, page.cards.map((c) => c.id));
  // F-2 PR-5: signed in, the viewer's own hidden-trade count (page 1's notes line only).
  const hiddenN = page.viewer && page.offset === 0 ? await hiddenTradeCount(page.viewer.id) : 0;

  if (!page.cards.length && page.offset === 0) {
    return (
      <main className="page">
        {/* Approval council fix #12: a plain empty state, no developer instructions (the seed command is in the README). */}
        <h1>{FEED_EMPTY.title}</h1>
        <p className="muted">{FEED_EMPTY.body} <Link href="/login">{FEED_EMPTY.publish}</Link></p>
      </main>
    );
  }

  return (
    <main className="feed">
      {/* Fix round 1 (UX 5): without JavaScript, the hide's confirmation (signed in only). */}
      {page.viewer && sp.done === 'trade-hidden' && <p className="nojs-done" role="status">{LIKES.hidden}</p>}
      {/* Fix round 1 (UX follow-up 9): a later page (no JS) says where in the list it starts. Fix round 2: page 1 has its
          own level-1 heading too (visually hidden; the cards are the page). */}
      <h1 className="sr-only">{page.offset > 0 ? FEED_COUNTS.position(page.from, page.to) : FEED.heading}</h1>
      <FeedKeys />
      {page.viewer && <FeedHides />}
      {page.viewer && page.offset === 0 && <FeedNotes order={page.personal?.uses ?? null} hidden={hiddenN} />}
      {page.settings?.personalize && page.settings.activity && <DiscoveryLog />}
      <FeedGestures signedIn={!!page.viewer} />
      <FeedRows page={page} />
      {page.next ? <FeedPager key={page.next} next={page.next} /> : <FeedEnd />}
    </main>
  );
}
