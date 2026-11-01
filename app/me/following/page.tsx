import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session.ts';
import { expiredHides, ownLists, shownAgainJustNow } from '@/lib/follows.ts';
import { FOLLOW, HIDDEN_TRADES, LIKES, PERSONALIZE } from '@/lib/copy.ts';
import { removeExpiredHideForm } from './actions.ts';
import { FollowButton } from '../../follow-button.tsx';
import { showAgainForm } from '../../discovery-actions.ts';
import { WhoName } from '../../ui.tsx';

export const metadata: Metadata = { title: `${FOLLOW.title} · Stock Social`, robots: { index: false, follow: false } };
const DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// F-2 PR-2: the viewer's own lists, never anyone else's (noindex, signed in only). "Show again" ends an exclusion
// (until = now) without deleting it; the tick deletes it a day later. Fix round 1: reached from the viewer's own
// profile (Settings); h1 names both lists; every row has one shape; "Show again" says who is back (`?back=`, checked
// against the viewer's lists so a crafted link claims nothing; review: and only for a "Show again" this viewer made in
// the last minute).
export default async function Following({ searchParams }: { searchParams?: Promise<{ back?: string }> }) {
  const me = await currentUser();
  if (!me) redirect('/login');
  const [{ following, hidden }, expired] = await Promise.all([ownLists(me.id), expiredHides(me.id)]);
  const back = (await searchParams)?.back;
  const isBack = typeof back === 'string' && /^[a-z0-9_]{3,20}$/.test(back) && !hidden.some((t) => t.handle === back) && (await shownAgainJustNow(me.id, back));
  return (
    <main className="page">
      <h1>{FOLLOW.title}</h1>
      <p className="muted">{FOLLOW.private}</p>
      <p role="status" className="follow-status">{isBack ? FOLLOW.back(back) : ''}</p>
      <h2>{FOLLOW.followingHeading}</h2>
      {following.length ? (
        <ul className="rows people">
          {following.map((t) => (
            <li key={t.handle} className="line"><span className="who-col"><Link href={`/u/${t.handle}`}><WhoName name={t.name} handle={t.handle} /></Link></span><FollowButton handle={t.handle} following signedIn /></li>
          ))}
        </ul>
      ) : <p>{FOLLOW.noneFollowing}</p>}
      <h2>{FOLLOW.hiddenHeading}</h2>
      <p className="muted">{FOLLOW.hiddenExplain}</p>
      {hidden.length ? (
        <ul className="rows people">
          {hidden.map((t) => (
            <li key={t.handle} className="line">
              <span className="who-col"><Link href={`/u/${t.handle}`}><WhoName name={t.name} handle={t.handle} /></Link><span className="muted small until">{FOLLOW.until(DAY.format(t.until!))}</span></span>
              <form action={showAgainForm.bind(null, t.handle)}><button className="secondary" aria-label={FOLLOW.showAgainFor(t.handle)}>{FOLLOW.showAgain}</button></form>
            </li>
          ))}
        </ul>
      ) : <p>{FOLLOW.noneHidden}</p>}
      {/* F-2 PR-5 (business lead demand 2): hides that ran their 90 days, stored until removed. Absent when none. */}
      {expired.length > 0 && <>
        <h3>{PERSONALIZE.expiredHeading}</h3>
        <p className="muted small">{PERSONALIZE.expiredExplain}</p>
        <ul className="rows people">
          {expired.map((t) => (
            <li key={t.handle} className="line">
              <span className="who-col"><Link href={`/u/${t.handle}`}><WhoName name={t.name} handle={t.handle} /></Link><span className="muted small until">{PERSONALIZE.ended(DAY.format(t.until!))}</span></span>
              <form action={removeExpiredHideForm.bind(null, t.handle)}><button className="secondary" aria-label={PERSONALIZE.removeFor(t.handle)}>{PERSONALIZE.remove}</button></form>
            </li>
          ))}
        </ul>
      </>}
      {/* F-2 PR-5: the viewer's hidden trades and personalization switches. */}
      <h2>{HIDDEN_TRADES.title}</h2>
      <p><Link href="/me/hidden">{HIDDEN_TRADES.title} →</Link></p>
      <p><Link href="/me/personalize">{PERSONALIZE.link} →</Link></p>
      {/* F-2 PR-4: the viewer's likes live on their own paged page. */}
      <h2>{LIKES.title}</h2>
      <p><Link href="/me/likes">{LIKES.link}</Link></p>
    </main>
  );
}
