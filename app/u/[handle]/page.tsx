import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sql } from '@/lib/db.ts';
import { currentUser } from '@/lib/session.ts';
import { confidence, edgeText, evidenceLine, isNewRecord, pct, rangeText, stats } from '@/lib/trades.ts';
import { saveThesis } from '../../actions.ts';
import { setHandle } from '../../auth/actions.ts';
import { recordFunnel } from '@/lib/funnel.ts';
import { ACCOUNT_CLAIMED_BODY, ACCOUNT_CLAIMED_TITLE } from '@/lib/claims.ts';
import { CLOSES_PAGING, connectedLine, FOLLOW, PROFILE, SETTINGS, profileCardAlt, profileDescription, RECORD_BODY, recordBodyCopy, shareCardText } from '@/lib/copy.ts';
import { applyClocks, importedRows, publicRecordDetail, recordInstitutions } from '@/lib/connections.ts';
import { paneTrust } from '@/lib/pane.ts';
import { Badge } from '../../ui.tsx';
import { PerformanceChart } from './chart.tsx';
import { SharePrompt } from './share-prompt.tsx';
import { ShareCard } from './share-card.tsx';
import { ReferralFeedback } from './referral-feedback.tsx';
import { ctaVia, referralSummary } from '@/lib/referral.ts';
import { JoinCta } from './join-cta.tsx';
import { ImportBanner } from './import-banner.tsx';
import { isDemoUser } from '@/lib/demo.ts';
import { positionRows } from '@/lib/positions.ts';
import { newTradesSince } from '@/lib/new-trades.ts';
import { MarkTradesPromptSeen, NewTradesPrompt } from './new-trades-prompt.tsx';
import { latestRecapYm } from '@/lib/recap.ts';
import { shouldShowSharePrompt } from '@/lib/share-prompt.ts';
import { count } from '@/lib/format.ts';
import { closesWindow, packPoints } from '@/lib/paging.ts';
import { RowFocus } from './row-focus.tsx';
import { FollowButton } from '../../follow-button.tsx';
import { followingAmong, isHidden } from '@/lib/follows.ts';
import { loadSimilar } from '@/lib/similar.ts';
import { median } from '@/lib/discovery/section.ts';
import { SimilarSection } from './similar-section.tsx';

type Params = { params: Promise<{ handle: string }>; searchParams?: Promise<{ connect?: string; via?: string; handle?: string; closes?: string; done?: string; first?: string }> };

async function load(handle: string) {
  const [user] = await sql`select id, handle, display_name, excluded_positions, excluded_future, last_synced_at, snaptrade_user_id, share_prompt_seen_at, trades_prompt_seen_at from users where handle = ${handle} and deleted_at is null`;
  if (!user) return null;
  const trades = await sql`
    select id, sell_id, symbol, return_pct, holding_days, opened_at, closed_at, verified, thesis, thesis_status
    from closed_trades where user_id = ${user.id} order by closed_at desc, id desc`; // list order (lib/paging.ts)
  const [{ accounts }] = await sql`select count(distinct account_id)::int as accounts from activities where user_id = ${user.id} and source = 'snaptrade'`;
  const c = confidence(trades.map((t) => ({ symbol: t.symbol, openedAt: t.opened_at, closedAt: t.closed_at, returnPct: t.return_pct, holdingDays: t.holding_days })), new Date());
  // F-1: the expiry and staleness clocks apply on every read (marking only), then the record's state drives the body copy.
  if (user.snaptrade_user_id) await applyClocks(new Date(), { userId: user.id });
  // Fix round 2: everything public about the connection (state, simulated-account count, positions) comes from a
  // consented connection and confirmed claims only; a pending, declined or expired link shows nothing (COMPLIANCE §3).
  // Fix round 3: the state is the aggregate over every consented connection (importing while any imports) and the
  // banner count is summed over them, so a newer finished link never presents a running import as a whole record.
  const { public: { state, paper }, imported } = await publicRecordDetail(user.id);
  // PR-2b: "Connected:" names the institutions the vendor returned for consented real accounts (never "broker"), and
  // the banner's imported-rows line starts from the rows already stored.
  const brokers = await recordInstitutions(user.id);
  const read = state === 'importing' ? await importedRows(user.id) : 0;
  const positions = state !== 'none' ? await sql`select account_id, symbol, unrealized_pct from open_positions where user_id = ${user.id} order by symbol, account_id` : [];
  return { user, trades, state, imported, positions: positionRows(positions.map((p) => ({ accountId: p.account_id as string, symbol: p.symbol as string, pct: p.unrealized_pct as number }))), paper: paper as number, brokers, read, accounts: accounts as number, c, s: stats(trades.map((t) => ({ returnPct: t.return_pct, holdingDays: t.holding_days, closedAt: t.closed_at }))) };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const data = await load((await params).handle);
  if (!data) return {};
  const { user, s, c, state } = data;
  // Fix round 5 (TR-3): the same count wording as the trade and month previews ("closed" for a failed or partly
  // unverified record, "demo" for demo data, "verified" only for a whole record from the broker).
  const verified = data.trades.length > 0 && data.trades.every((t) => t.verified);
  const demo = await isDemoUser(user.id);
  // Reviewer fix (POLICY F3a, A1): the share card's alt text comes from the same record state as the card's label, so
  // it never says "Verified" for a demo, importing or failed record. Declared here because a file-level alt is static.
  const card = shareCardText({ state, demo, verified, empty: data.trades.length === 0 });
  const openGraph = { images: [{ url: `/u/${user.handle}/opengraph-image`, width: 1200, height: 630, type: 'image/png', alt: profileCardAlt(user.handle, card) }] };
  // While any import runs the unfurl text quotes no stats (TR-3: nothing partial is presented as complete); with no
  // closes there is no stats line at all (PR-2b), only the profile's own empty-record words.
  const statsText = `${pct(s.winRate, 0).slice(1)} win rate · ${pct(s.avgReturn)} avg return · Evidence: ${c.tier === 'too-early' ? 'too early' : c.tier}`;
  return {
    title: `${user.display_name} (@${user.handle}) · Stock Social`,
    description: profileDescription({ state, demo, verified, trades: s.trades, stats: statsText }),
    openGraph,
  };
}

