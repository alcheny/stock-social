import type { Metadata } from 'next';
import Link from 'next/link';
import { sql } from '@/lib/db.ts';
import { recordStates, type PublicState } from '@/lib/connections.ts';
import { rowBadge } from '@/lib/pane.ts';
import { baselineVerdict, decodeSymbolParam, holdBuckets, isIndexableTicker, monthlyTimeline, outcomeSpread, relatedSymbols, selectTheses, tickerSummary, toSpreadPct, toTicker } from '@/lib/ticker.ts';
import { pct, rangeText, tooEarlyText } from '@/lib/trades.ts';
import { Badge, RowBadge } from '../../ui.tsx';
import Spread from './Spread.tsx';
import Timeline from './Timeline.tsx';
import HoldTime from './HoldTime.tsx';
import Concentration from './Concentration.tsx';
import Theses from './Theses.tsx';
import Baseline from './Baseline.tsx';

import Watch, { loadWatch, markSeen } from './Watch.tsx';

type Params = { params: Promise<{ symbol: string }>; searchParams?: Promise<{ watch?: string | string[] }> };

const CAP = 500;
const EXPLAINER = 'Verified closed trades in this stock from connected accounts, newest first. Percentages only. Few trades means a wide range, and that is expected.';
const date = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const held = (d: number) => (d < 1 ? '<1d' : `${Math.round(d)}d`);
const heldWords = (d: number) => (d < 1 ? 'less than a day' : `${Math.round(d)} day${Math.round(d) === 1 ? '' : 's'}`);

async function load(raw: string) {
  const symbol = decodeSymbolParam(raw);
  if (!symbol) return { symbol: null, rows: [] as Row[] };
  // ponytail: fetch every row for the symbol so the summary covers all of them; only the display list is capped.
  const rows = (await sql`
    select t.id, t.user_id, u.handle, u.display_name, t.symbol, t.return_pct, t.holding_days,
           t.opened_at, t.closed_at, t.verified
    from closed_trades t join users u on u.id = t.user_id and u.deleted_at is null
    where t.symbol = ${symbol}
    order by t.closed_at desc, t.id desc`) as unknown as Row[];
  return { symbol, rows };
}

type Row = { id: number; user_id: number; handle: string; display_name: string; symbol: string; return_pct: number; holding_days: number; opened_at: Date; closed_at: Date; verified: boolean };


export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { symbol, rows } = await load((await params).symbol);
  if (!symbol) return { title: 'Ticker not found · Stock Social', robots: { index: false } };
  const title = `${symbol} verified trades · Stock Social`;
  if (!rows.length) return { title, description: `No verified closed trades in ${symbol} yet.`, robots: { index: false } };
  const s = tickerSummary(rows.map(toTicker), new Date());
  const tier = s.conf!.tier === 'too-early' ? 'too early' : s.conf!.tier;
  const verifiedRows = rows.filter((r) => r.verified);
  const thin = !isIndexableTicker({ verifiedTrades: verifiedRows.length, verifiedTraders: new Set(verifiedRows.map((r) => r.user_id)).size });
  return {
    title,
    ...(thin ? { robots: { index: false } } : {}),
    description: `${s.n} verified closed trades in ${symbol} · ${(s.winRate! * 100).toFixed(0)}% win rate · ${pct(s.avgReturn!)} avg return · Evidence: ${tier}${s.demoOnly ? ' Sample data.' : ''}`,
  };
}

