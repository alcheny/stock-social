import type { Metadata } from 'next';
import Link from 'next/link';
const FL_THESIS = 'Why they made this trade'; // QA round 1 (finding 4): the thesis box's heading
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { currentUser } from '@/lib/session.ts';
import { pct } from '@/lib/trades.ts';
import { isPublicRecord, PUBLIC, RECORD_STRIP, signWord, wholeRecordView } from '@/lib/copy.ts';
import { Badge, PublicNotice } from '../../../../ui.tsx';
import { toneClass } from '@/lib/open-split.ts';
import { decodeSellId, loadTradeShare } from '@/lib/trade-share-load.ts';
import { tradeAlt, tradeDescription, tradeStripInput } from '@/lib/trade-share.ts';
import { recordStrip } from '@/lib/record-strip.ts';
import { RecordStrip } from '@/app/record-strip.tsx';
import { JoinCta } from '../../join-cta.tsx';
import { TradeShare } from './trade-share.tsx';
// FIXES-LABELS (D-09 / D20, POLICY F3): the page's one F3 line is the record strip's (F-12), after the record's figures.
import { RowBadge } from '../../../../ui.tsx';
import { paneTrust } from '@/lib/pane.ts';
import { recordRows, segments } from '@/lib/record-status.ts'; // FIXES-LABELS: status
import { StatusText } from '../../../../status-line.tsx'; // FIXES-LABELS: status
import { UserNote } from '../../../../user-note.tsx';

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
    ...(isPublicRecord(t.state) ? { robots: { index: false, follow: false } } : {}), // F-7 fix round 3: noindex
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
        {/* QA round 2 (N9): no Demo badge here; the "This trade" box carries it, one per box */}
        {isPublicRecord(t.state) && <Badge kind={t.state} />}
      </p>
      <div className="trade-grid">
        <section className="trade-card" aria-labelledby="this-trade">
          <h2 id="this-trade">This trade {!isPublicRecord(t.state) /* F-7: the header carries the public badge once */ && <RowBadge kind={paneTrust([{ verified: t.verified }], t.state).badge} />}</h2>
          <h1 style={{ margin: 0 }}>{t.symbol}</h1>
          {/* A11Y-FIXES #23: tone and sign word follow the printed value (0.0% is neutral, "Flat"). */}
          <p className={toneClass(t.returnPct) ? `big ${toneClass(t.returnPct)}` : 'big'}><span className="sr-only">{`${signWord(t.returnPct)} `}</span>{pct(t.returnPct)}</p>
          <p className="muted small">{held(t.holdingDays)} · closed {closed}</p>
        </section>
        <section className="trade-card" aria-labelledby="whole-record">
          <h2 id="whole-record">{RECORD_STRIP.link(t.handle)} {whole.stats && t.newRecord && <span className="badge new">New record</span>}</h2>
          {/* FIXES-LABELS: status (F-11): the record's status line, live (this page renders per request). */}
          {/* QA round 2 (N8): two rows like the profile (since · connection, then last close · updated). */}
          {(recordRows(t.status, new Date()) ?? []).map((row, i) => <StatusText key={i} segments={segments(row)} kind={i ? 'record2' : 'record'} />)}
          {/* F-12: the record strip (F-10's one component): label, the incomplete line on a failed import (.record-failed),
              or only the importing line while an import runs (TR-3), the figures, the link to the profile and the
              disclaimer. The strip's link replaces the old footer link (one link per destination). */}
          <RecordStrip strip={strip} />
        </section>
      </div>
      {/* QA round 2 (Q4, as B1 for the pane): F-7's not-joined line and the filing links follow the record's figures and their
          F3 line (the header's "Public filing" badge names the source above them), so the F3 line is on the first screen
          at 360 and 320 with 15% to spare. */}
      {t.filings && <><PublicNotice />{/* F-7 (legal C15, AC 16): the not-joined line, then the purchase's and the sale's filings. */}
        <p className="filing-links">{t.filings.bought.map((u) => <a key={u} className="filing-link" href={u} target="_blank" rel="noopener noreferrer" aria-label={PUBLIC.boughtName(t.symbol)}>{PUBLIC.bought}</a>)}
          <a className="filing-link" href={t.filings.sold} target="_blank" rel="noopener noreferrer" aria-label={PUBLIC.soldName(t.symbol)}>{PUBLIC.sold}</a></p></>}
      {/* QA round 1 (finding 4, D-09): the thesis after the figures and their F3 line, so a 280-character thesis never
          pushes the line below the first screen; it is still the trader's own words about this trade, in full. */}
      {t.thesis && (
        <section className="trade-card trade-thesis" aria-labelledby="trade-thesis">
          <h2 id="trade-thesis">{FL_THESIS}</h2>
          {/* F-9: UserNote. t.thesis is published-only (nulled in SQL, lib/trade-share-load.ts); Report for a signed-in non-author. */}
          <UserNote text={t.thesis} handle={t.handle} writtenAt={t.note?.writtenAt ?? null} editedAt={t.note?.editedAt ?? null} reportId={me && me.handle !== t.handle ? t.note?.tradeId : undefined} symbol={t.symbol} />
        </section>
      )}
      <TradeShare isOwner={me !== null && me.handle === t.handle} path={path} title={`${t.symbol} ${pct(t.returnPct)} · @${t.handle} on Stock Social`} />
      <p className="muted small">Percentages only. Never sizes or prices.</p>
      {!me && !t.demo && !t.filings && <JoinCta handle={t.handle} via="trade" />}
      <p><Link href="/">← Feed</Link></p>
    </main>
  );
}
