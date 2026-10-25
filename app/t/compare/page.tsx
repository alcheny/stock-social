import type { Metadata } from 'next';
import Link from 'next/link';
import { sql } from '@/lib/db.ts';
import { COMPARE_COPY, compareDescription, compareTickers, parseCompare, toTicker, type CompareSide, type TickerRow, type TradeRow } from '@/lib/ticker.ts';
import { evidenceLine, pct, rangeText } from '@/lib/trades.ts';
import { Badge } from '../../ui.tsx';
import Spread from '../[symbol]/Spread.tsx';

type Props = { searchParams: Promise<{ a?: string | string[]; b?: string | string[] }> };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function load(searchParams: Props['searchParams']) {
  const sp = await searchParams;
  const parsed = parseCompare(first(sp.a), first(sp.b));
  if (parsed.kind !== 'ok') return { parsed };
  const rows = (await sql`
    select t.user_id, t.symbol, t.return_pct, t.holding_days, t.opened_at, t.closed_at, t.verified
    from closed_trades t where t.symbol in (${parsed.a}, ${parsed.b})`) as unknown as (TradeRow & { symbol: string })[];
  const side = (s: string): TickerRow[] => rows.filter((r) => r.symbol === s).map(toTicker);
  return { parsed, compare: compareTickers(side(parsed.a), side(parsed.b), new Date()) };
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { parsed, compare } = await load(searchParams);
  if (parsed.kind !== 'ok' || !compare) return { title: COMPARE_COPY.title, robots: { index: false } };
  return {
    title: `${parsed.a} vs ${parsed.b} verified trades · Stock Social`,
    description: compareDescription(parsed.a, parsed.b, compare),
    robots: { index: false },
  };
}

function Form() {
  return (
    <form action="/t/compare" method="get" className="compare-form">
      <label htmlFor="cmp-a">First stock</label>
      <input id="cmp-a" name="a" maxLength={10} autoCapitalize="characters" autoComplete="off" spellCheck={false} />
      <label htmlFor="cmp-b">Second stock</label>
      <input id="cmp-b" name="b" maxLength={10} autoCapitalize="characters" autoComplete="off" spellCheck={false} />
      <button type="submit">Compare</button>
    </form>
  );
}

function Message({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <main className="page">
      <p><Link href="/t">← All stocks</Link></p>
      <h1>Compare stocks</h1>
      <p>{text}</p>
      {children}
      <p><Link href="/t">All stocks</Link> · <Link href="/">Back to the feed</Link></p>
    </main>
  );
}

function Column({ symbol, side, id, shared }: { symbol: string; side: CompareSide; id: string; shared: { dots: boolean; maxCount: number } }) {
  const s = side.summary;
  const head = (
    <h2 id={id}><Link href={`/t/${encodeURIComponent(symbol)}`}>{symbol}</Link> {!s.mixed && !side.empty && <Badge verified={!s.demoOnly} />}</h2>
  );
  if (side.empty) return <section aria-labelledby={id}>{head}<p>{COMPARE_COPY.emptySide(symbol)}</p></section>;
  const c = s.conf!;
  const range = rangeText(c);
  return (
    <section aria-labelledby={id}>
      {head}
      {s.demoOnly && <p role="note" className="muted">{COMPARE_COPY.demoOnly}</p>}
      {s.mixed && <p role="note" className="muted">{COMPARE_COPY.mixed}</p>}
      <div className="stats">
        <div className="stat big"><b>{(s.winRate! * 100).toFixed(0)}%</b><small>win rate</small></div>
        <div className="stat big"><b className={s.avgReturn! > 0 ? 'up' : s.avgReturn! < 0 ? 'down' : ''}>{pct(s.avgReturn!)}</b><small>avg return / trade</small>
          {range && <small className="range">{range} · 95% range</small>}
        </div>
      </div>
      <p className="muted small">{s.n} trades · {s.traders} trader{s.traders === 1 ? '' : 's'}</p>
      <div className="evidence">
        <p style={{ margin: 0 }}>{evidenceLine(c)}</p>
      </div>
      <Spread spread={side.spread} returns={side.returns} symbol={symbol} demoOnly={s.demoOnly} mixed={s.mixed} shared={shared} bare />
    </section>
  );
}

export default async function Compare({ searchParams }: Props) {
  const { parsed, compare } = await load(searchParams);
  if (parsed.kind === 'missing') return <Message text={COMPARE_COPY.pick}><Form /></Message>;
  if (parsed.kind === 'invalid') return <Message text={COMPARE_COPY.invalid(parsed.raw)}><Form /></Message>;
  if (parsed.kind === 'same') return <Message text={COMPARE_COPY.same(parsed.a)}><p><Link href={`/t/${encodeURIComponent(parsed.a)}`}>Back to {parsed.a}</Link></p></Message>;
  if (parsed.kind !== 'ok' || !compare) return <Message text={COMPARE_COPY.pick} />;
  const { a, b } = parsed;
  if (compare.a.empty && compare.b.empty) {
    return (
      <Message text={COMPARE_COPY.bothEmpty(a, b)}>
        <p><Link href={`/t/${encodeURIComponent(a)}`}>{a}</Link> · <Link href={`/t/${encodeURIComponent(b)}`}>{b}</Link></p>
      </Message>
    );
  }
  const sides = [compare.a, compare.b].filter((x) => !x.empty);
  const shared = {
    dots: sides.every((x) => x.spread.n < 10),
    maxCount: Math.max(1, ...sides.flatMap((x) => x.spread.bins.map((bin) => bin.count))),
  };
  return (
    <main className="page">
      <p><Link href="/t">← All stocks</Link></p>
      <h1 style={{ marginBottom: 4 }}>{a} vs {b}</h1>
      <p className="muted" style={{ marginTop: 0 }}>{COMPARE_COPY.explainer}</p>
      <div className="compare-grid">
        <Column symbol={a} side={compare.a} id="cmp-a-h" shared={shared} />
        <Column symbol={b} side={compare.b} id="cmp-b-h" shared={shared} />
      </div>
      {!compare.a.empty && !compare.b.empty && <p>{COMPARE_COPY.overlap(compare.sameTraders, a, b)}</p>}
      <p className="muted small">{COMPARE_COPY.footer}</p>
      <p><Link href={`/t/${encodeURIComponent(a)}`}>Back to {a}</Link> · <Link href={`/t/${encodeURIComponent(b)}`}>Back to {b}</Link> · <Link href="/t">All stocks</Link></p>
    </main>
  );
}
