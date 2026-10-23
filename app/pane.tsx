import Link from 'next/link';
import { paneSummary, paneTrust } from '@/lib/pane.ts';
import type { PublicState } from '@/lib/connections.ts';
import { RECORD_BODY } from '@/lib/copy.ts';
import { pct } from '@/lib/trades.ts';
import { counted } from '@/lib/format.ts';
import { paneChart, paneChartSrc, type PackedChart } from '@/lib/chart-series.ts';
import { PerformanceChart } from './u/[handle]/chart.tsx';
import { Badge, WhoName } from './ui.tsx';

export type PaneTrade = {
  id: string; symbol: string; returnPct: number; holdingDays: number; closedAt: Date; thesis: string | null; verified: boolean;
};

// Fix round 2 (render cost): one formatter, not one per call (same text as toLocaleDateString with these options).
const DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const day = (d: Date) => DAY.format(d);

// Feed profile pane (SW-1), variant C: leads with the chart and an honest one-line summary (length of
// record, trade count, worst trade), then the headline stats. All-time numbers via paneSummary().
// `chart`: the trader's chart drawn once per trader by the feed at screen resolution (at most FEED_CHART_POINTS points per
// range, lib/chart-series.ts), shared by that trader's cards (PR-3 fix rounds 4 and 7). The profile keeps full resolution.
// Fix round 8: on the feed it is `feedPaneChart` (a stand-in line for a long record) and the chart fetches the full one
// from `paneChartSrc` on its first swipe-open.
export function ProfilePane({ handle, name, trades, now, state = 'connected', chart }: { handle: string; name: string; trades: PaneTrade[]; now: Date; state?: PublicState; chart?: PackedChart }) {
  const p = paneSummary(trades);
  const trust = paneTrust(trades, state);
  return (
    <section className="pane" aria-label={`${name}'s record`}>
      <header>
        <button type="button" className="back" data-back>← Back</button>
        <Link href={`/u/${handle}`} className="who"><WhoName name={name} handle={handle} /></Link>
        {trust.badge && <Badge verified={trust.badge === 'verified'} />}
      </header>
      <PerformanceChart chart={chart ?? paneChart(trades, now)} src={paneChartSrc(handle)} now={now} linkBase={`/u/${handle}`} />
      {p.since && p.worst && (
        <p className="summary">
          Since first closed trade, {day(p.since)}: {counted(p.count, 'closed trade')}. Worst: {p.worst.symbol}{' '}
          <b className={p.worst.returnPct > 0 ? 'up' : 'down'}>{pct(p.worst.returnPct)}</b>.
          {trust.badge === 'demo' && <span className="muted"> Sample data, not from a real broker.</span>}
        </p>
      )}
      {trust.incomplete && <p role="status" className="down record-failed">{RECORD_BODY.failed}</p>}
      <section className="stats">
        <div className="stat big"><b>{(p.winRate * 100).toFixed(0)}%</b><small>win rate</small></div>
        <div className="stat big"><b className={p.avgReturn > 0 ? 'up' : 'down'}>{pct(p.avgReturn)}</b><small>avg return / trade</small></div>
      </section>
      <h3>Last {counted(p.recent.length, 'trade')}</h3>
      <ul className="rows">
        {p.recent.map((t) => (
          <li key={t.id} className="line">
            <span><b>{t.symbol}</b> <span className="muted">{t.closedAt.toLocaleDateString('en-US')}</span></span>
            <b className={t.returnPct > 0 ? 'up' : 'down'}>{pct(t.returnPct)}</b>
          </li>
        ))}
      </ul>
      <p><Link href={`/u/${handle}`} className="button">See full profile →</Link></p>
      <p className="muted">Closed trades from connected accounts are published, losses included. Options and positions with no recorded entry aren't shown.</p>
    </section>
  );
}
