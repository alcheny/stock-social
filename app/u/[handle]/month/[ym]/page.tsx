import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { currentUser } from '@/lib/session.ts';
import { pct } from '@/lib/trades.ts';
import { isPublicRecord, PROFILE, PUBLIC, RECORD_STRIP, signWord, wholeRecordView } from '@/lib/copy.ts';
import { Badge, PublicNotice } from '../../../../ui.tsx';
import { loadRecap } from '@/lib/recap-load.ts';
import { monthAlt, monthCountText, monthDescription, monthStripInput, recordStripInput } from '@/lib/recap.ts';
// FIXES-CYCLE4-PART2 (F4-4, C4-9): the month's options qualifier, count line, heading and foot.
import { monthOptionsLine } from '@/lib/recap.ts';
import { FIXES_CYCLE4_PART2 as FC4, OPTIONS } from '@/lib/copy.ts';
import { recordStrip } from '@/lib/record-strip.ts';
import { RecordStrip } from '@/app/record-strip.tsx';
import { JoinCta } from '../../join-cta.tsx';
import { TradeShare } from '../../trade/[sellId]/trade-share.tsx';
import { tradePageHref } from '@/lib/trade-href.ts'; // F-25
import { TRADE_LINK } from '@/lib/copy.ts'; // F-25
import { count } from '@/lib/format.ts';
// FIXES-LABELS (D-24): numbers and a range only in "This month" (F-12's month figures); "One of N months on record" under the h1.
import { FIXES_LABELS as FL } from '@/lib/copy.ts';
const FL_DEMO = FL.demoNote; // FIXES-LABELS (DS-20): one Demo name
// FIXES-LABELS (D-09 / D20, POLICY F3): the page's one F3 line is the record strip's (F-12), after the record's figures.
import { dateText } from '@/lib/date-text.ts';
import { recordRows, segments } from '@/lib/record-status.ts'; // FIXES-LABELS: status
import { StatusText } from '../../../../status-line.tsx'; // FIXES-LABELS: status
import { generateMetadata as notFoundMetadata } from '../../not-found.tsx';

type Params = { params: Promise<{ handle: string; ym: string }> };

// One read per request: generateMetadata and the page share it (committee round 3).
const loadOnce = cache((handle: string, ym: string) => loadRecap(handle, ym));
async function load(p: Params['params']) {
  const { handle, ym } = await p;
  return loadOnce(handle, ym);
}

