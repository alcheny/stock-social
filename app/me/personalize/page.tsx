import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session.ts';
import { hasActivity, settingsFor } from '@/lib/discovery/activity.ts';
import { HIDDEN_TRADES, PERSONALIZE } from '@/lib/copy.ts';
import { clearActivityForm, setActivityForm, setPersonalizeForm } from './actions.ts';

export const metadata: Metadata = { title: `${PERSONALIZE.title} · Stock Social`, robots: { index: false, follow: false } };

// F-2 PR-5 (criteria 12, 13): the viewer's two switches, each an On/Off pair of equally prominent buttons (same class and
// size, side by side at 360 px; aria-pressed carries the state, a visual-only ✓ and outline mark it, never color alone),
// and "Clear my activity". Everything works without JavaScript. The status line shows only a `?saved=` value that
// matches the stored state, so a crafted link states nothing false.
type Saved = keyof typeof PERSONALIZE.saved;
export default async function Personalize({ searchParams }: { searchParams?: Promise<{ saved?: string }> }) {
  const me = await currentUser();
  if (!me) redirect('/login');
  const [s, stored] = await Promise.all([settingsFor(me.id), hasActivity(me.id)]);
  const saved = (await searchParams)?.saved;
  const ok: Record<Saved, boolean> = { feedOn: s.personalize, feedOff: !s.personalize, activityOn: s.activity, activityOff: !s.activity, cleared: !stored, nothing: !stored }; // review fix 3: "cleared" only when nothing is stored
  const status = typeof saved === 'string' && Object.hasOwn(ok, saved) && ok[saved as Saved] ? PERSONALIZE.saved[saved as Saved] : '';
  const pair = (id: string, title: string, on: boolean, act: (on: boolean) => Promise<void>) => (
    <div role="group" aria-labelledby={id} className="switch-pair">
      {([true, false] as const).map((v) => (
        <form key={String(v)} action={act.bind(null, v)}>
          <button className={`switch${on === v ? ' current' : ''}`} aria-pressed={on === v} aria-label={v ? PERSONALIZE.groupOn(title) : PERSONALIZE.groupOff(title)}>
            {on === v && <span aria-hidden="true">✓ </span>}{v ? PERSONALIZE.on : PERSONALIZE.off}
          </button>
        </form>
      ))}
    </div>
  );
  return (
    <main className="page personalize">
      <h1>{PERSONALIZE.title}</h1>
      <p role="status" className="follow-status">{status}</p>
      <h2 id="p-feed">{PERSONALIZE.feedTitle}</h2>
      <p>{PERSONALIZE.feedExplain}</p>
      {pair('p-feed', PERSONALIZE.feedTitle, s.personalize, setPersonalizeForm)}
      <h2 id="p-activity">{PERSONALIZE.activityTitle}</h2>
      <p>{PERSONALIZE.activityExplain}</p>
      {!s.personalize && <p className="muted small">{PERSONALIZE.activityPaused}</p>}
      {pair('p-activity', PERSONALIZE.activityTitle, s.activity, setActivityForm)}
      <form action={clearActivityForm}><button className="secondary" data-testid="clear-activity">{PERSONALIZE.clear}</button></form>
      <p><Link href="/me/following">← {HIDDEN_TRADES.backLink}</Link></p>
    </main>
  );
}
