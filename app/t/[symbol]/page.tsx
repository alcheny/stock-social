import type { Metadata } from 'next';
import Link from 'next/link';
import { sql } from '@/lib/db.ts';
import { recordStates, type PublicState } from '@/lib/connections.ts';
import { rowBadge } from '@/lib/pane.ts';
import { baselineVerdict, decodeSymbolParam, isIndexableTicker, selectTheses, tickerDescription, trustKind } from '@/lib/ticker.ts';
import { othersConfidence, relatedSymbolsSql, tickerHeadline, tickerPage, type TickerPage } from '@/lib/ticker-sql.ts';
// FIXES-LABELS (D-03): the page names one state, Demo, and never calls Demo trades verified.
import { FIXES_LABELS as FL } from '@/lib/copy.ts';
import { pct, rangeText, type Confidence } from '@/lib/trades.ts';
import { MIN_BETS } from '@/lib/confidence.ts';
import { Badge, RowBadge } from '../../ui.tsx';
import Spread from './Spread.tsx';
import Timeline from './Timeline.tsx';
import HoldTime from './HoldTime.tsx';
import Concentration from './Concentration.tsx';
import Theses from './Theses.tsx';
import Baseline from './Baseline.tsx';

import Watch, { loadWatch, markSeen } from './Watch.tsx';
// F-6: open positions in this stock, aggregate only.
import OpenPositions from './OpenPositions.tsx';
import { symbolOpen } from '../open-positions.ts';

type Params = { params: Promise<{ symbol: string }>; searchParams?: Promise<{ watch?: string | string[] }> };

const CAP = 500;
const EXPLAINER = 'Verified closed trades in this stock from connected accounts, newest first. Percentages only. Few trades means a wide range, and that is expected.';
const date = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const held = (d: number) => (d < 1 ? '<1d' : `${Math.round(d)}d`);
const heldWords = (d: number) => (d < 1 ? 'less than a day' : `${Math.round(d)} day${Math.round(d) === 1 ? '' : 's'}`);

// The summary and charts are SQL aggregates over every trade (lib/ticker-sql.ts); only the CAP newest rows are read.
async function load(raw: string): Promise<{ symbol: string | null; d: TickerPage | null; rows: TickerPage['rows'] }> {
  const symbol = decodeSymbolParam(raw);
  if (!symbol) return { symbol: null, d: null, rows: [] };
  const d = await tickerPage(symbol, new Date(), CAP);
  return { symbol, d, rows: d.rows };
}


