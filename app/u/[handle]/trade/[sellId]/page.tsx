import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { cache } from 'react';
import { currentUser } from '@/lib/session.ts';
import { pct } from '@/lib/trades.ts';
import { isPublicRecord, PUBLIC, RECORD_STRIP, signWord, wholeRecordView } from '@/lib/copy.ts';
import { Badge, PublicNotice } from '../../../../ui.tsx';
import { toneClass } from '@/lib/open-split.ts';
import { decodeSellId, legacyTradeKey, loadTradeShareByKey } from '@/lib/trade-share-load.ts';
import { tradePageHref, withQuery } from '@/lib/trade-href.ts'; // F-25: the one trade URL builder
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
import { HeldNote } from '@/lib/user-note.ts';
import { loadOwnNote } from '@/lib/own-note.ts';

const FL_THESIS = 'Why they made this trade'; // QA round 1 (finding 4): the thesis box's heading

// F-25: the segment is the trade's trade_key (the folder keeps its old name; only the variable is renamed).
type Params = { params: Promise<{ handle: string; sellId: string }> };
type Search = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// One read per request: generateMetadata and the page share it (committee round 3). F-25: by trade_key only; a hex key
// decodes the same way in both, so the metadata and the page always agree on whether the trade exists.
const loadOnce = cache((handle: string, segment: string) => {
  const key = decodeSellId(segment);
  return key === null ? null : loadTradeShareByKey(handle, key);
});

// F-25: an old link names the trade by its closing sell's vendor id. In the page body only (never generateMetadata, where
// a redirect can stream as a soft one, and never proxy.ts): 308 to the trade_key URL with the request's query string
// (so `?via=` survives), under the page's visibility rule; anything else falls through to notFound().
async function legacyRedirect(p: Params['params'], q: Search['searchParams']) {
  const { handle, sellId: segment } = await p;
  const id = decodeSellId(segment);
  const key = id === null ? null : await legacyTradeKey(handle, id);
  if (!key) return;
  permanentRedirect(withQuery(tradePageHref({ handle, tradeKey: key }), await q));
}
async function load(p: Params['params']) {
  const { handle, sellId } = await p;
  return loadOnce(handle, sellId);
}

const held = (d: number) => (d < 1 ? 'Held under a day' : `Held ${Math.round(d)} day${Math.round(d) === 1 ? '' : 's'}`);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const t = await load(params);
  if (!t) return {};
  // F-12: the strip's words. Fix round 6: "verified" only for a whole record from the broker; "demo" for demo data.
  // Reviewer fix (TR-3): no record stats while an import runs; the incomplete line first on a failed one. The image's
  // alt text is the strip in words, declared here because a file-level alt is static (F-4 pattern).
  const strip = recordStrip(tradeStripInput(t), 'image');
  const href = tradePageHref({ handle: t.handle, tradeKey: t.tradeKey! });
  const url = `${href}/opengraph-image`; // F-25: the image and the canonical link from the one builder
  return {
    title: `${t.symbol} ${pct(t.returnPct)} · @${t.handle} · Stock Social`,
    alternates: { canonical: href }, // F-15 second half: one spelling, untagged; F-25: the trade_key form
    description: tradeDescription(t, strip),
    openGraph: { images: [{ url, width: 1200, height: 630, type: 'image/png', alt: tradeAlt(t, strip) }] },
    ...(isPublicRecord(t.state) ? { robots: { index: false, follow: false } } : {}), // F-7 fix round 3: noindex
  };
}

export default async function TradePage({ params, searchParams }: Params & Search) {
  const t = await load(params);
  if (!t) { await legacyRedirect(params, searchParams); notFound(); }
  const me = await currentUser();
  // F-26: the author's held note (the author loader runs only for the trader; never in generateMetadata or the image).
  // Only the trader, signed in, on a trade with no published note and not a public filer's (filers post none).
  const own = me && me.handle === t.handle && !t.thesis && !isPublicRecord(t.state) ? await loadOwnNote(me.id, t.note.tradeId, t.handle) : null;
  // F-15 second half: one spelling, the same as the canonical link. F-25: the trade_key form (lib/trade-href.ts); a hex
  // key has no characters to decode, so the earlier '%'-in-a-sell-id mismatch between metadata and page cannot occur.
  const path = tradePageHref({ handle: t.handle, tradeKey: t.tradeKey! });
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
        <p className="filing-links">{t.filings.bought.map((u, i, all) => <a key={u} className="filing-link" href={u} target="_blank" rel="noopener noreferrer" aria-label={PUBLIC.boughtNameOf(t.symbol, i + 1, all.length)}>{PUBLIC.bought}</a>)}
          <a className="filing-link" href={t.filings.sold} target="_blank" rel="noopener noreferrer" aria-label={PUBLIC.soldNameOn(t.symbol, closed)}>{PUBLIC.sold}</a></p></>}
      {/* QA round 1 (finding 4, D-09): the thesis after the figures and their F3 line, so a 280-character thesis never
          pushes the line below the first screen; it is still the trader's own words about this trade, in full. */}
      {/* F-26: the section also holds the author's held line (author only: `own` is null for every viewer, so a viewer's page
          is the same for a held note as for none). */}
      {(t.thesis || own) && (
        <section className="trade-card trade-thesis" aria-labelledby="trade-thesis">
          <h2 id="trade-thesis">{FL_THESIS}</h2>
          {/* F-9: UserNote. t.thesis is published-only (nulled in SQL, lib/trade-share-load.ts); Report for a signed-in non-author. */}
          {t.thesis && <UserNote text={t.thesis} handle={t.handle} writtenAt={t.note?.writtenAt ?? null} editedAt={t.note?.editedAt ?? null} reportId={me && me.handle !== t.handle ? t.note?.tradeId : undefined} symbol={t.symbol} />}
          {/* F-26: only the author sees their held note's line, in the note's place, with the link to its profile row. */}
          {own && <HeldNote rule={own.rule} edit={own.edit} />}
        </section>
      )}
      <TradeShare kind="trade" isOwner={me !== null && me.handle === t.handle} path={path} title={`${t.symbol} ${pct(t.returnPct)} · @${t.handle} on Stock Social`} />
      <p className="muted small">Percentages only. Never sizes or prices.</p>
      {!me && !t.demo && !t.filings && <JoinCta handle={t.handle} via="trade" />}
      <p><Link href="/">← Feed</Link></p>
    </main>
  );
}