const held = (d: number) => (d < 1 ? 'Held under a day' : `Held ${Math.round(d)} day${Math.round(d) === 1 ? '' : 's'}`);
const day = (d: Date) => dateText(d, new Date()); // FIXES-LABELS (D-05): the year when it is not this year

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const r = await load(params);
  // F-16/F-17: the 404 head comes from ../../not-found.tsx (hidden / retired / generic). Orchestrator review item 2:
  // returned here, never notFound() in generateMetadata (which can leave two <title>s); the body calls notFound().
  if (!r) return notFoundMetadata({ params });
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
  const link = (key: string) => tradePageHref({ handle, tradeKey: key }); // F-25: the one builder
  const Pick = ({ title, t }: { title: string; t: typeof m.best }) => (
    <section className="trade-card" aria-label={title}>
      <h2>{title}</h2>
      <Link href={link(t.tradeKey!)} className="f25-row" style={{ display: 'block', minHeight: 44, padding: '4px 0' }}>
        <span className="big" style={{ display: 'block', overflowWrap: 'anywhere' }}>{t.symbol} <span className="sr-only">{`${signWord(t.returnPct)} `}</span>{pct(t.returnPct)}</span>
        <span className="muted small">{held(t.holdingDays)}</span>
        <span className="sr-only">{TRADE_LINK.suffix(t.symbol)}</span>{/* F-25 Shape R */}
      </Link>
    </section>
  );

  return (
    <main className="page month-page">{/* QA round 1 (finding 4): .month-page tightens on a phone (globals.css) */}
      <p>
        <Link href={`/u/${handle}`}><span aria-hidden="true">←</span> {RECORD_STRIP.link(handle)}</Link>{' '}
        {r.demo && <span className="badge demo" title={FL_DEMO}>Demo</span>}
        {isPublicRecord(r.state) && <Badge kind={r.state} />}
      </p>
      {isPublicRecord(r.state) && <PublicNotice />}
      <h1>{m.label} {m.monthSoFar && <span className="muted small so-far">month so far</span>}</h1>
      {/* QA round 1 (finding 4): one muted line under the h1 (on a phone the h1's "month so far" gives way to it). */}
      {(r.months || m.monthSoFar) ? (
        <p className="muted small month-head">
          {r.months ? <span data-testid="month-of">{FL.monthOf(count(r.months))}</span> : null}
          {r.months && m.monthSoFar ? ' · ' : null}
          {m.monthSoFar && <span>Month so far: not a complete month. Trades close through today.</span>}
        </p>
      ) : null}
      {/* F-35 (UX lead user test, F3c): rows dated after now() are named here too while the month is still running. */}
      {m.monthSoFar && (r.futureWaiting ?? 0) > 0 && <p className="muted small" data-excluded-future>{PROFILE.futureWaiting(r.futureWaiting!)}</p>}
      <div className="trade-grid">
        <section className="trade-card" aria-labelledby="this-month">
          <h2 id="this-month">This month</h2>
          {/* F-12 (D-24, F3b): the same fields every month, losing months included. The month's result is the hero (its
              average in its tone, or Too early at the same weight; business lead user test 2026-11-01), the count under it.
              No win rate and no verdict. */}
          {month.figures.length > 0 && <div className="month-figures"><RecordStrip strip={month} /></div>}
          <p className="muted small" style={{ marginTop: 0 }}>{monthCountText(m.count)}</p>
          {/* FIXES-CYCLE4-PART2 (F4-4): gate closed, the month's option closes counted (legal words); with any options, the link. */}
          {r.excludingOptions && (
            <p className="muted small" data-month-options>
              {monthOptionsLine(r) && <>{monthOptionsLine(r)} </>}<Link className="tap44" href="/how#options">{OPTIONS.howLink}</Link>
            </p>
          )}
        </section>
        <section className="trade-card" aria-labelledby="whole-record">
          <h2 id="whole-record">{RECORD_STRIP.link(handle)} {whole.stats && w.newRecord && <span className="badge new">New record</span>}</h2>
          {/* FIXES-LABELS: status (F-11): the record's status line, live (this page renders per request). */}
          {/* QA round 2 (N8): two rows like the profile (since · connection, then last close · updated). */}
          {(recordRows(r.status, new Date()) ?? []).map((row, i) => <StatusText key={i} segments={segments(row)} kind={i ? 'record2' : 'record'} />)}
          {/* F-12: the record strip, as on the trade page (TR-3: only the importing line while an import runs). */}
          <RecordStrip strip={strip} exclusions={{ n: r.excluded ?? 0, handle: r.handle }} /* F-21: the whole-record strip only */ />
        </section>
      </div>
      <div className="trade-grid">
        {m.count === 1 ? <Pick title="Only trade this month" t={m.best} /> : <><Pick title="Best trade" t={m.best} /><Pick title="Worst trade" t={m.worst} /></>}
      </div>
      <h2>{FC4.monthHeading /* FIXES-CYCLE4-PART2 (F4-4; business lead, POLICY F3a): every record, the F-7 form */}</h2>
      <ol className="small" style={{ listStyle: 'none', padding: 0 }}>
        {m.trades.map((t) => (
          <li key={t.tradeKey}>
            <Link href={link(t.tradeKey!)} className="f25-row" style={{ display: 'flex', flexWrap: 'wrap', columnGap: 12, minHeight: 44, alignItems: 'center' }}>
              <span className="muted">{day(t.closedAt)}</span>
              <b>{t.symbol}</b>
              <span><span className="sr-only">{`${signWord(t.returnPct)} `}</span>{pct(t.returnPct)}</span>
              <span className="muted">{held(t.holdingDays)}</span>
              <span className="sr-only">{TRADE_LINK.suffix(t.symbol)}</span>{/* F-25 Shape R */}
            </Link>
          </li>
        ))}
      </ol>
      <TradeShare kind="month" isOwner={me !== null && me.handle === handle} path={`/u/${handle}/month/${m.ym}`} title={`${m.label} · @${handle} on Stock Social`} />
      <p className="muted small">Percentages only. Never sizes or prices.</p>
      <p className="muted small">{isPublicRecord(r.state) ? PUBLIC.recap : (r.excludingOptions ? FC4.monthFootShares : FL.monthFoot)[r.demo ? 'demo' : 'real'] /* QA round 1 (finding 12); FIXES-CYCLE4-PART2 (F4-4) */}</p>
      {!me && !r.demo && !isPublicRecord(r.state) && <JoinCta handle={handle} via="month" />}
      <p><Link href="/"><span aria-hidden="true">←</span> Feed</Link></p>
    </main>
  );
}