export default async function Profile({ params, searchParams }: Params) {
  const data = await load((await params).handle);
  if (!data) notFound();
  const { user, trades, s, c, brokers, accounts, state, positions, paper, read } = data;
  const me = await currentUser();
  const isMe = me?.id === user.id;
  // F-2 PR-3b: "Similar trades" (lib/similar.ts), only for a whole record with a typical holding period; the same for every
  // viewer, minus a signed-in viewer's own record and hidden traders. Read alongside the rest of the page.
  const similarP = state !== 'importing' ? loadSimilar({ trader: user.id, hold: median(trades.map((t) => t.holding_days as number)), closes: trades.length, viewer: me?.id, panes: false }) : null;
  similarP?.catch(() => {}); // awaited below; never an unhandled rejection meanwhile
  // F-2 PR-2: whether this viewer follows the trader (their own row only); never a count, never on your own profile.
  const following = !!me && !isMe && (await followingAmong(me.id, [user.id])).has(user.id);
  // Fix round 1 (UX 11): after a no-JS follow, unfollow or "Not interested", one line saying what happened, shown only
  // when the stored state agrees (a crafted link claims nothing).
  const done = me && !isMe ? (await searchParams)?.done : undefined;
  const doneLine = done === 'follow' && following ? ((await searchParams)?.first ? FOLLOW.first(user.handle) : FOLLOW.followed(user.handle))
    : done === 'unfollow' && !following ? FOLLOW.unfollowed(user.handle)
    : done === 'hidden' && me && (await isHidden(me.id, user.id)) ? FOLLOW.hiddenFrom(user.handle) : null;
  if (isMe) {
    // Funnel (plan §5): once per completed attempt, the first time the trader sees their own profile.
    const [{ a }] = await sql`select max(id) as a from signup_attempts where user_id = ${user.id} and completed_at is not null
      and not exists (select 1 from funnel_events f where f.attempt_id = signup_attempts.id and f.name = 'own_profile_viewed')`;
    if (a) await recordFunnel(Number(a), 'own_profile_viewed');
  }
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
  const sharePromptShowing = isMe && state !== 'importing' && state !== 'failed' && shouldShowSharePrompt(user as Parameters<typeof shouldShowSharePrompt>[0]);
  const nt = isMe
    ? newTradesSince(trades.map((t) => ({ sellId: t.sell_id, symbol: t.symbol, returnPct: t.return_pct, closedAt: t.closed_at })), user.trades_prompt_seen_at)
    : { shown: [], more: 0 };
  const claimed = isMe && (await searchParams)?.connect === 'account-claimed';
  const recapYm = latestRecapYm(trades.map((t) => ({ closedAt: t.closed_at as Date })));
  const allVerified = trades.length > 0 && trades.every((t) => t.verified);
  // Fix round 4 (TR-3): the same trust rule as the feed pane: a failed record carries no Verified badge.
  const trust = paneTrust(trades.map((t) => ({ verified: t.verified as boolean })), state);
  const first = trades.length ? new Date(Math.min(...trades.map((t) => t.opened_at.getTime()))) : null;
  const isNew = isNewRecord(trades.map((t) => ({ openedAt: t.opened_at })), trades.length, new Date());
  const range = rangeText(c);
  // Fix round 3 (TR-3): while any consented import runs, the trades so far are listed but nothing is presented as a
  // complete record: no Verified badge, no headline stats or chart, no "Record since · Connected" line.
  const complete = state !== 'importing';
  // Committee fix (item 5): no share invitation on a record that is importing or failed; "Try again" is the only primary.
  const shareable = state === 'connected' || state === 'none';
  const connected = allVerified ? connectedLine(brokers, accounts) : 'Demo data';
  // F-1 PR-3 fix round 4 (UX lead demand 1, POLICY F3/A1, TR-1): the list shows one window of 50 closes (`?closes=N`);
  // every close stays one "Show 50 more" away, and the stats and the chart above cover the whole record.
  const win = closesWindow((await searchParams)?.closes, trades.length);
  const listed = trades.slice(win.start, win.start + win.shown);
  const firstNew = win.next !== null ? trades[win.end] : null;

  // A provisional profile (no display name set yet) shows the handle once, as the heading.
  const provisional = user.display_name === user.handle;
  const fresh = isMe && !claimed && !user.snaptrade_user_id && trades.length === 0;
  const similar = await similarP;

  return (
    <main className="page">
      <h1 style={{ marginBottom: 4 }}>{provisional ? `@${user.handle}` : user.display_name}</h1>
      {/* PR-2b: one line reserved, so the badge arriving when an import finishes does not push the banner down. */}
      <p className="muted" style={{ marginTop: 0, minHeight: '1.45em' }}>
        {!provisional && `@${user.handle} `}{complete && trades.length > 0 && trust.badge && <Badge verified={trust.badge === 'verified'} />} {complete && isNew && trades.length > 0 && <span className="badge new">New record</span>}
      </p>
      {me && !isMe && <div className="profile-follow"><FollowButton handle={user.handle} following={following} signedIn />{doneLine && <p role="status" className="small">{doneLine}{done === 'hidden' && <> <Link href="/me/following">{FOLLOW.settingsLink}</Link></>}</p>}</div>}
      {fresh && <p role="status">{PROFILE.youreIn}</p>}
      {/* S5: the live banner (owner polls; visitors see the server's line). Rendered in every state so its finished
          line survives the refresh that follows the end of the import. */}
      <ImportBanner state={state} closes={trades.length} read={read} owner={isMe} quiet={sharePromptShowing} />
      {state === 'failed' && (
        <p role={isMe ? 'alert' : 'status'} className="down record-failed">{RECORD_BODY.failed}{isMe && <> <Link className="button secondary" href="/connect">{RECORD_BODY.retry}</Link></>}</p>
      )}
      {complete && first && (
        <p className="muted small" style={{ marginTop: 0 }}>
          Record since {first.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {connected}. Only trades from connected accounts are shown.
        </p>
      )}

      {isMe && <ReferralFeedback handles={referred.handles} byVia={referred.byVia} />}

      {claimed && (
        <p role="alert" className="down"><b>{ACCOUNT_CLAIMED_TITLE}</b> {ACCOUNT_CLAIMED_BODY}</p>
      )}
      {isMe && !claimed && shareable && sharePromptShowing && (
        <SharePrompt handle={user.handle} displayName={user.display_name} trades={trades.length} range={range} isNew={isNew} />
      )}
      {isMe && !claimed && user.trades_prompt_seen_at === null && <MarkTradesPromptSeen />}
      {isMe && !claimed && shareable && user.trades_prompt_seen_at !== null && !sharePromptShowing && nt.shown.length > 0 && (
        <NewTradesPrompt handle={user.handle} trades={nt.shown.map((x) => ({ sellId: x.sellId, symbol: x.symbol, returnPct: x.returnPct, closedAt: x.closedAt.toISOString() }))} more={nt.more} />
      )}
      {isMe && (state === 'none' || claimed) && (
        <p><a className="button" href="/connect">Connect your broker (read-only)</a></p>
      )}
      {/* F-2 PR-2 fix round 1: Settings (sign out, delete my profile, following and hidden traders) is reachable by tapping. */}
      {isMe && <p className="settings-link"><Link className="tap" href="/settings">{SETTINGS.title}</Link></p>}
      {isMe && (
        <details className="handle-edit">
          <summary className="button secondary">{PROFILE.changeHandle}</summary>
          <form action={setHandle} className="inline">
            <label htmlFor="new-handle" className="sr-only">New handle</label>
            <input id="new-handle" name="handle" type="text" required pattern="[a-z0-9_]{3,20}" defaultValue={user.handle} aria-describedby={(await searchParams)?.handle === 'taken' ? 'handle-err' : undefined} />
            <button>Save</button>
          </form>
          {(await searchParams)?.handle === 'taken' && <p id="handle-err" role="alert" className="down small">That handle is taken or reserved, or not 3–20 lowercase letters, numbers or _.</p>}
        </details>
      )}
      {isMe && !claimed && shareable && trades.length > 0 && !sharePromptShowing && (
        <ShareCard handle={user.handle} recapYm={recapYm}
          recapLabel={recapYm ? new Date(`${recapYm}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : null} />
      )}

      {/* Headline = win rate + avg return: readable in one glance (DESIGN Stage 2, BL). */}
      {complete && trades.length > 0 && <>
      <section className="stats">
        <div className="stat big"><b>{(s.winRate * 100).toFixed(0)}%</b><small>win rate</small></div>
        <div className="stat big"><b className={s.avgReturn > 0 ? 'up' : 'down'}>{pct(s.avgReturn)}</b><small>avg return / trade</small>
          {/* PR-2b: "Too early to tell" is said once, in the evidence line below; here only an actual range. */}
          {range && <small className="range">{`${range} · 95% range`}</small>}
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
        <div className="stat"><b>{count(s.trades)}</b><small>closed trades</small></div>
        <div className="stat"><b>{s.profitFactor === null ? '—' : s.profitFactor.toFixed(2)}</b><small>profit factor</small></div>
        <div className="stat"><b>{s.medianHoldingDays.toFixed(1)}d</b><small>median hold</small></div>
        <div className="stat"><b className="down">{pct(-s.maxDrawdown)}</b><small>max drawdown (per-trade, equal-weight)</small></div>
      </section>
      <PerformanceChart points={packPoints(trades.map((t) => ({ id: String(t.id), symbol: t.symbol, returnPct: t.return_pct, closedAt: t.closed_at, holdingDays: t.holding_days, thesis: t.thesis_status === 'published' ? t.thesis : null })))} now={new Date()} current={win.end} />
      </>}
      {user.excluded_positions > 0 && (
        <p className="muted">{PROFILE.excludedPositions(user.excluded_positions)}</p>
      )}
      {user.excluded_future > 0 && (
        <p className="muted">{PROFILE.excludedFuture(user.excluded_future)}</p>
      )}
      {paper > 0 && <p className="muted">{RECORD_BODY.paperExcluded(paper)}</p>}

      {/* TR-4: open positions, symbol and unrealized percent only, before the closed trades (S5 and S8). */}
      {positions.length > 0 && <>
        <h2>{RECORD_BODY.positionsTitle}</h2>
        <ul className="rows positions">
          {positions.map((p) => (
            <li key={p.key}><div className="line"><b><Link href={`/t/${encodeURIComponent(p.symbol)}`}>{p.symbol}</Link>{p.account !== null && <span className="muted small"> account {p.account}</span>}</b><b className={p.pct > 0 ? 'up' : 'down'}>{pct(p.pct)}</b></div></li>
          ))}
        </ul>
      </>}

      {showJoin && <JoinCta handle={user.handle} via={ctaVia((await searchParams)?.via)} />}

      <h2>Closed trades</h2>
      {recordBodyCopy(state, trades.length) && <p className="muted record-body">{recordBodyCopy(state, trades.length)}</p>}
      {trades.length > CLOSES_PAGING.size && <p className="muted small closes-showing">{CLOSES_PAGING.showing(win.start, win.shown, trades.length)}</p>}
      <RowFocus window={win.end} />
      <ul className="rows closes">
        {listed.map((t) => (
          <li key={t.id} id={`trade-${t.id}`} tabIndex={-1}>
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
      {(firstNew || win.prev !== null) && (
        <p className="closes-more">
          {/* A plain link: a whole page either way (the chart's record is most of it), and the same path with or without JS. */}
          {firstNew && <a className="button secondary" href={`?closes=${win.next}#trade-${firstNew.id}`}>{CLOSES_PAGING.more(Math.min(CLOSES_PAGING.size, trades.length - win.end))}</a>}
          {win.prev !== null && <a className="button secondary" href={`/u/${user.handle}`}>{CLOSES_PAGING.newest}</a>}
        </p>
      )}
      {similar && <SimilarSection handle={user.handle} similar={similar} signedIn={!!me} />}
      <p><Link href="/" className="tap44">← Feed</Link></p>
    </main>
  );
}
