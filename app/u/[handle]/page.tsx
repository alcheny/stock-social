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
import { SharePrompt } from './share-prompt.tsx';
import { ShareCard } from './share-card.tsx';
import { ReferralFeedback } from './referral-feedback.tsx';
import { ctaVia, referralSummary } from '@/lib/referral.ts';
import { JoinCta } from './join-cta.tsx';
import { isDemoUser } from '@/lib/demo.ts';
import { newTradesSince } from '@/lib/new-trades.ts';
import { MarkTradesPromptSeen, NewTradesPrompt } from './new-trades-prompt.tsx';
import { latestRecapYm } from '@/lib/recap.ts';
import { shouldShowSharePrompt } from '@/lib/share-prompt.ts';

type Params = { params: Promise<{ handle: string }>; searchParams?: Promise<{ connect?: string; via?: string }> };

async function load(handle: string) {
  const [user] = await sql`select id, handle, display_name, excluded_positions, last_synced_at, snaptrade_user_id, share_prompt_seen_at, trades_prompt_seen_at from users where handle = ${handle}`;
  if (!user) return null;
  const trades = await sql`
    select id, sell_id, symbol, return_pct, holding_days, opened_at, closed_at, verified, thesis, thesis_status
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
  const showJoin = !me && !(await isDemoUser(user.id));
  const referred = isMe
    ? referralSummary({
        ownerId: user.id,
        ownerIsDemo: await isDemoUser(user.id),
        rows: (await sql`
          select u.id, u.handle,
            exists(select 1 from activities d where d.user_id = u.id and d.source = 'demo') as is_demo,
            exists(select 1 from activities a where a.user_id = u.id and a.source = 'snaptrade') as has_snaptrade_activity,
            coalesce(u.referred_surface, u.referred_via) as surface
          from users u where u.referred_by_user_id = ${user.id} order by u.id`).map((r) => ({
          id: r.id as number,
          handle: r.handle as string,
          isDemo: r.is_demo as boolean,
          hasSnaptradeActivity: r.has_snaptrade_activity as boolean,
          referredSurface: (r.surface as string | null) ?? null,
        })),
      })
    : { connected: 0, handles: [] as string[], byVia: {} as Record<string, number> };
  const sharePromptShowing = isMe && shouldShowSharePrompt(user as Parameters<typeof shouldShowSharePrompt>[0]);
  const nt = isMe
    ? newTradesSince(trades.map((t) => ({ sellId: t.sell_id, symbol: t.symbol, returnPct: t.return_pct, closedAt: t.closed_at })), user.trades_prompt_seen_at)
    : { shown: [], more: 0 };
  const claimed = isMe && (await searchParams)?.connect === 'account-claimed';
  const recapYm = latestRecapYm(trades.map((t) => ({ closedAt: t.closed_at as Date })));
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

      {isMe && <ReferralFeedback handles={referred.handles} byVia={referred.byVia} />}

      {claimed && (
        <p role="alert" className="down"><b>{ACCOUNT_CLAIMED_TITLE}</b> {ACCOUNT_CLAIMED_BODY}</p>
      )}
      {isMe && !claimed && shouldShowSharePrompt(user as Parameters<typeof shouldShowSharePrompt>[0]) && (
        <SharePrompt handle={user.handle} displayName={user.display_name} trades={trades.length} range={range} isNew={isNew} />
      )}
      {isMe && !claimed && user.trades_prompt_seen_at === null && <MarkTradesPromptSeen />}
      {isMe && !claimed && user.trades_prompt_seen_at !== null && !sharePromptShowing && nt.shown.length > 0 && (
        <NewTradesPrompt handle={user.handle} trades={nt.shown.map((x) => ({ sellId: x.sellId, symbol: x.symbol, returnPct: x.returnPct, closedAt: x.closedAt.toISOString() }))} more={nt.more} />
      )}
      {isMe && (!user.snaptrade_user_id || claimed) && (
        <p><a className="button" href="/connect">Connect your broker (read-only)</a></p>
      )}
      {isMe && !claimed && trades.length > 0 && !sharePromptShowing && (
        <ShareCard handle={user.handle} recapYm={recapYm}
          recapLabel={recapYm ? new Date(`${recapYm}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : null} />
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

      {showJoin && <JoinCta handle={user.handle} via={ctaVia((await searchParams)?.via)} />}

      <h2>Closed trades</h2>
      {!trades.length && <p className="muted">{user.snaptrade_user_id ? 'Syncing… closed trades appear here.' : 'No trades yet.'}</p>}
      <ul className="rows">
        {trades.map((t) => (
          <li key={t.id} id={`trade-${t.id}`}>
            <div className="line">
              <span><b><Link href={`/t/${encodeURIComponent(t.symbol)}`}>{t.symbol}</Link></b> <span className="muted">{t.closed_at.toLocaleDateString('en-US')}</span></span>
              <Link className="trade-link" href={`/u/${user.handle}/trade/${encodeURIComponent(t.sell_id)}`} aria-label={`${t.symbol} ${pct(t.return_pct)}, open trade page`}>
                <b className={t.return_pct > 0 ? 'up' : 'down'}>{pct(t.return_pct)}</b>
              </Link>
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
