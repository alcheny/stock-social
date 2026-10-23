import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session.ts';
import { FOLLOW, SETTINGS } from '@/lib/copy.ts';
import { deleteProfile, signOut } from '../auth/actions.ts';

export const metadata: Metadata = { title: `${SETTINGS.title} · Stock Social`, robots: { index: false, follow: false } };

// S9 (plan §2, §8 item 4): two views. View 1 explains and its "Delete my profile" only opens view 2 (a link, no
// action). View 2 says "This cannot be undone." and its primary is the only tap that deletes. No typed handle, no
// pre-checked box, no shaming.
export default async function Settings({ searchParams }: { searchParams?: Promise<{ confirm?: string }> }) {
  const me = await currentUser();
  if (!me) redirect('/login');
  const confirm = (await searchParams)?.confirm === '1';
  return (
    <main className="page auth">
      <h1>{SETTINGS.title}</h1>
      <form action={signOut}><button className="secondary">{SETTINGS.signOut}</button></form>
      {/* F-2 PR-2: follows and "Not interested", with "Show again". */}
      <p><Link href="/me/following">{FOLLOW.settingsLink}</Link></p>
      <h2>{SETTINGS.deleteTitle}</h2>
      {confirm ? (
        <>
          <p role="alert"><b>{SETTINGS.confirm}</b></p>
          <form action={deleteProfile}><button className="wide" data-testid="delete-final">{SETTINGS.deleteAction}</button></form>
          <p><Link className="button wide secondary" href={`/u/${me.handle}`}>{SETTINGS.keep}</Link></p>
        </>
      ) : (
        <>
          <p>{SETTINGS.deleteExplain}</p>
          <p><Link className="button wide" href="/settings?confirm=1" data-testid="delete-first">{SETTINGS.deleteAction}</Link></p>
          <p><Link className="button wide secondary" href={`/u/${me.handle}`}>{SETTINGS.keep}</Link></p>
        </>
      )}
    </main>
  );
}