export default async function Ticker({ params, searchParams }: Params) {
  const { symbol, rows } = await load((await params).symbol);
  const w = (await searchParams)?.watch;
  const capHit = (Array.isArray(w) ? w[0] : w) === 'cap';
  // Session is read only here, never in generateMetadata, sitemap, robots or the OG image.
  const watchState = symbol ? await loadWatch(symbol) : { signedIn: false, watching: false };
  if (!symbol || !rows.length) {
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
        <p><Link href="/">Back to the feed</Link> · <Link href="/t">All stocks</Link></p>
      </main>
    );
  }
  const s = tickerSummary(rows.map(toTicker), new Date());
  const c = s.conf!;
  const range = rangeText(c);
  const shown = rows.slice(0, CAP);
  // Fix round 5 (TR-3): one batched read of every listed trader's record state; a failed record shows no Verified badge.
  const states = await recordStates([...new Set(rows.map((r) => r.user_id))]);
  const stateByHandle = new Map<string, PublicState>(rows.map((r) => [r.handle, states.get(r.user_id)?.state ?? 'connected']));
  const badgeFor = (verified: boolean, handle: string) => rowBadge(verified, stateByHandle.get(handle));
  // ponytail: move the grouping into SQL if one symbol's traders hold thousands of trades.
  const overlap = (await sql`
    select o.symbol, o.user_id, o.verified
    from closed_trades o
    where o.symbol <> ${symbol}
      and o.user_id in (select distinct user_id from closed_trades where symbol = ${symbol})`) as unknown as { symbol: string; user_id: number; verified: boolean }[];
  const related = relatedSymbols(overlap.map((o) => ({ symbol: o.symbol, userId: o.user_id, verified: o.verified })), symbol);
  // All rows, not the display cap. Non-finite values are dropped so bin counts always sum to n.
  const returns = rows.map((r) => toSpreadPct(r.return_pct)).filter(Number.isFinite);
  const spread = outcomeSpread(returns);
  // Held text is never selected: status is filtered in SQL, and selectTheses re-checks it.
  const thesisRows = (await sql`
    select t.id, u.handle, t.return_pct, t.holding_days, t.closed_at, t.verified, t.thesis, t.thesis_status
    from closed_trades t join users u on u.id = t.user_id and u.deleted_at is null
    where t.symbol = ${symbol} and t.thesis_status = 'published' and t.thesis is not null
    order by t.closed_at desc, t.id desc
    limit 20`) as unknown as { id: number; handle: string; return_pct: number; holding_days: number; closed_at: Date; verified: boolean; thesis: string | null; thesis_status: string | null }[];
  const theses = selectTheses(thesisRows.map((r) => ({ id: r.id, handle: r.handle, thesis: r.thesis, thesisStatus: r.thesis_status, returnPct: r.return_pct, holdingDays: r.holding_days, closedAt: r.closed_at, verified: r.verified })));
  // Cohort follows the ticker: verified rows if it has any, otherwise the sample rows. One aggregate, this symbol excluded.
  let baseline: ReturnType<typeof baselineVerdict> | null = null;
  try {
    const [agg] = (await sql`
      select count(*)::int as n,
             avg((return_pct > 0)::int)::float8 as win_rate,
             exp(avg(ln(greatest(1 + return_pct, 1e-9)))) - 1 as per_trade
      from closed_trades
      where symbol <> ${symbol} and verified = ${!s.demoOnly}`) as unknown as { n: number; win_rate: number | null; per_trade: number | null }[];
    const num = (v: unknown) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v));
    baseline = baselineVerdict(s, { n: agg?.n ?? 0, winRate: num(agg?.win_rate), perTrade: num(agg?.per_trade), demoOnly: s.demoOnly });
  } catch { baseline = null; }
  // Last, after all page queries, so page content is unaffected.
  await markSeen(symbol, watchState);
  return (
    <main className="page">
      <p><Link href="/t">← All stocks</Link></p>
      <h1 style={{ marginBottom: 4 }}>{symbol} {!s.mixed && <Badge verified={!s.demoOnly} />}</h1>
      <Watch symbol={symbol} state={watchState} capHit={capHit} />
      <p className="muted" style={{ marginTop: 0 }}>{EXPLAINER}</p>
      <form action="/t/compare" method="get" className="compare-form">
        <input type="hidden" name="a" value={symbol} />
        <label htmlFor="compare-b">Compare with…</label>
        <input id="compare-b" name="b" maxLength={10} autoCapitalize="characters" autoComplete="off" spellCheck={false} />
        <button type="submit">Compare</button>
      </form>
      {s.demoOnly && <p role="note" className="muted">All trades on this page are sample data, not from a real broker.</p>}
      {s.mixed && <p role="note" className="muted">Some trades here are sample data and are marked Demo. The summary includes them.</p>}

      <section className="stats" aria-label="Summary">
        <div className="stat big"><b>{(s.winRate! * 100).toFixed(0)}%</b><small>win rate</small></div>
        <div className="stat big"><b className={s.avgReturn! > 0 ? 'up' : 'down'}>{pct(s.avgReturn!)}</b><small>avg return / trade</small>
          {range && <small className="range">{range} · 95% range</small>}
          {c.tier === 'too-early' && <small className="range">{tooEarlyText(c)}</small>}
          <small className="median">median {pct(spread.median! / 100)}</small>
        </div>
      </section>
      <p className="muted small">{s.n} trades · {s.traders} trader{s.traders === 1 ? '' : 's'}</p>
      {/* docs/POLICY.md F3b: a page about a security never rates or scores the security, so no verdict line here */}
      <div className="evidence">
        <p className="muted small" style={{ margin: 0 }}>Different traders, different sizes and timing. This is what happened, not a prediction or a rating of the stock.</p>
      </div>

      <Concentration rows={rows.map(toTicker)} symbol={symbol} demoOnly={s.demoOnly} mixed={s.mixed} />

      {baseline && <Baseline result={baseline} summary={s} symbol={symbol} />}

      {spread.n > 0 && (
        <>
          <Spread spread={spread} returns={returns} symbol={symbol} demoOnly={s.demoOnly} mixed={s.mixed} />
        </>
      )}

      <Timeline timeline={monthlyTimeline(rows.map(toTicker), new Date())} symbol={symbol} demoOnly={s.demoOnly} mixed={s.mixed} />
      <HoldTime holds={holdBuckets(rows.map(toTicker), new Date())} symbol={symbol} demoOnly={s.demoOnly} mixed={s.mixed} />

      <Theses list={theses} symbol={symbol} badgeFor={badgeFor} />

      <h2>Trades (newest first)</h2>
      {rows.length > CAP && <p className="muted small">Showing the {CAP} most recent of {rows.length}. The summary covers all {rows.length}.</p>}
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
          {s.demoOnly && <p className="muted small">Based on sample data.</p>}
          <ul className="rows ticker-rows">
            {related.map((r) => (
              <li key={r.symbol} className="related-li">
                <Link
                  href={`/t/${encodeURIComponent(r.symbol)}`}
                  className="trow"
                  aria-label={`${r.symbol}, ${r.traders} trader${r.traders === 1 ? '' : 's'} in common, ${r.trades} trade${r.trades === 1 ? '' : 's'}${r.demoOnly ? ', sample data' : ''}`}
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
