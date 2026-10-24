import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session.ts';
import { ownLikes } from '@/lib/likes.ts';
import { LIKES } from '@/lib/copy.ts';
import { pct } from '@/lib/trades.ts';
import { removeLikeForm } from '../../discovery-actions.ts';
import { WhoName } from '../../ui.tsx';

export const metadata: Metadata = { title: `${LIKES.title} · Stock Social`, robots: { index: false, follow: false } };
const DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// F-2 PR-4: the viewer's own likes, never anyone else's (noindex, signed in only), newest first, 50 a page (a viewer
// with 10,000 likes pages through them). No count anywhere. "Remove" ends the like, with or without JavaScript.
export default async function Likes({ searchParams }: { searchParams?: Promise<{ after?: string }> }) {
  const me = await currentUser();
  if (!me) redirect('/login');
  const after = (await searchParams)?.after;
  const { rows, next } = await ownLikes(me.id, after);
  return (
    <main className="page">
      <h1>{LIKES.title}</h1>
      <p className="muted">{LIKES.private}</p>
      {rows.length ? (
        <ul className="rows people likes">
          {rows.map((r) => (
            <li key={r.key} className="line">
              <span className="who-col">
                <Link href={`/u/${r.handle}/trade/${encodeURIComponent(r.sellId)}`}>{LIKES.closed(r.symbol, DAY.format(r.closedAt))}</Link>{' '}
                <b className={r.returnPct > 0 ? 'up' : 'down'}>{pct(r.returnPct)}</b>
                <span className="small"><WhoName name={r.name} handle={r.handle} /></span>
              </span>
              <form action={removeLikeForm.bind(null, r.key, after)}><button className="secondary" aria-label={LIKES.removeFor(r.symbol)}>{LIKES.remove}</button></form>
            </li>
          ))}
        </ul>
      ) : <p>{LIKES.none}</p>}
      {next && <p><Link className="button secondary" href={`/me/likes?after=${next}`}>{LIKES.older}</Link></p>}
      <p><Link href="/me/following">← {LIKES.back}</Link></p>
    </main>
  );
}
