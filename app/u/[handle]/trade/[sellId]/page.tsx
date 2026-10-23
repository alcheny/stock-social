import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { currentUser } from '@/lib/session.ts';
import { pct } from '@/lib/trades.ts';
import { wholeRecordPreview, wholeRecordView } from '@/lib/copy.ts';
import { decodeSellId, loadTradeShare } from '@/lib/trade-share-load.ts';
import { JoinCta } from '../../join-cta.tsx';
import { TradeShare } from './trade-share.tsx';

type Params = { params: Promise<{ handle: string; sellId: string }> };

async function load(p: Params['params']) {
  const { handle, sellId } = await p;
  const id = decodeSellId(sellId);
  return id === null ? null : loadTradeShare(handle, id);
}

const held = (d: number) => (d < 1 ? 'Held under a day' : `Held ${Math.round(d)} day${Math.round(d) === 1 ? '' : 's'}`);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const t = await load(params);
  if (!t) return {};
  return {
    title: `${t.symbol} ${pct(t.returnPct)} · @${t.handle} · Stock Social`,
    // Fix round 6: "verified" only for a whole record from the broker; "demo" for demo data.
    // Reviewer fix (TR-3): no whole-record stats while an import runs; the incomplete line first on a failed one.
    description: wholeRecordPreview({ state: t.state, demo: t.demo, verified: t.verified, trades: t.record.trades }, `${(t.record.winRate * 100).toFixed(0)}% win rate · ${pct(t.record.avgReturn)} avg return`),
  };
}

export default async function TradePage({ params }: Params) {
  const t = await load(params);
  if (!t) notFound();
  const me = await currentUser();
  const path = `/u/${t.handle}/trade/${encodeURIComponent((await params).sellId)}`;
  const closed = new Date(t.closedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const n = t.record.trades;
  const whole = wholeRecordView({ state: t.state, demo: t.demo });

  return (
    <main className="page">
      <p>
        <Link href={`/u/${t.handle}`}>← @{t.handle}&apos;s full record</Link>{' '}
        {t.demo && <span className="badge demo" title="Sample data, not from a real broker.">Demo</span>}
      </p>
      <div className="trade-grid">
        <section className="trade-card" aria-labelledby="this-trade">
          <h2 id="this-trade">This trade</h2>
          <h1 style={{ margin: 0 }}>{t.symbol}</h1>
          <p className="big"><span className="sr-only">{t.returnPct < 0 ? 'Loss ' : 'Gain '}</span>{pct(t.returnPct)}</p>
          <p className="muted small">{held(t.holdingDays)} · closed {closed}</p>
          {t.thesis && <blockquote>“{t.thesis}”</blockquote>}
        </section>
        <section className="trade-card" aria-labelledby="whole-record">
          <h2 id="whole-record">Their whole record {whole.stats && t.newRecord && <span className="badge new">New record</span>}</h2>
          {/* Fix round 6 and the reviewer fix (TR-3): the profile's record-state rule. A failed import is never presented
              as a whole record; while an import runs no whole-record stats show, only the importing line. */}
          {whole.tone === 'warn' && <p role="status" className="down record-failed">{whole.line}</p>}
          {whole.stats ? <>
            <p className="big">{(t.record.winRate * 100).toFixed(0)}%</p>
            <p className="muted small" style={{ marginTop: 0 }}>win rate · {n} closed trade{n === 1 ? '' : 's'} · {pct(t.record.avgReturn)} avg return</p>
            <p className="small">{t.record.evidence}{t.record.range ? ` ${t.record.range}` : ''}</p>
            {t.newRecord && <p className="muted small">Short record: {n} closed trade{n === 1 ? '' : 's'} so far. A short record shows wide uncertainty.</p>}
          </> : <p role="status" className="muted importing">{whole.line}</p>}
          <Link href={`/u/${t.handle}`}>See their record, wins and losses →</Link>
        </section>
      </div>
      <TradeShare isOwner={me !== null && me.handle === t.handle} path={path} title={`${t.symbol} ${pct(t.returnPct)} · @${t.handle} on Stock Social`} />
      <p className="muted small">Percentages only. Never sizes or prices.</p>
      {!me && !t.demo && <JoinCta handle={t.handle} via="trade" />}
      <p><Link href="/">← Feed</Link></p>
    </main>
  );
}
