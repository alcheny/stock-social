import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { currentUser } from '@/lib/session.ts';
import { pct } from '@/lib/trades.ts';
import { RECORD_BODY } from '@/lib/copy.ts';
import { loadRecap } from '@/lib/recap-load.ts';
import { JoinCta } from '../../join-cta.tsx';
import { TradeShare } from '../../trade/[sellId]/trade-share.tsx';

type Params = { params: Promise<{ handle: string; ym: string }> };

async function load(p: Params['params']) {
  const { handle, ym } = await p;
  return loadRecap(handle, ym);
}

const held = (d: number) => (d < 1 ? 'Held under a day' : `Held ${Math.round(d)} day${Math.round(d) === 1 ? '' : 's'}`);
const plural = (n: number) => `${n} closed trade${n === 1 ? '' : 's'}`;
const day = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const r = await load(params);
  if (!r) return {};
  return {
    title: `${r.recap.label} · @${r.handle} · Stock Social`,
    description: `${plural(r.recap.count)} this month · whole record: ${plural(r.record.trades)} · ${(r.record.winRate * 100).toFixed(0)}% win rate`,
  };
}

export default async function RecapPage({ params }: Params) {
  const r = await load(params);
  if (!r) notFound();
  const me = await currentUser();
  const { recap: m, record: w, handle } = r;
  const link = (id: string) => `/u/${handle}/trade/${encodeURIComponent(id)}`;
  const Pick = ({ title, t }: { title: string; t: typeof m.best }) => (
    <section className="trade-card" aria-label={title}>
      <h2>{title}</h2>
      <Link href={link(t.sellId)} style={{ display: 'block', minHeight: 44, padding: '4px 0' }}>
        <span className="big" style={{ display: 'block', overflowWrap: 'anywhere' }}>{t.symbol} <span className="sr-only">{t.returnPct < 0 ? 'Loss ' : 'Gain '}</span>{pct(t.returnPct)}</span>
        <span className="muted small">{held(t.holdingDays)}</span>
      </Link>
    </section>
  );

  return (
    <main className="page">
      <p>
        <Link href={`/u/${handle}`}>← @{handle}&apos;s full record</Link>{' '}
        {r.demo && <span className="badge demo" title="Sample data, not from a real broker.">Demo</span>}
      </p>
      <h1>{m.label} {m.monthSoFar && <span className="muted small">month so far</span>}</h1>
      {m.monthSoFar && <p className="muted small">Not a complete month. Trades close through today.</p>}
      <div className="trade-grid">
        <section className="trade-card" aria-labelledby="this-month">
          <h2 id="this-month">This month</h2>
          {m.showHeadline ? (
            <>
              <p className="big">{(m.winRate * 100).toFixed(0)}%</p>
              <p className="muted small" style={{ marginTop: 0 }}>win rate · {plural(m.count)} · {pct(m.avgReturn)} avg return</p>
            </>
          ) : (
            <>
              <p className="big">{plural(m.count)} this month</p>
              <p className="muted small" style={{ marginTop: 0 }}>Too few trades for a win rate. The month&apos;s trades are listed below.</p>
            </>
          )}
          <p className="small">{m.evidence}{m.range ? ` ${m.range}` : ''}</p>
        </section>
        <section className="trade-card" aria-labelledby="whole-record">
          <h2 id="whole-record">Their whole record {w.newRecord && <span className="badge new">New record</span>}</h2>
          {/* Fix round 6 (TR-3): a failed import is never presented as a whole record, here as on the profile. */}
          {r.state === 'failed' && <p role="status" className="down record-failed">{RECORD_BODY.failed}</p>}
          <p className="big">{(w.winRate * 100).toFixed(0)}%</p>
          <p className="muted small" style={{ marginTop: 0 }}>win rate · {plural(w.trades)} · {pct(w.avgReturn)} avg return</p>
          <p className="small">{w.evidence}{w.range ? ` ${w.range}` : ''}</p>
          {w.newRecord && <p className="muted small">Short record: {plural(w.trades)} so far. A short record shows wide uncertainty.</p>}
        </section>
      </div>
      <div className="trade-grid">
        {m.count === 1 ? <Pick title="Only trade this month" t={m.best} /> : <><Pick title="Best trade" t={m.best} /><Pick title="Worst trade" t={m.worst} /></>}
      </div>
      <h2>All trades this month</h2>
      <ol className="small" style={{ listStyle: 'none', padding: 0 }}>
        {m.trades.map((t) => (
          <li key={t.sellId}>
            <Link href={link(t.sellId)} style={{ display: 'flex', flexWrap: 'wrap', columnGap: 12, minHeight: 44, alignItems: 'center' }}>
              <span className="muted">{day(t.closedAt)}</span>
              <b>{t.symbol}</b>
              <span><span className="sr-only">{t.returnPct < 0 ? 'Loss ' : 'Gain '}</span>{pct(t.returnPct)}</span>
              <span className="muted">{held(t.holdingDays)}</span>
            </Link>
          </li>
        ))}
      </ol>
      <TradeShare isOwner={false} path={`/u/${handle}/month/${m.ym}`} title={`${m.label} · @${handle} on Stock Social`} />
      <p className="muted small">Percentages only. Never sizes or prices.</p>
      <p className="muted small">Recaps list the month&apos;s closed trades from connected accounts, and none can be hidden.</p>
      <p><Link href={`/u/${handle}`}>See their record, wins and losses →</Link></p>
      {!me && !r.demo && <JoinCta handle={handle} via="month" />}
      <p><Link href="/">← Feed</Link></p>
    </main>
  );
}
