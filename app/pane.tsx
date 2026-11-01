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
// FIXES-LABELS (D-09): the F3 line right after the figures, in both orders.
import { Disclaimer } from './disclaimer.tsx';
import { FIXES_LABELS } from '@/lib/copy.ts';
import type { Segment } from '@/lib/record-status.ts'; // FIXES-LABELS: status
import { StatusText } from './status-line.tsx'; // FIXES-LABELS: status
import { paneEvidence } from '@/lib/pane-evidence.ts'; // FIXES-LABELS (code review): the profile's range and New record
// OPTIONS (docs/features/logs/options/plan.md D5, AC 24): the label and the count line (or the options line once open).
import { PaneOptions, ShareTradesLabel } from './u/[handle]/options-block.tsx';
import type { PaneOptionsView } from '@/lib/options-view.ts';
import { WarnNotice } from './warn-notice.tsx'; // F-27

export type PaneTrade = {
  id: string; symbol: string; returnPct: number; holdingDays: number; closedAt: Date; thesis: string | null; verified: boolean;
  openedAt?: Date; // FIXES-LABELS (code review, TR-7/TR-9): the entry time behind the pane's range and "New record"
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
// FIXES-LABELS: status: `status`, the pane's status segments (line 1 without "Record since", then line 2; static mode, as
// the pane JSON is cached 60 s), before the recent trades.
// ponytail: OD-9 open positions of a frozen record keep F-6's rule — owner decision pending
export function ProfilePane({ handle, name, trades, now, state = 'connected', chart, viewer, highlight, back = true, open: unrealized = [], openAsOf, disclaimer = true, status, options }: { handle: string; name: string; trades: PaneTrade[]; now: Date; state?: PublicState; chart?: PackedChart; viewer?: { signedIn: boolean; following: boolean }; highlight?: string; back?: boolean; open?: number[]; openAsOf?: Date; disclaimer?: boolean; status?: Segment[]; /* OPTIONS */ options?: PaneOptionsView }) {
  const p = paneSummary(trades);
  // F-6: the trader's open positions (connected or failed records only, lib/feed.ts); the combined figure from the whole
  // record, as on the profile. Nothing new renders without open positions.
  const open = openSummary(unrealized);
  const both = open && combined(trades.map((t) => t.returnPct), unrealized);
  const trust = paneTrust(trades, state);
  const ev = paneEvidence(trades, now); // FIXES-LABELS (code review, TR-9 / TR-7)
  const pub = isPublicRecord(state); // F-7: no Follow; the not-joined line right under the chart (it stays above the fold)
  const newBadge = state !== 'importing' && !pub && trades.length > 0 && ev.newRecord && <span className="badge new">New record</span>;
  const chartBlock = <>
    {/* OPTIONS fix round 3 (UX B1): with the label, the caption says the chart excludes options too. */}
    <PerformanceChart chart={chart ?? paneChart(trades, now)} src={paneChartSrc(handle)} now={now} linkBase={`/u/${handle}`} shareOnly={!!options?.label} noteBy={handle} />{/* F-9: UserNote in the chart sheet */}
    {open && <ChartNote o={open} />}
  </>;
  // QA round 2 (B1): F-7's not-joined line and its correction link follow the F3 line, which sits right after the chart
  // (still "chart, then the line" in order, f7-public-feed.spec), so the F3 line stays on the first screen.
  const publicLine = pub && <PublicNotice />;
  const summary = p.since && p.worst && (
    <p className="summary">
      Since first closed trade, {day(p.since)}: {counted(p.count, 'closed trade')}. Worst: {p.worst.symbol}{' '}
      <b className={toneClass(p.worst.returnPct)}>{pct(p.worst.returnPct)}</b>.
      {trust.badge === 'demo' && <span className="muted"> {FIXES_LABELS.demoNote /* FIXES-LABELS (DS-20): one Demo name */}</span>}
    </p>
  );
  const incomplete = trust.incomplete && <WarnNotice role="status">{RECORD_BODY.failed}</WarnNotice>;
  const long = open ? longValues(pct(p.avgReturn), pct(open.avg), String(open.n)) : undefined;
  const figures = <>
    {options && <ShareTradesLabel show={options.label} />}
    <section className="stats" aria-label={open ? OPEN.realizedLabel : undefined} data-long={long}>
      {open && <RealizedLabel />}
      <div className="stat big"><b>{(p.winRate * 100).toFixed(0)}%</b><small>win rate</small></div>
      <div className="stat big"><b className={toneClass(p.avgReturn) /* QA round 1 (finding 8): tone of the printed value */}>{pct(p.avgReturn)}</b><small>avg return / trade</small>
        {ev.rangeLine && <small className="range">{ev.rangeLine}</small>}{/* FIXES-LABELS (code review, TR-9): as on the profile */}
      </div>
    </section>
    {open && <OpenGrid o={open} asOf={openAsOf} long={long} />}
    {both && <CombinedLine c={both} />}
    <PaneOptions v={options} />
  </>;
  // FIXES-LABELS (D-09): the F3 line directly after the first block that shows performance: the figures when they lead
  // (open positions), else the chart (its header prints the return), so it is in view when the pane opens at 360×740.
  // Off inside a sheet that carries its own .sheet-note (one F3 line per sheet).
  const f3 = disclaimer && <Disclaimer />;
  // ponytail: OD-9 open positions of a frozen record keep F-6's rule — owner decision pending
  return (
    <section className="pane" aria-label={`${name}'s record`}>
      <header>
        {back && <button type="button" className="back" data-back>← Back</button>}
        {/* Fix round 1 (UX 6): room for the whole handle plus the start of the name; the header wraps before it would
            squeeze the name away, and the name ends in an ellipsis. */}
        <Link href={`/u/${handle}`} className="who" style={{ minWidth: `min(100%, ${handle.length + 4}ch)` }}><WhoName name={name} handle={handle} /></Link>
        {trust.badge && <Badge kind={trust.badge} />}
        {/* FIXES-LABELS (code review, TR-7); F-7 (C17): never on a public record. Signed in it leads the actions row, so the
            header keeps its two lines on a phone (a line of its own pushed the chart under the swipe-back's path). */}
        {viewer?.signedIn ? <div className={pub ? 'pane-actions inline' /* QA round 2 (B1): "…" alone, beside the badges */ : 'pane-actions'}>{newBadge}{!pub && <FollowButton handle={handle} following={viewer.following} signedIn />}<NotInterested handle={handle} /></div> : newBadge}
      </header>
      {/* F-6 (business lead D1): with open positions the figures lead, as on the profile (the pane is where most viewers
          meet a record, SW-1); without them, today's order. */}
      {open ? <>{incomplete}{figures}{f3}{chartBlock}{publicLine}{summary}</> : <>{chartBlock}{f3}{publicLine}{summary}{incomplete}{figures}</>}
      {status && <StatusText segments={status} kind="pane" />}{/* FIXES-LABELS: status */}
      {/* ponytail: K1 option trades are not on feed cards and this last-5 list is share trades only (the pane carries the
          label and the line) — when feed cards come, cap the ranking size term at 100% for options (long losses stop at
          -100%, so uncapped gains would tilt the feed toward winners). */}
      <h3>Last {counted(p.recent.length, 'trade')}</h3>
      <ul className="rows">
        {p.recent.map((t) => (
          <li key={t.id} className={t.id === highlight ? 'line hl' : 'line'} aria-current={t.id === highlight ? 'true' : undefined}>
            <span><b>{t.symbol}</b> <span className="muted">{t.closedAt.toLocaleDateString('en-US')}</span></span>
            <b className={toneClass(t.returnPct)}>{pct(t.returnPct)}</b>
          </li>
        ))}
      </ul>
      <p><Link href={`/u/${handle}`} className="button">See full profile →</Link></p>
      {/* OPTIONS fix round 2: the note follows the gate (the paneView line), so it can't go stale when the gate opens.
          QA round 1 (finding 12): a Demo record's footer names Demo, never connected accounts. */}
      <p className="muted">{pub ? PUBLIC.paneFoot : trust.badge === 'demo' ? FIXES_LABELS.paneFoot.demo : OPTIONS.paneNote(!!options?.open)}</p>
    </section>
  );
}