export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const symbol = decodeSymbolParam((await params).symbol);
  if (!symbol) return { title: 'Ticker not found · Stock Social', robots: { index: false } };
  const head = await tickerHeadline(symbol);
  const s = head.summary;
  const title = FL.tickerTitle[trustKind(s)](symbol);
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
    select t.id, t.user_id, u.handle, t.return_pct, t.holding_days, t.closed_at, t.verified, t.thesis, t.thesis_status
    from closed_trades t join users u on u.id = t.user_id and u.deleted_at is null
    where t.symbol = ${symbol} and t.thesis_status = 'published' and t.thesis is not null
    order by t.closed_at desc, t.id desc
    limit 20`) as unknown as { id: number; user_id: number; handle: string; return_pct: number; holding_days: number; closed_at: Date; verified: boolean; thesis: string | null; thesis_status: string | null }[];
  // Fix round 5 (TR-3): one batched read of the record state of every trader named on the page (listed rows and
  // theses); a failed record shows no Verified badge.
  const named = [...rows, ...thesisRows];
  const states = await recordStates([...new Set(named.map((r) => r.user_id))]);
  const stateByHandle = new Map<string, PublicState>(named.map((r) => [r.handle, states.get(r.user_id)?.state ?? 'connected']));
  const badgeFor = (verified: boolean, handle: string) => rowBadge(verified, stateByHandle.get(handle));
  const theses = selectTheses(thesisRows.map((r) => ({ id: r.id, handle: r.handle, thesis: r.thesis, thesisStatus: r.thesis_status, returnPct: r.return_pct, holdingDays: r.holding_days, closedAt: r.closed_at, verified: r.verified })));
  // Cohort follows the ticker: verified rows if it has any, otherwise the sample rows. One aggregate, this symbol excluded.
  let baseline: ReturnType<typeof baselineVerdict> | null = null;
  let others: { n: number; winRate: number | null; conf: Confidence | null } = { n: 0, winRate: null, conf: null };
  try {
    const [agg] = (await sql`
      select count(*)::int as n,
             avg((return_pct > 0)::int)::float8 as win_rate,
             exp(avg(ln(greatest(1 + return_pct, 1e-9)))) - 1 as per_trade
      from closed_trades
      where symbol <> ${symbol} and verified = ${!s.demoOnly}`) as unknown as { n: number; win_rate: number | null; per_trade: number | null }[];
    const num = (v: unknown) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v));
    baseline = baselineVerdict(s, { n: agg?.n ?? 0, winRate: num(agg?.win_rate), perTrade: num(agg?.per_trade), demoOnly: s.demoOnly });
    // FIXES-LABELS (D-07): the other stocks' count and 95% range from the same confidence() path as this stock's.
    others = await othersConfidence(symbol, !s.demoOnly);
  } catch { baseline = null; }
  const open = (await symbolOpen(symbol)).get(symbol);
  // Last, after all page queries, so page content is unaffected.
  await markSeen(symbol, watchState);
  return (
    <main className="page">
      <p><Link href="/t">← All stocks</Link></p>
      <h1 style={{ marginBottom: 4 }}>{symbol} {!s.mixed && <Badge verified={!s.demoOnly} />}</h1>
      <Watch symbol={symbol} state={watchState} capHit={capHit} />
      <p className="muted" style={{ marginTop: 0 }}>{FL.tickerExplainer[trustKind(s)]}</p>
      <form action="/t/compare" method="get" className="compare-form">
        <input type="hidden" name="a" value={symbol} />
        <label htmlFor="compare-b">Compare with…</label>
        <input id="compare-b" name="b" maxLength={10} autoCapitalize="characters" autoComplete="off" spellCheck={false} />
        <button type="submit">Compare</button>
      </form>
      {s.demoOnly && <p role="note" className="muted">{FL.demoPage}</p>}
      {s.mixed && <p role="note" className="muted">{FL.mixedNote}</p>}

      <section className="stats" aria-label="Summary">
        <div className="stat big"><b>{(s.winRate! * 100).toFixed(0)}%</b><small>win rate</small></div>
        <div className="stat big"><b className={s.avgReturn! > 0 ? 'up' : 'down'}>{pct(s.avgReturn!)}</b><small>avg return / trade</small>
          <small className="range">{range ? `${range} · 95% range` : `Too early to tell (${c.k} of ${MIN_BETS} bets)`}</small>
          <small className="median">median {pct(spread.median! / 100)}</small>
        </div>
      </section>
      <p className="muted small">{s.n} trades · {s.traders} trader{s.traders === 1 ? '' : 's'}</p>
      {/* docs/POLICY.md F3b: a page about a security never rates or scores the security, so no verdict line here */}
      <div className="evidence">
        <p className="muted small" style={{ margin: 0 }}>Different traders, different sizes and timing. This is what happened, not a prediction or a rating of the stock.</p>
      </div>
      {/* F-6 (UX lead D5): after the closed-trade figures' caveat, so each caveat sits with its own figures. */}
      {open && <OpenPositions symbol={symbol} open={open} />}

      <Concentration c={d.concentration} symbol={symbol} demoOnly={s.demoOnly} mixed={s.mixed} />

      {baseline && <Baseline result={baseline} summary={s} symbol={symbol} others={others} />}

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
            <Link
              href={`/u/${r.handle}`}
              className="trow"
              aria-label={`@${r.handle}, ${symbol}, ${pct(r.return_pct)}, held ${heldWords(r.holding_days)}, closed ${date(r.closed_at)}`}
            >
              <span className="who">@{r.handle} <RowBadge kind={badgeFor(r.verified, r.handle)} /></span>
              <b className={r.return_pct > 0 ? 'up' : 'down'}>{pct(r.return_pct)}</b>
              <span className="muted">held {held(r.holding_days)} · {date(r.closed_at)}</span>
            </Link>
          </li>
        ))}
      </ul>
      {related.length > 0 && (
        <section aria-labelledby="also-h">
          <h2 id="also-h">Also closed by these traders</h2>
          <p className="muted small">Other stocks closed by people who have closed {symbol}. This is not a recommendation, and no returns are shown.</p>
          {s.demoOnly && <p className="muted small">{FL.demoNote}</p>}
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
