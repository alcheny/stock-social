import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session.ts';
import { backHandle, ownHiddenTrades } from '@/lib/likes.ts';
import { HIDDEN_TRADES } from '@/lib/copy.ts';
import { Arrowed } from '../../arrow.tsx'; // C5-39
import { showTradeAgainForm } from './actions.ts';
import { RowBadge, WhoName } from '../../ui.tsx';

export const metadata: Metadata = { title: `${HIDDEN_TRADES.title} · Stock Social`, robots: { index: false, follow: false } };
const DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

// F-2 PR-5 (criterion 15): the viewer's own hidden trades, never anyone else's (noindex, signed in only), newest first,
// 30 a page. No return is shown (the trade page carries the record and the disclaimer). "Show again" works without
// JavaScript; the status line names the trader only when that trade exists and is no longer hidden by this viewer.
export default async function HiddenTrades({ searchParams }: { searchParams?: Promise<{ after?: string; back?: string }> }) {
  const me = await currentUser();
  if (!me) redirect('/login');
  const sp = (await searchParams) ?? {};
  const [{ rows, next }, back] = await Promise.all([ownHiddenTrades(me.id, sp.after), sp.back ? backHandle(me.id, sp.back) : null]);
  return (
    <main className="page">
      <h1>{HIDDEN_TRADES.title}</h1>
      <p className="muted">{HIDDEN_TRADES.explain}</p>
      <p role="status" className="follow-status">{back ? HIDDEN_TRADES.back(back) : ''}</p>
      {rows.length ? (
        <ul className="rows people hidden-trades">
          {rows.map((r) => {
            const day = DAY.format(r.closedAt);
            return (
              <li key={r.key} className="line">
                <span className="who-col">
                  <Link href={`/u/${r.handle}`}><WhoName name={r.name} handle={r.handle} /></Link>
                  <span className="small"><span className="closed"><RowBadge kind={r.filer ?? (r.verified ? null : 'demo')} />{HIDDEN_TRADES.closed(r.symbol, day)}</span>
                    <Link href={`/u/${r.handle}/trade/${encodeURIComponent(r.sellId)}`}><Arrowed text={HIDDEN_TRADES.trade} /></Link></span>
                </span>
                <form action={showTradeAgainForm.bind(null, r.key, sp.after)}>
                  <button className="secondary" aria-label={HIDDEN_TRADES.showAgainFor(r.handle, r.symbol, day)}>{HIDDEN_TRADES.showAgain}</button>
                </form>
              </li>
            );
          })}
        </ul>
      ) : <p>{HIDDEN_TRADES.none}</p>}
      {next && <p><Link className="button secondary" href={`/me/hidden?after=${next}`}>{HIDDEN_TRADES.older}</Link></p>}
      <p><Link href="/me/following"><span aria-hidden="true">←</span> {HIDDEN_TRADES.backLink}</Link></p>
    </main>
  );
}
