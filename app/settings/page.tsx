import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session.ts';
import { BILLING, FOLLOW, PERSONALIZE, RECORD_TOOLS, SETTINGS } from '@/lib/copy.ts';
import { deleteProfile, signOut } from '../auth/actions.ts';
import { hasSubscribed } from '@/lib/billing.ts';
import { notesLineApplies } from '@/lib/delete.ts';
import { FocusHeading } from '../connect/result/focus-heading.tsx'; // FIXES-CYCLE5 (F5-23)

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
      {/* F-2 PR-5: the personalization switches. */}
      <p><Link href="/me/personalize">{PERSONALIZE.link}</Link></p>
      {/* F-3: Record tools and the account page (no price here: traders read this page too). */}
      <h2>{RECORD_TOOLS.title}</h2>
      <p><Link href="/tools">{RECORD_TOOLS.title}</Link></p>
      <p><Link href="/account">{RECORD_TOOLS.account}</Link></p>
      <h2>{SETTINGS.deleteTitle}</h2>
      {confirm ? (
        <>
          {/* FIXES-CYCLE5 (F5-23, C5-26): step 2 lands on its warning, not on the delete button; the next Tab reaches it. */}
          <p id="delete-confirm" role="alert" tabIndex={-1}><b>{SETTINGS.confirm}</b></p>
          <FocusHeading id="delete-confirm" />
          <form action={deleteProfile}><button className="wide" data-testid="delete-final">{SETTINGS.deleteAction}</button></form>
          <p><Link className="button wide secondary" href={`/u/${me.handle}`}>{SETTINGS.keep}</Link></p>
        </>
      ) : (
        <>
          <p>{SETTINGS.deleteExplain}</p>
          {/* F-3 (committee K12, K20): what deleting does to billing and to other subscribers' notes. */}
          {await hasSubscribed(me.id) && <p className="muted">{BILLING.deleteBilling}</p>}
          {/* CHORES-3 (C3-44): only when it applies (a public record, or others' notes or views name this user). */}
          {await notesLineApplies(me.id) && <p className="muted">{BILLING.deleteNotes}</p>}
          <p><Link className="button wide" href="/settings?confirm=1" data-testid="delete-first">{SETTINGS.deleteAction}</Link></p>
          <p><Link className="button wide secondary" href={`/u/${me.handle}`}>{SETTINGS.keep}</Link></p>
        </>
      )}
    </main>
  );
}
