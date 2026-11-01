import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { listHeld, reviewQueueOn } from '@/lib/thesis-review.ts';

// fix-user-text B (F-9): the held-thesis review queue, read-only. A 404 unless REVIEW_QUEUE=1, and always a 404 in
// production. It never reads the session (no admin rights come from the dev sign-in stub); publishing or keeping a
// thesis is done with the owner's script, scripts/review-theses.ts.
// ponytail: off until real admin identity exists — then gate this page on that identity and add publish/keep actions.
// Fix round 1: rows name the trade by symbol and close date; the vendor's activity id (sell_id) is never shown.
const DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

export const metadata: Metadata = { title: 'Held notes · review', robots: { index: false, follow: false } };

export default async function ReviewTheses() {
  await connection(); // the flag is read per request, never baked in at build time
  if (!reviewQueueOn()) notFound();
  const rows = await listHeld();
  return (
    <main className="page">
      <h1>Held notes</h1>
      <p className="muted small">Read-only. Release or keep with <code>scripts/review-theses.ts</code>.</p>
      {rows.length === 0 ? <p className="muted">No held notes.</p> : (
        <ul className="rows">
          {rows.map((r) => (
            <li key={`${r.userId}-${r.sellId}`}>
              <p className="small muted" style={{ margin: 0 }}>@{r.handle} · {r.symbol ?? 'trade not shown'}{r.closedAt ? ` · closed ${DAY.format(new Date(r.closedAt))}` : ''} · rule: {r.rule ?? 'none'} · reports: {r.reports}{r.reviewed ? ' · reviewed, kept held' : ''}</p>
              <p style={{ margin: '4px 0 0', overflowWrap: 'anywhere' }}><bdi>{r.thesis}</bdi></p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
