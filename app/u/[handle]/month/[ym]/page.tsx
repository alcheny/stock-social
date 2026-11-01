import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { currentUser } from '@/lib/session.ts';
import { pct } from '@/lib/trades.ts';
import { isPublicRecord, PUBLIC, RECORD_STRIP, signWord, wholeRecordView } from '@/lib/copy.ts';
import { Badge, PublicNotice } from '../../../../ui.tsx';
import { loadRecap } from '@/lib/recap-load.ts';
import { monthAlt, monthCountText, monthDescription, monthStripInput, recordStripInput } from '@/lib/recap.ts';
import { recordStrip } from '@/lib/record-strip.ts';
import { RecordStrip } from '@/app/record-strip.tsx';
import { JoinCta } from '../../join-cta.tsx';
import { TradeShare } from '../../trade/[sellId]/trade-share.tsx';

type Params = { params: Promise<{ handle: string; ym: string }> };

// One read per request: generateMetadata and the page share it (committee round 3).
const loadOnce = cache((handle: string, ym: string) => loadRecap(handle, ym));
async function load(p: Params['params']) {
  const { handle, ym } = await p;
  return loadOnce(handle, ym);
}

const held = (d: number) => (d < 1 ? 'Held under a day' : `Held ${Math.round(d)} day${Math.round(d) === 1 ? '' : 's'}`);
const day = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const r = await load(params);
  if (!r) return {};
  // F-12: the strip's words. Reviewer fix (TR-3): the record part follows the profile's record-state rule, as on the
  // trade page. The image's alt text is declared here because it depends on the record (F-4 pattern).
  const whole = recordStrip(recordStripInput(r), 'image');
  const month = recordStrip(monthStripInput(r), 'figures');
  return {
    title: `${r.recap.label} · @${r.handle} · Stock Social`,
    alternates: { canonical: `/u/${r.handle}/month/${r.recap.ym}` }, // F-15 second half: untagged, one address
    description: monthDescription(r, whole),
    openGraph: { images: [{ url: `/u/${r.handle}/month/${r.recap.ym}/opengraph-image`, width: 1200, height: 630, type: 'image/png', alt: monthAlt(r, whole, month) }] },
    ...(isPublicRecord(r.state) ? { robots: { index: false, follow: false } } : {}), // F-7 fix round 3: noindex
  };
}

export default async function RecapPage({ params }: Params) {
  const r = await load(params);
  if (!r) notFound();
  const me = await currentUser();
  const { recap: m, record: w, handle } = r;
  const whole = wholeRecordView({ state: r.state, demo: r.demo });
  const strip = recordStrip(recordStripInput(r), 'page');
  // The month's figures (average with its range, or Too early) under the same record-state rule: none while an import runs.
  const month = recordStrip(monthStripInput(r), 'figures');
  const link = (id: string) => `/u/${handle}/trade/${encodeURIComponent(id)}`;
  const Pick = ({ title, t }: { title: string; t: typeof m.best }) => (
    <section className="trade-card" aria-label={title}>
      <h2>{title}</h2>
      <Link href={link(t.sellId)} style={{ display: 'block', minHeight: 44, padding: '4px 0' }}>
        <span className="big" style={{ display: 'block', overflowWrap: 'anywhere' }}>{t.symbol} <span className="sr-only">{`${signWord(t.returnPct)} `}</span>{pct(t.returnPct)}</span>
        <span className="muted small">{held(t.holdingDays)}</span>
      </Link>
    </section>
  );

  return (
    <main className="page">
      <p>
        <Link href={`/u/${handle}`}>← {RECORD_STRIP.link(handle)}</Link>{' '}
        {r.demo && <span className="badge demo" title="Sample data, not from a real broker.">Demo</span>}
        {isPublicRecord(r.state) && <Badge kind={r.state} />}
      </p>
      {isPublicRecord(r.state) && <PublicNotice />}
      <h1>{m.label} {m.monthSoFar && <span className="muted small">month so far</span>}</h1>
      {m.monthSoFar && <p className="muted small">Not a complete month. Trades close through today.</p>}
      <div className="trade-grid">
        <section className="trade-card" aria-labelledby="this-month">
          <h2 id="this-month">This month</h2>
          {/* F-12 (D-24, F3b): the same fields every month, losing months included. The month's result is the hero (its
              average in its tone, or Too early at the same weight; business lead user test 2026-11-01), the count under it.
              No win rate and no verdict. */}
          {month.figures.length > 0 && <div className="month-figures"><RecordStrip strip={month} /></div>}
          <p className="muted small" style={{ marginTop: 0 }}>{monthCountText(m.count)}</p>
        </section>
        <section className="trade-card" aria-labelledby="whole-record">
          <h2 id="whole-record">{RECORD_STRIP.link(handle)} {whole.stats && w.newRecord && <span className="badge new">New record</span>}</h2>
          {/* F-12: the record strip, as on the trade page (TR-3: only the importing line while an import runs). */}
          <RecordStrip strip={strip} />
        </section>
      </div>
      <div className="trade-grid">
        {m.count === 1 ? <Pick title="Only trade this month" t={m.best} /> : <><Pick title="Best trade" t={m.best} /><Pick title="Worst trade" t={m.worst} /></>}
      </div>
      <h2>{isPublicRecord(r.state) ? 'Closed trades this month' : 'All trades this month'}</h2>
      <ol className="small" style={{ listStyle: 'none', padding: 0 }}>
        {m.trades.map((t) => (
          <li key={t.sellId}>
            <Link href={link(t.sellId)} style={{ display: 'flex', flexWrap: 'wrap', columnGap: 12, minHeight: 44, alignItems: 'center' }}>
              <span className="muted">{day(t.closedAt)}</span>
              <b>{t.symbol}</b>
              <span><span className="sr-only">{`${signWord(t.returnPct)} `}</span>{pct(t.returnPct)}</span>
              <span className="muted">{held(t.holdingDays)}</span>
            </Link>
          </li>
        ))}
      </ol>
      <TradeShare kind="month" isOwner={me !== null && me.handle === handle} path={`/u/${handle}/month/${m.ym}`} title={`${m.label} · @${handle} on Stock Social`} />
      <p className="muted small">Percentages only. Never sizes or prices.</p>
      <p className="muted small">{isPublicRecord(r.state) ? PUBLIC.recap : <>Recaps list the month&apos;s closed trades from connected accounts, and none can be hidden.</>}</p>
      {!me && !r.demo && !isPublicRecord(r.state) && <JoinCta handle={handle} via="month" />}
      <p><Link href="/">← Feed</Link></p>
    </main>
  );
}
