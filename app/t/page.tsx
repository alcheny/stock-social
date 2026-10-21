import type { Metadata } from 'next';
import Link from 'next/link';
import { sql } from '@/lib/db.ts';
import { redirect } from 'next/navigation';
import { filterTickerIndex, parseTickerSort, tickerIndex, watchSummary, type SymbolAggregate, type TickerSort, type WatchItem } from '@/lib/ticker.ts';
import { currentUser } from '@/lib/session.ts';
import { Badge } from '../ui.tsx';

type Props = { searchParams: Promise<{ sort?: string | string[]; q?: string | string[] }> };

const CAP = 100;
const date = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

export const metadata: Metadata = {
  title: 'Stocks with verified trades · Stock Social',
  description: 'Browse every stock with verified closed trades: trade counts and traders, percentages only, losses included.',
};

// One query for all of the user's watches (max 25). Counts only: no returns. demoOnly uses ALL of a symbol's trades.
async function loadStrip(): Promise<WatchItem[]> {
  const user = await currentUser();
  if (!user) return [];
  const watches = (await sql`select symbol, last_seen_at from ticker_watches where user_id = ${user.id}`) as unknown as { symbol: string; last_seen_at: Date }[];
  if (!watches.length) return [];
  const trades = (await sql`
    select symbol, closed_at, verified from closed_trades
    where symbol in (select symbol from ticker_watches where user_id = ${user.id})`) as unknown as { symbol: string; closed_at: Date; verified: boolean }[];
  return watchSummary(
    watches.map((w) => ({ symbol: w.symbol, lastSeenAt: w.last_seen_at })),
    trades.map((t) => ({ symbol: t.symbol, closedAt: t.closed_at, verified: t.verified })),
  );
}

function Strip({ strip }: { strip: WatchItem[] }) {
  if (!strip.length) return null;
  return (
    <section aria-labelledby="watched-h">
      <h2 id="watched-h">Your watched stocks</h2>
      <ul className="rows ticker-rows">
        {strip.map((w) => (
          <li key={w.symbol}>
            <Link href={`/t/${encodeURIComponent(w.symbol)}`} prefetch={false} className="trow" style={{ minHeight: 44 }}>
              <span className="who"><b>{w.symbol}</b> {w.demoOnly && <Badge verified={false} />}</span>
              <span className="muted">
                {w.newCount === 0 ? 'No new trades'
                  : `${w.newCount} new ${w.demoOnly ? '' : 'verified '}closed trade${w.newCount === 1 ? '' : 's'}${w.demoOnly ? ' (demo data)' : ''} since you last looked`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function Stocks({ searchParams }: Props) {
  const sp = await searchParams;
  const strip = await loadStrip();
  const sort = parseTickerSort(sp.sort);
  const rawQ = (Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? '';
  // No user input reaches SQL; sorting happens in tickerIndex.
  // ponytail: when symbols exceed a few thousand, push sort + limit into SQL with a whitelisted order by.
  const aggs = (await sql`
    select symbol, count(*)::int as trades, count(distinct user_id)::int as traders,
           max(closed_at) as last_closed_at, count(*) filter (where verified)::int as verified_trades
    from closed_trades group by symbol`) as unknown as { symbol: string; trades: number; traders: number; last_closed_at: Date; verified_trades: number }[];
  const all = tickerIndex(
    aggs.map((a): SymbolAggregate => ({ symbol: a.symbol, trades: a.trades, traders: a.traders, lastClosedAt: a.last_closed_at, verifiedTrades: a.verified_trades })),
    sort,
  );
  if (!all.length) {
    return (
      <main className="page">
        <h1>Stocks</h1>
        <Strip strip={strip} />
        <p>No verified trades yet.</p>
        <p className="muted">Stocks appear here when a trader connects a broker and closes a position.</p>
        <p><Link href="/">Back to the feed</Link></p>
      </main>
    );
  }
  const f = filterTickerIndex(all, rawQ);
  if (f.kind === 'exact') redirect(`/t/${encodeURIComponent(f.symbol!)}`);
  const rows = f.rows.slice(0, CAP);
  const order = sort === 'az' ? 'sorted A–Z' : 'most recently traded first';
  const q = rawQ.trim();
  const href = (s: TickerSort) => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (s === 'az') p.set('sort', 'az');
    const qs = p.toString();
    return qs ? `/t?${qs}` : '/t';
  };
  const clearHref = sort === 'az' ? '/t?sort=az' : '/t';
  const searching = f.kind === 'prefix' || f.kind === 'none' || f.kind === 'invalid';
  const link = (on: boolean) => ({ 'aria-current': on ? ('true' as const) : undefined, style: { fontWeight: on ? 800 : 400, display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 8px' } });
  return (
    <main className="page">
      <p><Link href="/">← Feed</Link></p>
      <h1>Stocks</h1>
      <Strip strip={strip} />
      <p className="muted">Stocks with at least one verified closed trade from connected accounts. Open a stock to see its trades, losses included. Percentages only.</p>
      <form role="search" action="/t" method="get" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <label htmlFor="q">Find a stock</label>
        <input id="q" name="q" type="search" defaultValue={rawQ} placeholder="NVDA" maxLength={10} autoCapitalize="characters" autoCorrect="off" spellCheck={false} style={{ minHeight: 44 }} />
        {sort === 'az' && <input type="hidden" name="sort" value="az" />}
        <button type="submit" style={{ minHeight: 44 }}>Find</button>
      </form>
      <nav aria-label="Sort stocks">
        <Link href={href('recent')} {...link(sort === 'recent')}>Recent</Link>
        <Link href={href('az')} {...link(sort === 'az')}>A–Z</Link>
      </nav>
      {(f.kind === 'none' || f.kind === 'invalid') ? (
        <>
          <p>No stock with verified trades matches “{q.slice(0, 20)}”.</p>
          <p className="muted">Stocks appear here once a trader closes a position in them.</p>
          <p><Link href={clearHref} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44 }}>See all stocks</Link></p>
        </>
      ) : (
        <p className="muted small">
          {f.kind === 'prefix'
            ? `${plural(f.rows.length, 'stock')} start${f.rows.length === 1 ? 's' : ''} with “${f.symbol}”, ${order}`
            : `${all.length > CAP ? `Showing ${rows.length} of ${all.length} stocks` : plural(all.length, 'stock')}, ${order}`}
          {searching && <> · <Link href={clearHref}>Clear search</Link></>}
        </p>
      )}
      <ul className="rows ticker-rows" aria-label="Stocks with verified trades">
        {rows.map((r) => {
          const when = date(r.lastClosedAt);
          return (
            <li key={r.symbol}>
              <Link
                href={`/t/${encodeURIComponent(r.symbol)}`}
                className="trow"
                aria-label={`${r.symbol}, ${plural(r.trades, 'trade')}, ${plural(r.traders, 'trader')}, last closed ${when}${r.demoOnly ? ', sample data' : ''}`}
              >
                <span className="who"><b>{r.symbol}</b> {r.demoOnly && <Badge verified={false} />}</span>
                <span className="muted">{plural(r.trades, 'trade')} · {plural(r.traders, 'trader')} · last closed {when}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
