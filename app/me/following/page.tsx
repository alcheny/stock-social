import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session.ts';
import { ownLists } from '@/lib/follows.ts';
import { FOLLOW } from '@/lib/copy.ts';
import { FollowButton } from '../../follow-button.tsx';
import { showAgainForm } from '../../discovery-actions.ts';
import { WhoName } from '../../ui.tsx';

export const metadata: Metadata = { title: `${FOLLOW.title} · Stock Social`, robots: { index: false, follow: false } };
const DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// F-2 PR-2: the viewer's own lists, never anyone else's (noindex, signed in only). "Show again" ends an exclusion
// (until = now) without deleting it; the tick deletes it a day later.
export default async function Following() {
  const me = await currentUser();
  if (!me) redirect('/login');
  const { following, hidden } = await ownLists(me.id);
  return (
    <main className="page">
      <h1>{FOLLOW.title}</h1>
      <p className="muted">{FOLLOW.private}</p>
      {following.length ? (
        <ul className="rows people">
          {following.map((t) => (
            <li key={t.handle} className="line"><Link href={`/u/${t.handle}`}><WhoName name={t.name} handle={t.handle} /></Link><div><FollowButton handle={t.handle} following signedIn /></div></li>
          ))}
        </ul>
      ) : <p>{FOLLOW.noneFollowing}</p>}
      <h2>{FOLLOW.hiddenHeading}</h2>
      <p className="muted">{FOLLOW.hiddenExplain}</p>
      {hidden.length ? (
        <ul className="rows people">
          {hidden.map((t) => (
            <li key={t.handle} className="line">
              <span><Link href={`/u/${t.handle}`}><WhoName name={t.name} handle={t.handle} /></Link> <span className="muted small">{FOLLOW.until(DAY.format(t.until!))}</span></span>
              <form action={showAgainForm.bind(null, t.handle)}><button className="secondary">{FOLLOW.showAgain}</button></form>
            </li>
          ))}
        </ul>
      ) : <p>{FOLLOW.noneHidden}</p>}
    </main>
  );
}
