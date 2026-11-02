import Link from 'next/link';
import type { PublicState } from '@/lib/connections.ts';
import { isPublicRecord, PUBLIC, RECORD_BODY } from '@/lib/copy.ts';
import { pct } from '@/lib/trades.ts';
import { counted, tone } from '@/lib/format.ts'; // F-25: tone for the pane rows
import { paneChart, paneChartSrc, type PackedChart } from '@/lib/chart-series.ts';
import { PerformanceChart } from './u/[handle]/chart.tsx';
import { Badge, PublicNotice, WhoName } from './ui.tsx';
import { FollowButton } from './follow-button.tsx';
import { NotInterested } from './not-interested.tsx';
import { OPEN, OPTIONS } from '@/lib/copy.ts';
import { PaneTradeRows, type PaneRowData } from './f25-links.tsx'; // F-25
import { ChartNote, CombinedLine, OpenGrid, RealizedLabel, longValues, toneClass } from './open-rows.tsx';
// FIXES-LABELS (D-09): the F3 line right after the figures, in both orders.
import { Disclaimer } from './disclaimer.tsx';
import { FIXES_LABELS } from '@/lib/copy.ts';
import type { Segment } from '@/lib/record-status.ts'; // FIXES-LABELS: status
import { StatusText } from './status-line.tsx'; // FIXES-LABELS: status
import { paneModel, type PaneModel } from '@/lib/pane-model.ts'; // F-23: every printed figure, from stored values
import { numericDay, wireToday } from '@/lib/public-wire.ts'; // F-23
// OPTIONS (docs/features/logs/options/plan.md D5, AC 24): the label and the count line (or the options line once open).
import { PaneOptions, ShareTradesLabel } from './u/[handle]/options-block.tsx';
import type { PaneOptionsView } from '@/lib/options-view.ts';
import { WarnNotice } from './warn-notice.tsx'; // F-27
import { ExclusionsLine } from './exclusions-line.tsx'; // F-21

export type PaneTrade = {
  id: string; symbol: string; returnPct: number; holdingDays: number; closedAt: Date; thesis: string | null; verified: boolean;
  openedAt?: Date; // FIXES-LABELS (code review, TR-7/TR-9): the entry time behind the pane's range and "New record"
  tradeKey?: string; // F-25: on the 5 latest rows (lib/feed.ts#records1), the "Last 5 trades" link to the trade page
  writtenDay?: number | null; editedDay?: number | null; // FIXES-CYCLE4-PART2 (F4-16): a published note's UTC day numbers, for the chart sheet
};

// Fix round 2 (render cost): one formatter, not one per call (same text as toLocaleDateString with these options).
// F-23: in UTC, so the server and any browser zone print the same day.
const DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const day = (iso: string) => DAY.format(new Date(iso));

