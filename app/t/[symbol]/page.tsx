import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation'; // A11Y-FIXES #21
import { sql } from '@/lib/db.ts';
import { visibleUser, visibleUserIds } from '@/lib/visible-users.ts';
import { recordStates, type PublicState } from '@/lib/connections.ts';
import { rowBadge } from '@/lib/pane.ts';
import { decodeSymbolParam, isIndexableTicker, selectTheses, tickerDescription, trustKind } from '@/lib/ticker.ts';
import { relatedSymbolsSql, tickerHeadline, tickerPageWithBaseline, type TickerBaseline, type TickerPage } from '../ticker-sql.ts';
// FIXES-LABELS (D-03): the page names one state, Demo, and never calls Demo trades verified.
import { FC5, FIXES_LABELS as FL } from '@/lib/copy.ts';
// FIXES-LABELS (D-09 / D20, POLICY F3): the F3 line in plain view after the first performance block.
import { Disclaimer } from '../../disclaimer.tsx';
import { dateText } from '@/lib/date-text.ts';
import { pct, rangeText } from '@/lib/trades.ts';
import { toneClass } from '@/lib/open-split.ts'; // A11Y-FIXES #23
import { MIN_BETS } from '@/lib/confidence.ts';
import { earlyText } from '@/lib/zero-width.ts'; // FIXES-CYCLE5 part 2 (C5-4)
import { Badge, RowBadge } from '../../ui.tsx';
import Spread from './Spread.tsx';
import Timeline from './Timeline.tsx';
import HoldTime from './HoldTime.tsx';
import Concentration from './Concentration.tsx';
import Theses from './Theses.tsx';
import { tradePageHref } from '@/lib/trade-href.ts'; // F-25
import { signWord, TRADE_LINK } from '@/lib/copy.ts'; // F-25
import Baseline from './Baseline.tsx';

import Watch, { loadWatch, markSeen } from './Watch.tsx';
// F-6: open positions in this stock, aggregate only.
import OpenPositions from './OpenPositions.tsx';
import { symbolOpen } from '../open-positions.ts';

type Params = { params: Promise<{ symbol: string }>; searchParams?: Promise<{ watch?: string | string[] }> };

const CAP = 500;
const EXPLAINER = 'Verified closed trades in this stock from connected accounts, newest first. Percentages only. Few trades means a wide range, and that is expected.';
// FIXES-LABELS (PR #85 review, nit 3): row dates in UTC, the year always (lib/date-text.ts), not the server's zone.
const date = (d: Date) => dateText(d, d, { year: 'always' });
const held = (d: number) => (d < 1 ? '<1d' : `${Math.round(d)}d`);

// The summary and charts are SQL aggregates over every trade (app/t/ticker-sql.ts); only the CAP newest rows are read.
async function load(raw: string): Promise<{ symbol: string | null; d: (TickerPage & { baseline: TickerBaseline | null }) | null; rows: TickerPage['rows'] }> {
  const symbol = decodeSymbolParam(raw);
  if (!symbol) return { symbol: null, d: null, rows: [] };
  // FIXES-LABELS (code review): the baseline is read in the page's own snapshot.
  const d = await tickerPageWithBaseline(symbol, new Date(), CAP);
  return { symbol, d, rows: d.rows };
}


export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const symbol = decodeSymbolParam((await params).symbol);
  if (!symbol) notFound(); // A11Y-FIXES #21: an invalid symbol is a real 404
  const head = await tickerHeadline(symbol);
  const s = head.summary;
  // FIXES-CYCLE5 (F5-13, C5-23): an empty stock page's title says it is empty (no "verified" claim); 200 and noindex stay.
  const title = s.n === 0 ? `${FC5.tickerEmptyTitle(symbol)} · Stock Social` : FL.tickerTitle[trustKind(s)](symbol);
  if (!s.n) return { title, description: `No verified closed trades in ${symbol} yet.`, robots: { index: false } };
  const thin = !isIndexableTicker({ verifiedTrades: head.verifiedTrades, verifiedTraders: head.verifiedTraders });
  return {
    title,
    ...(thin ? { robots: { index: false } } : {}),
    description: tickerDescription(symbol, s),
  };
}

