import type { Metadata } from 'next';
import Link from 'next/link';
import { toneView } from '@/lib/tone-view.ts'; // QA round 1 (finding 8): tone of the printed value
const FL_THESIS = 'Why they made this trade'; // QA round 1 (finding 4): the thesis box's heading
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { currentUser } from '@/lib/session.ts';
import { pct } from '@/lib/trades.ts';
import { RECORD_STRIP, wholeRecordView } from '@/lib/copy.ts';
import { decodeSellId, loadTradeShare } from '@/lib/trade-share-load.ts';
import { tradeAlt, tradeDescription, tradeStripInput } from '@/lib/trade-share.ts';
import { recordStrip } from '@/lib/record-strip.ts';
import { RecordStrip } from '@/app/record-strip.tsx';
import { JoinCta } from '../../join-cta.tsx';
import { TradeShare } from './trade-share.tsx';
// FIXES-LABELS (D-09 / D20, POLICY F3): the page's one F3 line is the record strip's (F-12), after the record's figures.
import { RowBadge } from '../../../../ui.tsx';
import { paneTrust } from '@/lib/pane.ts';
import { FIXES_LABELS as FLD } from '@/lib/copy.ts';
const FL_DEMO = FLD.demoNote; // FIXES-LABELS (DS-20): one Demo name
import { recordSegments } from '@/lib/record-status.ts'; // FIXES-LABELS: status
import { StatusText } from '../../../../status-line.tsx'; // FIXES-LABELS: status

type Params = { params: Promise<{ handle: string; sellId: string }> };

// One read per request: generateMetadata and the page share it (committee round 3).
const loadOnce = cache((handle: string, sellId: string) => {
  const id = decodeSellId(sellId);
  return id === null ? null : loadTradeShare(handle, id);
});
async function load(p: Params['params']) {
  const { handle, sellId } = await p;
  return loadOnce(handle, sellId);
}

const held = (d: number) => (d < 1 ? 'Held under a day' : `Held ${Math.round(d)} day${Math.round(d) === 1 ? '' : 's'}`);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { sellId } = await params;
  const t = await load(params);
  if (!t) return {};
  // F-12: the strip's words. Fix round 6: "verified" only for a whole record from the broker; "demo" for demo data.
  // Reviewer fix (TR-3): no record stats while an import runs; the incomplete line first on a failed one. The image's
  // alt text is the strip in words, declared here because a file-level alt is static (F-4 pattern).
  const strip = recordStrip(tradeStripInput(t), 'image');
  const url = `/u/${t.handle}/trade/${encodeURIComponent(sellId)}/opengraph-image`;
  return {
    title: `${t.symbol} ${pct(t.returnPct)} · @${t.handle} · Stock Social`,
    description: tradeDescription(t, strip),
    openGraph: { images: [{ url, width: 1200, height: 630, type: 'image/png', alt: tradeAlt(t, strip) }] },
  };
}

export default async function TradePage({ params }: Params) {
  const t = await load(params);
  if (!t) notFound();
  const me = await currentUser();
  const path = `/u/${t.handle}/trade/${encodeURIComponent((await params).sellId)}`;
  const closed = new Date(t.closedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const whole = wholeRecordView({ state: t.state, demo: t.demo });
  const strip = recordStrip(tradeStripInput(t), 'page');

  return (
    <main className="page trade-page">{/* QA round 1 (finding 4): .trade-page tightens on a phone (globals.css) */}
      <p>
        <Link href={`/u/${t.handle}`}>← {RECORD_STRIP.link(t.handle)}</Link>{' '}
        {t.demo && <span className="badge demo" title={FL_DEMO}>Demo</span>}
      </p>
      <div className="trade-grid">
        <section className="trade-card" aria-labelledby="this-trade">
          <h2 id="this-trade">This trade <RowBadge kind={paneTrust([{ verified: t.verified }], t.state).badge} /></h2>
          <h1 style={{ margin: 0 }}>{t.symbol}</h1>
          <p className={`big ${toneView(t.returnPct).cls}`}><span className="sr-only">{`${toneView(t.returnPct).word} `}</span>{pct(t.returnPct)}</p>
          <p className="muted small">{held(t.holdingDays)} · closed {closed}</p>
        </section>
        <section className="trade-card" aria-labelledby="whole-record">
          <h2 id="whole-record">{RECORD_STRIP.link(t.handle)} {whole.stats && t.newRecord && <span className="badge new">New record</span>}</h2>
          {/* FIXES-LABELS: status (F-11): the record's status line, live (this page renders per request). */}
          <StatusText segments={recordSegments(t.status, new Date()) ?? []} kind="record" />
          {/* F-12: the record strip (F-10's one component): label, the incomplete line on a failed import (.record-failed),
              or only the importing line while an import runs (TR-3), the figures, the link to the profile and the
              disclaimer. The strip's link replaces the old footer link (one link per destination). */}
          <RecordStrip strip={strip} />
        </section>
      </div>
      {/* QA round 1 (finding 4, D-09): the thesis after the figures and their F3 line, so a 280-character thesis never
          pushes the line below the first screen; it is still the trader's own words about this trade, in full. */}
      {t.thesis && (
        <section className="trade-card trade-thesis" aria-labelledby="trade-thesis">
          <h2 id="trade-thesis">{FL_THESIS}</h2>
          <blockquote>“{t.thesis}”</blockquote>
        </section>
      )}
      <TradeShare isOwner={me !== null && me.handle === t.handle} path={path} title={`${t.symbol} ${pct(t.returnPct)} · @${t.handle} on Stock Social`} />
      <p className="muted small">Percentages only. Never sizes or prices.</p>
      {!me && !t.demo && <JoinCta handle={t.handle} via="trade" />}
      <p><Link href="/">← Feed</Link></p>
    </main>
  );
}
