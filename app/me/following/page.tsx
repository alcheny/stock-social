import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session.ts';
import { expiredHidesPage, listsQuery, ownFollowing, ownHidden, pastEndQuery, shownAgainJustNow, type ListCursors } from '@/lib/follows.ts';
import { CLOSES_PAGING, FOLLOW, HIDDEN_TRADES, LIKES, PERSONALIZE } from '@/lib/copy.ts';
import { removeExpiredHideForm, showAgainHereForm } from './actions.ts';
import { FollowButton } from '../../follow-button.tsx';
import { WhoName } from '../../ui.tsx';

export const metadata: Metadata = { title: `${FOLLOW.title} · Stock Social`, robots: { index: false, follow: false } };
// 44 px tap targets, as .closes-more a.button (app/globals.css) gives the profile's paging button.
const TAP = { display: 'inline-flex', alignItems: 'center', minHeight: 44, boxSizing: 'border-box' } as const;
const DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// "Older …" for one list (its next cursor, the other lists kept where they are) and "Back to the newest" once it is paged.
function Paging({ at, k, next, label }: { at: ListCursors; k: keyof ListCursors; next: string | null; label: string }) {
  if (!next && !at[k]) return null;
  return (
    <p>
      {next && <Link className="button secondary" style={TAP} href={`/me/following${listsQuery({ ...at, [k]: next })}`}>{label}</Link>}{next && at[k] ? ' ' : null}
      {at[k] ? <Link style={TAP} href={`/me/following${listsQuery({ ...at, [k]: undefined })}`}>{CLOSES_PAGING.newest}</Link> : null}
    </p>
  );
}

// F-2 PR-2: the viewer's own lists, never anyone else's (noindex, signed in only). "Show again" ends an exclusion
// (until = now) without deleting it; the tick deletes it a day later. Fix round 1: reached from the viewer's own
// profile (Settings); h1 names both lists; every row has one shape; "Show again" says who is back (`?back=`, checked
// against the viewer's lists so a crafted link claims nothing; review: and only for a "Show again" this viewer made in
// the last minute). Known-limits sweep (lists): each list pages 50 at a time on its own cursor (f, h, e), like /me/likes.
export default async function Following({ searchParams }: { searchParams?: Promise<{ back?: string; f?: string; h?: string; e?: string }> }) {
  const me = await currentUser();
  if (!me) redirect('/login');
  const sp = (await searchParams) ?? {};
  const at: ListCursors = { f: sp.f, h: sp.h, e: sp.e };
  const [following, hidden, expired] = await Promise.all([ownFollowing(me.id, sp.f), ownHidden(me.id, sp.h), expiredHidesPage(me.id, sp.e)]);
  const back = sp.back;
  // QA Q1: a list paged past its end goes back to its newest rows (the others keep their place), never "none".
  const moved = pastEndQuery(at, { f: following, h: hidden, e: expired }, typeof back === 'string' && /^[a-z0-9_]{3,20}$/.test(back) ? { back } : {});
  if (moved !== null) redirect(`/me/following${moved}`);
  // shownAgainJustNow reads only an ended row (one per viewer and trader), so a trader still hidden is never "back".
  const isBack = typeof back === 'string' && /^[a-z0-9_]{3,20}$/.test(back) && (await shownAgainJustNow(me.id, back));
  return (
    <main className="page">
      <h1>{FOLLOW.title}</h1>
      <p className="muted">{FOLLOW.private}</p>
      <p role="status" className="follow-status">{isBack ? FOLLOW.back(back) : ''}</p>
      <h2>{FOLLOW.followingHeading}</h2>
      {following.rows.length ? (
        <ul className="rows people">
          {following.rows.map((t) => (
            <li key={t.handle} className="line"><span className="who-col"><Link href={`/u/${t.handle}`}><WhoName name={t.name} handle={t.handle} /></Link></span><FollowButton handle={t.handle} following signedIn /></li>
          ))}
        </ul>
      ) : <p>{FOLLOW.noneFollowing}</p>}
      <Paging at={at} k="f" next={following.next} label={FOLLOW.olderFollowing} />
      <h2>{FOLLOW.hiddenHeading}</h2>
      <p className="muted">{FOLLOW.hiddenExplain}</p>
      {hidden.rows.length ? (
        <ul className="rows people">
          {hidden.rows.map((t) => (
            <li key={t.handle} className="line">
              <span className="who-col"><Link href={`/u/${t.handle}`}><WhoName name={t.name} handle={t.handle} /></Link><span className="muted small until">{FOLLOW.until(DAY.format(t.until!))}</span></span>
              <form action={showAgainHereForm.bind(null, t.handle, at)}><button className="secondary" aria-label={FOLLOW.showAgainFor(t.handle)}>{FOLLOW.showAgain}</button></form>
            </li>
          ))}
        </ul>
      ) : <p>{FOLLOW.noneHidden}</p>}
      <Paging at={at} k="h" next={hidden.next} label={FOLLOW.olderHidden} />
      {/* F-2 PR-5 (business lead demand 2): hides that ran their 90 days, stored until removed. Absent when none. */}
      {expired.rows.length > 0 && <>
        <h3>{PERSONALIZE.expiredHeading}</h3>
        <p className="muted small">{PERSONALIZE.expiredExplain}</p>
        <ul className="rows people">
          {expired.rows.map((t) => (
            <li key={t.handle} className="line">
              <span className="who-col"><Link href={`/u/${t.handle}`}><WhoName name={t.name} handle={t.handle} /></Link><span className="muted small until">{PERSONALIZE.ended(DAY.format(t.until!))}</span></span>
              <form action={removeExpiredHideForm.bind(null, t.handle, at)}><button className="secondary" aria-label={PERSONALIZE.removeFor(t.handle)}>{PERSONALIZE.remove}</button></form>
            </li>
          ))}
        </ul>
        <Paging at={at} k="e" next={expired.next} label={FOLLOW.olderExpired} />
      </>}
      {/* F-2 PR-5: the viewer's hidden trades and personalization switches. */}
      <h2>{HIDDEN_TRADES.title}</h2>
      <p><Link href="/me/hidden">{HIDDEN_TRADES.title}<span aria-hidden="true"> →</span></Link></p>
      <p><Link href="/me/personalize">{PERSONALIZE.link}<span aria-hidden="true"> →</span></Link></p>
      {/* F-2 PR-4: the viewer's likes live on their own paged page. */}
      <h2>{LIKES.title}</h2>
      <p><Link href="/me/likes">{LIKES.link}</Link></p>
    </main>
  );
}
