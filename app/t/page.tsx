import type { Metadata } from 'next';
import Link from 'next/link';
import { sql } from '@/lib/db.ts';
import { visibleUserIds } from '@/lib/visible-users.ts';
import { redirect } from 'next/navigation';
import { parseTickerSort, watchSummary, type TickerSort, type WatchItem } from '@/lib/ticker.ts';
import { tickerIndexPage } from './ticker-sql.ts';
import { currentUser } from '@/lib/session.ts';
import { Badge } from '../ui.tsx';
// FIXES-LABELS (D-03): the index names Demo and never calls Demo trades verified.
import { FIXES_LABELS as FL } from '@/lib/copy.ts';

type Props = { searchParams: Promise<{ sort?: string | string[]; q?: string | string[] }> };

const CAP = 100;
const date = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

export const metadata: Metadata = {
  title: FL.indexTitle,
  description: FL.indexDescription,
};

// One query for all of the user's watches (max 25). Counts only: no returns. demoOnly uses ALL of a symbol's trades.
async function loadStrip(): Promise<WatchItem[]> {
  const user = await currentUser();
  if (!user) return [];
  const watches = (await sql`select symbol, last_seen_at from ticker_watches where user_id = ${user.id}`) as unknown as { symbol: string; last_seen_at: Date }[];
  if (!watches.length) return [];
  const trades = (await sql`
    select symbol, closed_at, verified from closed_trades
    where filing_url is null and symbol in (select symbol from ticker_watches where user_id = ${user.id}) and user_id in (${visibleUserIds()})`) as unknown as { symbol: string; closed_at: Date; verified: boolean }[];
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
                  : `${w.newCount} new ${w.demoOnly ? '' : 'verified '}closed trade${w.newCount === 1 ? '' : 's'}${w.demoOnly ? ' (Demo)' : ''} since you last looked`}
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
  // Search, sort and the cap run in SQL (app/t/ticker-sql.ts): the query is a normalized symbol as a bound, escaped LIKE
  // prefix, and the sort is one of two fixed order-by fragments, so no user text is interpolated.
  const f = await tickerIndexPage(rawQ, sort, CAP);
  if (!f.total) {
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
  if (f.kind === 'exact') redirect(`/t/${encodeURIComponent(f.symbol!)}`);
  const rows = f.rows;
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
      <p><Link href="/"><span aria-hidden="true">←</span> Feed</Link></p>
      <h1>Stocks</h1>
      <Strip strip={strip} />
      <p className="muted">{FL.indexIntro}</p>
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
            ? `${plural(f.matched, 'stock')} start${f.matched === 1 ? 's' : ''} with “${f.symbol}”, ${order}`
            : `${f.total > CAP ? `Showing ${rows.length} of ${f.total} stocks` : plural(f.total, 'stock')}, ${order}`}
          {searching && <> · <Link href={clearHref}>Clear search</Link></>}
        </p>
      )}
      <ul className="rows ticker-rows" aria-label={FL.indexAria}>
        {rows.map((r) => {
          const when = date(r.lastClosedAt);
          return (
            <li key={r.symbol}>
              <Link
                href={`/t/${encodeURIComponent(r.symbol)}`}
                className="trow"
                aria-label={`${r.symbol}, ${plural(r.trades, 'trade')}, ${plural(r.traders, 'trader')}, last closed ${when}${r.demoOnly ? ', Demo' : ''}`}
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