// Feed profile pane (SW-1), variant C: leads with the chart and an honest one-line summary (length of
// record, trade count, worst trade), then the headline stats. All-time numbers via the pane model (lib/pane-model.ts, F-23).
// `chart`: the trader's chart drawn once per trader by the feed at screen resolution (at most FEED_CHART_POINTS points per
// range, lib/chart-series.ts), shared by that trader's cards (PR-3 fix rounds 4 and 7). The profile keeps full resolution.
// Fix round 8: on the feed it is `feedPaneChart` (a stand-in line for a long record) and the chart fetches the full one
// from `paneChartSrc` on its first swipe-open.
// F-2 PR-2: `viewer`, signed in: Follow and the "…" menu with "Not interested" (fix round 1: nothing signed out).
// FIXES-LABELS: status: `status`, the pane's status segments (line 1 without "Record since", then line 2; static mode, as
// the pane JSON is cached 60 s), before the recent trades.
// ponytail: OD-9 open positions of a frozen record keep F-6's rule — owner decision pending
// F-23: `model` (lib/pane-model.ts) is every figure the pane prints; the feed passes `trades` and the model is computed
// here on the server from stored values; app/lazy-pane.tsx passes the model the /pane route computed the same way.
export function ProfilePane({ handle, name, trades = [], model, now, state = 'connected', chart, viewer, highlight, back = true, open: unrealized = [], openAsOf, disclaimer = true, status, options, excluded }: { handle: string; name: string; trades?: PaneTrade[]; model?: PaneModel; now: Date; state?: PublicState; chart?: PackedChart; viewer?: { signedIn: boolean; following: boolean }; highlight?: string; back?: boolean; open?: number[]; openAsOf?: Date; disclaimer?: boolean; status?: Segment[]; /* OPTIONS */ options?: PaneOptionsView; /* F-21 */ excluded?: number }) {
  // F-6: the trader's open positions (connected or failed records only, lib/feed.ts); the combined figure from the whole
  // record, as on the profile. Nothing new renders without open positions. FIXES-LABELS (code review, TR-9 / TR-7): the
  // range line and New record. F-23: all of it in the model.
  const p = model ?? paneModel(trades, state, now, unrealized, openAsOf, excluded);
  const open = p.open, both = p.both;
  const trust = { badge: p.badge, incomplete: p.incomplete };
  const ev = { rangeLine: p.rangeLine, newRecord: p.newRecord };
  const pub = isPublicRecord(state); // F-7: no Follow; the not-joined line right under the chart (it stays above the fold)
  const newBadge = state !== 'importing' && !pub && p.count > 0 && ev.newRecord && <span className="badge new">New record</span>;
  const chartBlock = <>
    {/* OPTIONS fix round 3 (UX B1): with the label, the caption says the chart excludes options too. */}
    <PerformanceChart chart={chart ?? paneChart(trades, now)} src={paneChartSrc(handle)} now={wireToday(now)} linkBase={`/u/${handle}`} shareOnly={!!options?.label} noteBy={handle} />{/* F-9: UserNote in the chart sheet */}
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
    {/* F-29 (plan D5 fallback, QA M1): the one qualifier stays directly before the headline figures, as on the profile, so
        it is in view whenever any figure is (below them it fell under the fold at 360x740 while the tiles showed). */}
    {/* ponytail: cycle 5's pane line order (F-21's exclusions line, then F-34's open line, then the options qualifier) is
        not applied to the qualifier, which stays before the tiles (D5 fallback); F-21's line follows the headline and F-34
        is unbuilt — the F-34 builder owns the pane order and keeps the label in view whenever a tile is (extend
        e2e/f29-gated-wording.spec.ts's real-pane test) */}
    {options && <ShareTradesLabel show={options.label} />}
    <section className="stats" aria-label={open ? OPEN.realizedLabel : undefined} data-long={long}>
      {open && <RealizedLabel />}
      <div className="stat big"><b>{(p.winRate * 100).toFixed(0)}%</b><small>win rate</small></div>
      <div className="stat big"><b className={toneClass(p.avgReturn) /* QA round 1 (finding 8): tone of the printed value */}>{pct(p.avgReturn)}</b><small>avg return / trade</small>
        {ev.rangeLine && <small className="range">{ev.rangeLine}</small>}{/* FIXES-LABELS (code review, TR-9): as on the profile */}
      </div>
    </section>
    {/* F-21: right after the headline in DOM order, in both orders; the slot order is exclusions, open, options qualifier. */}
    <ExclusionsLine n={p.excluded} handle={handle} />
    {open && <OpenGrid o={open} asOf={p.openAsOf ? new Date(p.openAsOf) : undefined} long={long} />}
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
        {back && <button type="button" className="back" data-back><span aria-hidden="true">←</span> Back</button>}
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
      {/* F-25 Shape R: each row links to its trade page (app/f25-links.tsx; compact props, the same markup). */}
      <PaneTradeRows handle={handle} current={p.recent.findIndex((t) => t.id === highlight)}
        rows={p.recent.map((t): PaneRowData => [t.tradeKey ?? null, t.symbol, numericDay(t.day * 86_400_000) /* F-23: the UTC day */, pct(t.returnPct), tone(t.returnPct)])} />
      <p><Link href={`/u/${handle}`} className="button">See full profile<span aria-hidden="true"> →</span></Link></p>
      {/* OPTIONS fix round 2: the note follows the gate (the paneView line), so it can't go stale when the gate opens.
          QA round 1 (finding 12): a Demo record's footer names Demo, never connected accounts. */}
      <p className="muted">{pub ? PUBLIC.paneFoot : trust.badge === 'demo' ? FIXES_LABELS.paneFoot.demo : OPTIONS.paneNote(!!options?.open)}</p>
    </section>
  );
}