export default async function Ticker({ params, searchParams }: Params) {
  const { symbol, rows, d } = await load((await params).symbol);
  if (!symbol) notFound(); // A11Y-FIXES #21: an invalid symbol is a real 404
  const w = (await searchParams)?.watch;
  const capHit = (Array.isArray(w) ? w[0] : w) === 'cap';
  // Session is read only here, never in generateMetadata, sitemap, robots or the OG image.
  const watchState = symbol ? await loadWatch(symbol) : { signedIn: false, watching: false };
  if (!symbol || !d || !rows.length) {
    const open = symbol ? (await symbolOpen(symbol)).get(symbol) : undefined;
    await markSeen(symbol ?? '', watchState);
    return (
      <main className="page">
        <p><Link href="/t">← All stocks</Link></p>
        <h1>{symbol ?? 'Ticker not found'}</h1>
        {symbol && <Watch symbol={symbol} state={watchState} capHit={capHit} />}
        <p className="muted">{EXPLAINER}</p>
        <p>{symbol
          ? `No verified closed trades in ${symbol} yet. Trades appear here when traders connect a broker and close a position in this stock.`
          : "That doesn't look like a ticker symbol."}</p>
        {symbol && open && <OpenPositions symbol={symbol} open={open} closes={false} />}
        <p><Link href="/">Back to the feed</Link> · <Link href="/t">All stocks</Link></p>
      </main>
    );
  }
  const s = d.summary;
  const c = s.conf!;
  const range = rangeText(c);
  const shown = rows.slice(0, CAP);
  // Grouped in SQL: one row per related symbol, at most 8.
  const related = await relatedSymbolsSql(symbol);
  // All trades, not the display cap (SQL bins and median). Non-finite values are dropped so bin counts always sum to n.
  const returns = d.returns;
  const spread = d.spread;
  // Held text is never selected: status is filtered in SQL, and selectTheses re-checks it.
  const thesisRows = (await sql`
    select t.id, t.trade_key, t.user_id, u.handle, t.return_pct, t.holding_days, t.closed_at, t.verified, t.thesis, t.thesis_status, t.thesis_written_at, t.thesis_edited_at -- A11Y-FIXES #22
    from closed_trades t join users u on u.id = t.user_id and ${visibleUser('u')}
    where t.symbol = ${symbol} and t.filing_url is null and t.thesis_status = 'published' and t.thesis is not null
    order by t.closed_at desc, t.id desc
    limit 20`) as unknown as { id: number; trade_key: string; user_id: number; handle: string; return_pct: number; holding_days: number; closed_at: Date; verified: boolean; thesis: string | null; thesis_status: string | null; thesis_written_at: Date | null; thesis_edited_at: Date | null }[]; // A11Y-FIXES #22
  // Fix round 5 (TR-3): one batched read of the record state of every trader named on the page (listed rows and
  // theses); a failed record shows no Verified badge.
  const named = [...rows, ...thesisRows];
  const states = await recordStates([...new Set(named.map((r) => r.user_id))]);
  const stateByHandle = new Map<string, PublicState>(named.map((r) => [r.handle, states.get(r.user_id)?.state ?? 'connected']));
  const badgeFor = (verified: boolean, handle: string) => rowBadge(verified, stateByHandle.get(handle));
  const theses = selectTheses(thesisRows.map((r) => ({ id: r.id, tradeKey: r.trade_key, handle: r.handle, thesis: r.thesis, thesisStatus: r.thesis_status, returnPct: r.return_pct, holdingDays: r.holding_days, closedAt: r.closed_at, verified: r.verified, writtenAt: r.thesis_written_at, editedAt: r.thesis_edited_at }))); // A11Y-FIXES #22
  // Cohort follows the ticker: verified rows if it has any, otherwise the Demo rows, this symbol excluded; on a mixed
  // stock this stock's side is its verified rows too (app/t/ticker-sql.ts#tickerPageWithBaseline, same snapshot).
  const baseline = d.baseline;
  const open = (await symbolOpen(symbol)).get(symbol);
  // Last, after all page queries, so page content is unaffected.
  await markSeen(symbol, watchState);
  return (
    <main className="page">
      <p><Link href="/t">← All stocks</Link></p>
      <h1 style={{ marginBottom: 4 }}>{symbol} {!s.mixed && <Badge verified={!s.demoOnly} />}</h1>
      <Watch symbol={symbol} state={watchState} capHit={capHit} />
      <p className="muted" style={{ marginTop: 0 }}>{FL.tickerExplainer[trustKind(s)]}</p>

      <section className="stats ticker-stats" aria-label="Summary">{/* FIXES-LABELS (PR #85 review, nit 1): ticker-stats tightens at 320 */}
        <div className="stat big"><b>{(s.winRate! * 100).toFixed(0)}%</b><small>win rate</small></div>
        <div className="stat big"><b className={toneClass(s.avgReturn!)}>{pct(s.avgReturn!)}</b><small>avg return / trade</small>{/* A11Y-FIXES #23 */}
          <small className="range">{range ? `${range} · 95% range` : earlyText(c.k) /* FIXES-CYCLE5 part 2 (C5-4) */}</small>
          <small className="median">median {pct(spread.median! / 100)}</small>
        </div>
      </section>
      {/* FIXES-LABELS (D-09, design system §4.3): directly under the stats block */}
      <Disclaimer />
      {/* FIXES-LABELS: the Demo / mixed note under the figures it qualifies (the heading badge and explainer name the state above). */}
      {s.demoOnly && <p role="note" className="muted">{FL.demoPage}</p>}
      {s.mixed && <p role="note" className="muted">{FL.mixedNote}</p>}
      <p className="muted small">{s.n} trades · {s.traders} trader{s.traders === 1 ? '' : 's'}</p>
      {/* docs/POLICY.md F3b: a page about a security never rates or scores the security, so no verdict line here */}
      <div className="evidence">
        <p className="muted small" style={{ margin: 0 }}>Different traders, different sizes and timing. This is what happened, not a prediction or a rating of the stock.</p>
      </div>
      {/* FIXES-LABELS (D-09): the compare form follows the figures and their caveats, so the F3 line is in view at 360×740. */}
      <form action="/t/compare" method="get" className="compare-form">
        <input type="hidden" name="a" value={symbol} />
        <label htmlFor="compare-b">Compare with…</label>
        <input id="compare-b" name="b" maxLength={10} autoCapitalize="characters" autoComplete="off" spellCheck={false} />
        <button type="submit">Compare</button>
      </form>
      {/* F-6 (UX lead D5): after the closed-trade figures' caveat, so each caveat sits with its own figures. */}
      {open && <OpenPositions symbol={symbol} open={open} />}

      <Concentration c={d.concentration} symbol={symbol} demoOnly={s.demoOnly} mixed={s.mixed} />

      {baseline && <Baseline summary={s} symbol={symbol} others={baseline.others} self={baseline.self} />}

      {spread.n > 0 && (
        <>
          <Spread spread={spread} returns={returns} symbol={symbol} demoOnly={s.demoOnly} mixed={s.mixed} />
          {c.k < MIN_BETS && <p className="muted small">Too early to tell ({c.k} of {MIN_BETS} bets)</p>}
        </>
      )}

      <Timeline timeline={d.timeline} symbol={symbol} demoOnly={s.demoOnly} mixed={s.mixed} />
      <HoldTime holds={d.holds} symbol={symbol} demoOnly={s.demoOnly} mixed={s.mixed} />

      <Theses list={theses} symbol={symbol} badgeFor={badgeFor} />

      <h2>Trades (newest first)</h2>
      {s.n > CAP && <p className="muted small">Showing the {CAP} most recent of {s.n}. The summary covers all {s.n}.</p>}
      <ul className="rows ticker-rows" aria-label={`Closed trades in ${symbol}, newest first`}>
        {shown.map((r) => (
          <li key={r.id}>
            {/* F-25 Shape R: the whole row is the one link, to the trade page; named by its visible text (no aria-label),
                the sign word before the figure and the visually hidden suffix. The profile is one tap further. */}
            <Link href={tradePageHref({ handle: r.handle, tradeKey: r.trade_key })} className="trow f25-row">
              <span className="who">@{r.handle} <RowBadge kind={badgeFor(r.verified, r.handle)} /></span>
              <b className={toneClass(r.return_pct)}><span className="sr-only">{`${signWord(r.return_pct)} `}</span>{pct(r.return_pct)}</b>{/* A11Y-FIXES #23 */}
              <span className="muted">held {held(r.holding_days)} · {date(r.closed_at)}</span>
              <span className="sr-only">{TRADE_LINK.suffix(symbol)}</span>
            </Link>
          </li>
        ))}
      </ul>
      {related.length > 0 && (
        <section aria-labelledby="also-h">
          <h2 id="also-h">Also closed by these traders</h2>
          <p className="muted small">Other stocks closed by people who have closed {symbol}. This is not a recommendation, and no returns are shown.</p>
          {/* QA round 2 (N9): the Demo sentence is said once, in the page note */}
          <ul className="rows ticker-rows">
            {related.map((r) => (
              <li key={r.symbol} className="related-li">
                <Link
                  href={`/t/${encodeURIComponent(r.symbol)}`}
                  className="trow"
                  aria-label={`${r.symbol}, ${r.traders} trader${r.traders === 1 ? '' : 's'} in common, ${r.trades} trade${r.trades === 1 ? '' : 's'}${r.demoOnly ? ', Demo' : ''}`}
                >
                  <span className="who"><b>{r.symbol}</b> {r.demoOnly && <Badge verified={false} />}</span>
                  <span className="muted">{r.traders} trader{r.traders === 1 ? '' : 's'} in common · {r.trades} trade{r.trades === 1 ? '' : 's'}</span>
                </Link>
                <Link
                  href={`/t/compare?a=${encodeURIComponent(symbol)}&b=${encodeURIComponent(r.symbol)}`}
                  className="compare-link"
                  aria-label={`Compare ${symbol} with ${r.symbol}`}
                >Compare</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p><Link href="/">Back to the feed</Link> · <Link href="/t">All stocks</Link></p>
    </main>
  );
}
