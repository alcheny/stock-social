import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sql } from '@/lib/db.ts';
import { currentUser } from '@/lib/session.ts';
import { confidence, edgeText, evidenceLine, isNewRecord, pct, rangeText, stats } from '@/lib/trades.ts';
import { saveThesis } from '../../actions.ts';
import { ACCOUNT_CLAIMED_BODY, ACCOUNT_CLAIMED_TITLE } from '@/lib/claims.ts';
import { Badge } from '../../ui.tsx';
import { PerformanceChart } from './chart.tsx';

type Params = { params: Promise<{ handle: string }>; searchParams?: Promise<{ connect?: string }> };

async function load(handle: string) {
  const [user] = await sql`select id, handle, display_name, excluded_positions, last_synced_at, snaptrade_user_id from users where handle = ${handle}`;
  if (!user) return null;
  const trades = await sql`
    select id, symbol, return_pct, holding_days, opened_at, closed_at, verified, thesis, thesis_status
    from closed_trades where user_id = ${user.id} order by closed_at desc`;
  const brokers = await sql`select distinct raw->>'institution' as inst from activities where user_id = ${user.id} and source = 'snaptrade'`;
  const [{ accounts }] = await sql`select count(distinct account_id)::int as accounts from activities where user_id = ${user.id} and source = 'snaptrade'`;
  const c = confidence(trades.map((t) => ({ symbol: t.symbol, openedAt: t.opened_at, closedAt: t.closed_at, returnPct: t.return_pct, holdingDays: t.holding_days })), new Date());
  return { user, trades, brokers: brokers.map((b) => b.inst as string | null).filter(Boolean) as string[], accounts: accounts as number, c, s: stats(trades.map((t) => ({ returnPct: t.return_pct, holdingDays: t.holding_days, closedAt: t.closed_at }))) };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const data = await load((await params).handle);
  if (!data) return {};
  const { user, s, c } = data;
  return {
    title: `${user.display_name} (@${user.handle}) · Stock Social`,
    description: `${s.trades} verified trades · ${pct(s.winRate, 0).slice(1)} win rate · ${pct(s.avgReturn)} avg return · Evidence: ${c.tier === 'too-early' ? 'too early' : c.tier}`,
  };
}

export default async function Profile({ params, searchParams }: Params) {
  const data = await load((await params).handle);
  if (!data) notFound();
  const { user, trades, s, c, brokers, accounts } = data;
  const me = await currentUser();
  const isMe = me?.id === user.id;
  const claimed = isMe && (await searchParams)?.connect === 'account-claimed';
  const allVerified = trades.length > 0 && trades.every((t) => t.verified);
  const first = trades.length ? new Date(Math.min(...trades.map((t) => t.opened_at.getTime()))) : null;
  const isNew = isNewRecord(trades.map((t) => ({ openedAt: t.opened_at })), trades.length, new Date());
  const range = rangeText(c);
  const connected = allVerified
    ? `Connected: ${brokers.length ? brokers.join(', ') : 'broker'} (${accounts} account${accounts === 1 ? '' : 's'})`
    : 'Demo data';

  return (
    <main className="page">
      <h1 style={{ marginBottom: 4 }}>{user.display_name}</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        @{user.handle} {trades.length > 0 && <Badge verified={allVerified} />} {isNew && trades.length > 0 && <span className="badge new">New record</span>}
      </p>
      {first && (
        <p className="muted small" style={{ marginTop: 0 }}>
          Record since {first.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {connected}. Only trades from connected accounts are shown.
        </p>
      )}

      {claimed && (
        <p role="alert" className="down"><b>{ACCOUNT_CLAIMED_TITLE}</b> {ACCOUNT_CLAIMED_BODY}</p>
      )}
      {isMe && (!user.snaptrade_user_id || claimed) && (
        <p><a className="button" href="/connect">Connect your broker (read-only)</a></p>
      )}
      {isMe && <p><Link href="/me/record">My record</Link> <span className="muted small">(private)</span></p>}
      {isMe && trades.length > 0 && (
        <p className="muted">Share your card: <code>/u/{user.handle}</code></p>
      )}

      {/* Headline = win rate + avg return: readable in one glance (DESIGN Stage 2, BL). */}
      {trades.length > 0 && <>
      <section className="stats">
        <div className="stat big"><b>{(s.winRate * 100).toFixed(0)}%</b><small>win rate</small></div>
        <div className="stat big"><b className={s.avgReturn > 0 ? 'up' : 'down'}>{pct(s.avgReturn)}</b><small>avg return / trade</small>
          <small className="range">{range ? `${range} · 95% range` : `Too early to tell (${c.k} of 10 bets)`}</small>
        </div>
      </section>
      <div className="evidence">
        <p style={{ margin: 0 }}>
          {c.edge
            ? <>Past results: <b className={c.edge === 'positive' ? 'up' : c.edge === 'negative' ? 'down' : ''}>{edgeText(c.edge)}</b>{evidenceLine(c).slice(`Past results: ${edgeText(c.edge)}`.length)}</>
            : evidenceLine(c)}
        </p>
        <details>
          <summary>What&apos;s this?</summary>
          95% range from independent bets (same-stock trades that overlap count as one). A wider range means less evidence.
        </details>
      </div>
      <section className="stats">
        <div className="stat"><b>{s.trades}</b><small>closed trades</small></div>
        <div className="stat"><b>{s.profitFactor === null ? '—' : s.profitFactor.toFixed(2)}</b><small>profit factor</small></div>
        <div className="stat"><b>{s.medianHoldingDays.toFixed(1)}d</b><small>median hold</small></div>
        <div className="stat"><b className="down">{pct(-s.maxDrawdown)}</b><small>max drawdown (per-trade, equal-weight)</small></div>
      </section>
      <PerformanceChart trades={trades.map((t) => ({ id: String(t.id), symbol: t.symbol, returnPct: t.return_pct, closedAt: t.closed_at, holdingDays: t.holding_days, thesis: t.thesis_status === 'published' ? t.thesis : null }))} now={new Date()} />
      {user.excluded_positions > 0 && (
        <p className="muted">{user.excluded_positions} earlier position(s) excluded: no matching entry in the imported history.</p>
      )}
      </>}

      <h2>Closed trades</h2>
      {!trades.length && <p className="muted">{user.snaptrade_user_id ? 'Syncing… closed trades appear here.' : 'No trades yet.'}</p>}
      <ul className="rows">
        {trades.map((t) => (
          <li key={t.id} id={`trade-${t.id}`}>
            <div className="line">
              <span><b>{t.symbol}</b> <span className="muted">{t.closed_at.toLocaleDateString('en-US')}</span></span>
              <b className={t.return_pct > 0 ? 'up' : 'down'}>{pct(t.return_pct)}</b>
            </div>
            {t.thesis_status === 'published' && <p style={{ margin: '4px 0 0' }}>“{t.thesis}”</p>}
            {isMe && t.thesis_status === 'held' && <p className="muted" style={{ margin: '4px 0 0' }}>Thesis held for review.</p>}
            {isMe && (
              <form action={saveThesis} className="inline">
                <input type="hidden" name="tradeId" value={t.id} />
                <input type="text" name="thesis" maxLength={280} defaultValue={t.thesis ?? ''} placeholder="Why did you take this trade?" aria-label={`Thesis for ${t.symbol}`} />
                <button>Save</button>
              </form>
            )}
          </li>
        ))}
      </ul>
      <p><Link href="/">← Feed</Link></p>
    </main>
  );
}
