import Link from 'next/link';
import { paneSummary, paneTrust } from '@/lib/pane.ts';
import type { PublicState } from '@/lib/connections.ts';
import { isPublicRecord, PUBLIC, RECORD_BODY } from '@/lib/copy.ts';
import { pct } from '@/lib/trades.ts';
import { counted } from '@/lib/format.ts';
import { paneChart, paneChartSrc, type PackedChart } from '@/lib/chart-series.ts';
import { PerformanceChart } from './u/[handle]/chart.tsx';
import { Badge, PublicNotice, WhoName } from './ui.tsx';
import { FollowButton } from './follow-button.tsx';
import { NotInterested } from './not-interested.tsx';
import { combined, openSummary } from '@/lib/open-split.ts';
import { OPEN, OPTIONS } from '@/lib/copy.ts';
import { ChartNote, CombinedLine, OpenGrid, RealizedLabel, longValues, toneClass } from './open-rows.tsx';
// OPTIONS (docs/features/logs/options/plan.md D5, AC 24): the label and the count line (or the options line once open).
import { PaneOptions, ShareTradesLabel } from './u/[handle]/options-block.tsx';
import type { PaneOptionsView } from '@/lib/options-view.ts';

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
// F-2 PR-2: `viewer`, signed in: Follow and the "…" menu with "Not interested" (fix round 1: nothing signed out).
export function ProfilePane({ handle, name, trades, now, state = 'connected', chart, viewer, highlight, back = true, open: unrealized = [], openAsOf, options }: { handle: string; name: string; trades: PaneTrade[]; now: Date; state?: PublicState; chart?: PackedChart; viewer?: { signedIn: boolean; following: boolean }; highlight?: string; back?: boolean; open?: number[]; openAsOf?: Date; /* OPTIONS */ options?: PaneOptionsView }) {
  const p = paneSummary(trades);
  // F-6: the trader's open positions (connected or failed records only, lib/feed.ts); the combined figure from the whole
  // record, as on the profile. Nothing new renders without open positions.
  const open = openSummary(unrealized);
  const both = open && combined(trades.map((t) => t.returnPct), unrealized);
  const trust = paneTrust(trades, state);
  const pub = isPublicRecord(state); // F-7: no Follow; the not-joined line right under the chart (it stays above the fold)
  const chartBlock = <>
    {/* OPTIONS fix round 3 (UX B1): with the label, the caption says the chart excludes options too. */}
    <PerformanceChart chart={chart ?? paneChart(trades, now)} src={paneChartSrc(handle)} now={now} linkBase={`/u/${handle}`} shareOnly={!!options?.label} />
    {open && <ChartNote o={open} />}
    {pub && <PublicNotice />}
  </>;
  const summary = p.since && p.worst && (
    <p className="summary">
      Since first closed trade, {day(p.since)}: {counted(p.count, 'closed trade')}. Worst: {p.worst.symbol}{' '}
      <b className={p.worst.returnPct > 0 ? 'up' : 'down'}>{pct(p.worst.returnPct)}</b>.
      {trust.badge === 'demo' && <span className="muted"> Sample data, not from a real broker.</span>}
    </p>
  );
  const incomplete = trust.incomplete && <p role="status" className="down record-failed">{RECORD_BODY.failed}</p>;
  const long = open ? longValues(pct(p.avgReturn), pct(open.avg), String(open.n)) : undefined;
  const figures = <>
    {options && <ShareTradesLabel show={options.label} />}
    <section className="stats" aria-label={open ? OPEN.realizedLabel : undefined} data-long={long}>
      {open && <RealizedLabel />}
      <div className="stat big"><b>{(p.winRate * 100).toFixed(0)}%</b><small>win rate</small></div>
      <div className="stat big"><b className={open ? toneClass(p.avgReturn) : p.avgReturn > 0 ? 'up' : 'down'}>{pct(p.avgReturn)}</b><small>avg return / trade</small></div>
    </section>
    {open && <OpenGrid o={open} asOf={openAsOf} long={long} />}
    {both && <CombinedLine c={both} />}
    <PaneOptions v={options} />
  </>;
  return (
    <section className="pane" aria-label={`${name}'s record`}>
      <header>
        {back && <button type="button" className="back" data-back>← Back</button>}
        {/* Fix round 1 (UX 6): room for the whole handle plus the start of the name; the header wraps before it would
            squeeze the name away, and the name ends in an ellipsis. */}
        <Link href={`/u/${handle}`} className="who" style={{ minWidth: `min(100%, ${handle.length + 4}ch)` }}><WhoName name={name} handle={handle} /></Link>
        {trust.badge && <Badge kind={trust.badge} />}
        {viewer?.signedIn && <div className="pane-actions">{!pub && <FollowButton handle={handle} following={viewer.following} signedIn />}<NotInterested handle={handle} /></div>}
      </header>
      {/* F-6 (business lead D1): with open positions the figures lead, as on the profile (the pane is where most viewers
          meet a record, SW-1); without them, today's order. */}
      {open ? <>{incomplete}{figures}{chartBlock}{summary}</> : <>{chartBlock}{summary}{incomplete}{figures}</>}
      {/* ponytail: K1 option trades are not on feed cards and this last-5 list is share trades only (the pane carries the
          label and the line) — when feed cards come, cap the ranking size term at 100% for options (long losses stop at
          -100%, so uncapped gains would tilt the feed toward winners). */}
      <h3>Last {counted(p.recent.length, 'trade')}</h3>
      <ul className="rows">
        {p.recent.map((t) => (
          <li key={t.id} className={t.id === highlight ? 'line hl' : 'line'} aria-current={t.id === highlight ? 'true' : undefined}>
            <span><b>{t.symbol}</b> <span className="muted">{t.closedAt.toLocaleDateString('en-US')}</span></span>
            <b className={t.returnPct > 0 ? 'up' : 'down'}>{pct(t.returnPct)}</b>
          </li>
        ))}
      </ul>
      <p><Link href={`/u/${handle}`} className="button">See full profile →</Link></p>
      {/* OPTIONS fix round 2: the note follows the gate (the paneView line), so it can't go stale when the gate opens. */}
      <p className="muted">{pub ? PUBLIC.paneFoot : OPTIONS.paneNote(!!options?.open)}</p>
    </section>
  );
}
