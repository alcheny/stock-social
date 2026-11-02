import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sql } from '@/lib/db.ts';
import { currentUser } from '@/lib/session.ts';
import { confidence, edgeText, evidenceLine, isNewRecord, pct, stats } from '@/lib/trades.ts';
import { DISCLAIMER } from '@/lib/share.ts';
import { saveThesis } from '../../actions.ts';
import { setHandle } from '../../auth/actions.ts';
import { WarnNotice } from '../../warn-notice.tsx'; // F-27
import { recordFunnel } from '@/lib/funnel.ts';
import { ACCOUNT_CLAIMED_BODY, ACCOUNT_CLAIMED_TITLE } from '@/lib/claims.ts';
import { CLOSES_PAGING, connectedLine, DEMO_PROFILE, FOLLOW, PROFILE, SETTINGS, profileDescription, RECORD_BODY, recordBodyCopy } from '@/lib/copy.ts';
import { cardAlt, cardDescription, cardEvidence, evidenceRangeText } from '@/lib/record-card.ts';
import { loadRecordCard } from './record-card-data.ts';
import { importedRows, recordInstitutions } from '@/lib/connections.ts';
import { paneTrust } from '@/lib/pane.ts';
import { Badge, PublicNotice } from '../../ui.tsx';
import { UserNote } from '../../user-note.tsx';
import { HeldNote } from '@/lib/user-note.ts';
import { HANDLE_RULE, profileHandleError } from '@/lib/handles.ts';
// F-7 public-record traders.
import { isPublicRecord, PUBLIC, publicExclusions } from '@/lib/copy.ts';
import { filerInfo, filerVisible, PUBLIC_STALE_DAYS } from '@/lib/public-gate.ts';
import { PerformanceChart } from './chart.tsx';
import { SharePrompt } from './share-prompt.tsx';
import { ShareCard } from './share-card.tsx';
import { ReferralFeedback } from './referral-feedback.tsx';
import { ctaVia, referralSummary } from '@/lib/referral.ts';
import { JoinCta } from './join-cta.tsx';
import { ImportBanner } from './import-banner.tsx';
import { cache } from 'react';
import { isDemoUser, reads } from './load.ts'; // per-request reads, shared with the record card
import { positionRows } from '@/lib/positions.ts';
import { newTradesSince } from '@/lib/new-trades.ts';
import { MarkTradesPromptSeen, NewTradesPrompt } from './new-trades-prompt.tsx';
import { latestRecapYm } from '@/lib/recap.ts';
import { shouldShowSharePrompt } from '@/lib/share-prompt.ts';
import { count } from '@/lib/format.ts';
import { routeHandle } from '@/lib/params.ts';
import { closesWindow } from '@/lib/paging.ts';
import { profileChart } from '@/lib/chart-series.ts'; // F-23
import { wireToday } from '@/lib/public-wire.ts'; // F-23
import { RowFocus } from './row-focus.tsx';
import { FollowButton } from '../../follow-button.tsx';
import { followingAmong, isHidden } from '@/lib/follows.ts';
import { loadSimilar } from '@/lib/similar.ts';
import { median } from '@/lib/discovery/section.ts';
import { SimilarSection } from './similar-section.tsx';
// F-6: open positions in every number.
import { combined, openSummary } from '@/lib/open-split.ts';
import { asOfDay, OPEN } from '@/lib/copy.ts';
import { ChartNote, CombinedLine, OpenGrid, RealizedLabel, longValues, toneClass } from '../../open-rows.tsx';
// FIXES-LABELS (D-09 / D20, POLICY F3): the F3 line in plain view after the first performance block.
import { Disclaimer } from '../../disclaimer.tsx';
// FIXES-LABELS: status (F-11 / D-12 / fix #4): the record status line.
import { statusForOrNull as statusFor } from '@/lib/record-status-load.ts'; // QA round 2 (N3): guarded, null on error
import { statusRowsOrEmpty, withStates } from '@/lib/record-status-load.ts'; // PR #85 review (nit 5): read beside the load
import { segments, statusParts } from '@/lib/record-status.ts';
import { STATUS_LINE } from '@/lib/copy.ts';
import { StatusList, StatusText } from '../../status-line.tsx';
import { dateText } from '@/lib/date-text.ts'; // QA round 2 (N12): the rows' dates follow the year rule
// OPTIONS (docs/features/logs/options/plan.md D5, D6): the one reader and its pure renders.
import { loadOptionRecord, shareLabel, hasOptions, oldestRead } from '@/lib/options-load.ts';
import { OpenPositionsBlock, OptionsLines, OptionTradesSection, ShareTradesLabel, UnsupportedLine } from './options-block.tsx';
import { OPTIONS } from '@/lib/copy.ts';
// F-21: the #excluded section (lib/exclusions.ts sums; summed filing reasons move into it, the rest stay below it).
import { ExcludedSection } from './excluded-section.tsx';
import { fromRow } from '@/lib/exclusions-load.ts';
import { PUBLIC_KINDS } from '@/lib/exclusions.ts';
import type { PublicReason } from '@/lib/public-trades.ts';

// The handle-change rejection names its rule (fix committee 2026-11-01, decision 7; C9). Fix round 2 (D): the copy lives
// in lib/handles.ts#profileHandleError (taken and look-alike end "Try another.").

type Params = { params: Promise<{ handle: string }>; searchParams?: Promise<{ connect?: string; via?: string; handle?: string; closes?: string; done?: string; first?: string; options?: string }> };

// One read per request: generateMetadata and the page share it (React cache), and its rows are the record card's (load.ts).
const load = cache(async (handle: string) => {
  if (!routeHandle(handle)) return null; // security hardening (2026-11-01), F12: junk in the URL is a 404, not a 500
  const user = await reads.user(handle);
  if (!user) return null;
  // F-7: a filer's record shows only while the switch is on and it is neither hidden nor removed (legal C13, C19).
  const filer = user.public_filer_id ? await reads.filer(user.id) : null;
  if (!filerVisible(filer)) return null;
  const trades = await reads.trades(user.id); // list order (lib/paging.ts)
  if (filer && !trades.length) return null; // F-7 (plan Round 4 item 2): no page without a priced closed trade
  const [{ accounts }] = await sql`select count(distinct account_id)::int as accounts from activities where user_id = ${user.id} and source = 'snaptrade'`;
  const c = confidence(trades.map((t) => ({ symbol: t.symbol, openedAt: t.opened_at, closedAt: t.closed_at, returnPct: t.return_pct, holdingDays: t.holding_days })), new Date());
  // F-1: the expiry and staleness clocks apply on every read (marking only), then the record's state drives the body copy.
  if (user.snaptrade_user_id) await reads.clocks(user.id);
  // Fix round 2: everything public about the connection (state, simulated-account count, positions) comes from a
  // consented connection and confirmed claims only; a pending, declined or expired link shows nothing (COMPLIANCE §3).
  // Fix round 3: the state is the aggregate over every consented connection (importing while any imports) and the
  // banner count is summed over them, so a newer finished link never presents a running import as a whole record.
  const { public: { state, paper }, imported } = await reads.detail(user.id);
  // PR-2b: "Connected:" names the institutions the vendor returned for consented real accounts (never "broker"), and
  // the banner's imported-rows line starts from the rows already stored.
  const brokers = await recordInstitutions(user.id);
  const read = state === 'importing' ? await importedRows(user.id) : 0;
  const positions = state !== 'none' ? await reads.positions(user.id) : [];
  // F-6: open positions summarized beside the realized record for a connected or failed record (TR-3: nothing while
  // importing); null without positions, so such a record renders exactly as before. "As of": the oldest read.
  // OPTIONS: the option record (counts only while the consent gate is closed); long open options join the open block's
  // aggregate only once the gate is open (D6, TR-4).
  const opt = await loadOptionRecord(user.id);
  const optOpen = opt.gate === 'open' && state !== 'importing' ? opt.open : [];
  const open = state === 'connected' || state === 'failed' ? openSummary([...positions.map((p) => p.unrealized_pct as number), ...optOpen.map((o) => o.pct)]) : null;
  // OPTIONS fix round 1 (review 3): the oldest read across share and option positions; unset when there are none.
  const openAsOf = open ? oldestRead(positions.map((p) => p.fetched_at as Date), optOpen.length && opt.gate === 'open' ? opt.openAsOf : null) : null;
  return { opt, optOpen, user, filer, trades, state, imported, open, openAsOf, positions: positionRows(positions.map((p) => ({ accountId: p.account_id as string, symbol: p.symbol as string, pct: p.unrealized_pct as number }))), paper: paper as number, brokers, read, accounts: accounts as number, c, s: stats(trades.map((t) => ({ returnPct: t.return_pct, holdingDays: t.holding_days, closedAt: t.closed_at }))) };
});

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const data = await load((await params).handle);
  // Cycle 2 review of fix #20: a missing profile's 404 takes the 404 page's title, not the site default.
  if (!data) notFound();
  const { user, s, c, state } = data;
  // Fix round 5 (TR-3): the same count wording as the trade and month previews ("closed" for a failed or partly
  // unverified record, "demo" for demo data, "verified" only for a whole record from the broker).
  const verified = data.trades.length > 0 && data.trades.every((t) => t.verified);
  const demo = await isDemoUser(user.id);
  // F-4 committee round 1, demand 9 (POLICY A1): the share card's alt text is the card in words, built from the same
  // model the image draws (its label, so never "Verified" for a demo, importing or failed record). Declared here
  // because a file-level alt is static.
  const card = await loadRecordCard(user.handle, 'unfurl');
  const openGraph = { images: [{ url: `/u/${user.handle}/opengraph-image`, width: 1200, height: 630, type: 'image/png', alt: card ? cardAlt(card) : '' }] };
  // While any import runs the unfurl text quotes no stats (TR-3: nothing partial is presented as complete); with no
  // closes there is no stats line at all (PR-2b), only the profile's own empty-record words.
  // F-4 (2026-11-01): the stats part is the card's own words (average per trade with its range, period, evidence; no
  // win rate), from the same model as the image; F-6: open positions in words when the trader has any.
  const cardText = card ? cardDescription(card, data.open ? OPEN.line(data.open, pct) : null) : null;
  const statsText = cardText ?? `${pct(s.avgReturn)} average per trade · Evidence: ${c.tier === 'too-early' ? 'too early' : c.tier}`;
  const base = profileDescription({ state, demo, verified, trades: s.trades, stats: statsText });
  return {
    title: `${user.display_name} (@${user.handle}) · Stock Social`,
    // F-15 second half: one untagged address, so a shared ?via= copy is never indexed as its own page.
    alternates: { canonical: `/u/${user.handle}` },
    // POLICY F3: a preview text that quotes a figure also carries the disclaimer (text-only previews show no image).
    // F-6: the open positions follow the closed-trade figures in F-6's wording (cardDescription's openLine); a record
    // with no closes keeps its empty-record line (PR-2b), and its profile shows the open positions.
    description: cardText ? `${base}. ${DISCLAIMER}` : base,
    openGraph,
    ...(data.filer ? { robots: { index: false, follow: false } } : {}), // F-7 (legal C22): public records are noindex
  };
}

export default async function Profile({ params, searchParams }: Params) {
  // FIXES-LABELS: status (PR #85 review, nit 5): the status row is read beside the profile load, not after it (the
  // user read is the same per-request one); the record state is attached once the load has it.
  const handleParam = (await params).handle;
  const statusRowP = routeHandle(handleParam)
    ? reads.user(handleParam).then((u) => (u ? statusRowsOrEmpty([u.id]) : new Map()))
    : Promise.resolve(new Map());
  const [data, statusRow] = await Promise.all([load(handleParam), statusRowP]);
  if (!data) notFound();
  const { user, filer, trades, s, c, brokers, accounts, state, positions, paper, read, open, openAsOf, opt, optOpen } = data;
  // F-7: a public record shows its top block, exclusions, open symbols and filing links; never Follow, theses, a share
  // prompt, a join CTA, Similar trades or New record (legal C10, C15-C17).
  const pub = isPublicRecord(state);
  const day = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const stale = !!filer && (!filer.lastChecked || Date.now() - filer.lastChecked.getTime() > PUBLIC_STALE_DAYS * 86_400_000);
  const long = open ? longValues(pct(s.avgReturn), pct(open.avg), String(open.n)) : undefined;
  // OPTIONS fix round 1 (review 3): the combined line counts the same open positions as the grid (option percents too).
  const both = open && combined(trades.map((t) => t.return_pct as number), [...positions.map((p) => p.pct), ...optOpen.map((o) => o.pct)]);
  const me = await currentUser();
  const isMe = me?.id === user.id;
  // F-2 PR-3b: "Similar trades" (lib/similar.ts), only for a whole record with a typical holding period; the same for every
  // viewer, minus a signed-in viewer's own record and hidden traders. Read alongside the rest of the page.
  const similarP = state !== 'importing' && !pub ? loadSimilar({ trader: user.id, hold: median(trades.map((t) => t.holding_days as number)), closes: trades.length, viewer: me?.id, panes: false }) : null;
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
  const showJoin = !me && !pub && !(await isDemoUser(user.id));
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
  const isNew = !pub && isNewRecord(trades.map((t) => ({ openedAt: t.opened_at })), trades.length, new Date());
  // F-4 rework (committee user test 2026-11-01): the profile shows the same evidence as the card it was shared from (the
  // 95% range around the average it prints, the tier, the "Past results" verdict; lib/record-card.ts#cardEvidence), so
  // a viewer arriving from a link sees one answer, not two. Ranking keeps confidence()'s own interval (`c`).
  const shown = cardEvidence(trades.map((t) => ({ symbol: t.symbol as string, openedAt: t.opened_at as Date, closedAt: t.closed_at as Date,
    returnPct: Number(t.return_pct), holdingDays: Number(t.holding_days) })), new Date());
  const range = evidenceRangeText(shown);
  // Fix round 3 (TR-3): while any consented import runs, the trades so far are listed but nothing is presented as a
  // complete record: no Verified badge, no headline stats or chart, no "Record since · Connected" line.
  const complete = state !== 'importing';
  // Committee fix (item 5): no share invitation on a record that is importing or failed; "Try again" is the only primary.
  const shareable = state === 'connected' || state === 'none';
  // F-4 rework: the share prompt quotes the card's own range (around the average it prints) and alt, from its model.
  const promptCard = isMe && !claimed && shareable && sharePromptShowing ? await loadRecordCard(user.handle, 'unfurl') : null;
  // A11Y-FIXES #10 (POLICY P2, F3a): a demo profile says so and never mentions connected accounts (mixed records count as demo).
  const connected = allVerified ? `${connectedLine(brokers, accounts)}. ${DEMO_PROFILE.connectedOnly}` : DEMO_PROFILE.line;
  // FIXES-LABELS: status. Live mode: this page is rendered per request; "updated" is the last successful sync.
  const statusF = await statusFor(user.id, state, async (id, st) => withStates(statusRow, new Map([[id, { state: st }]])).get(id) ?? null);
  const now = new Date(); // QA round 2 (N12): one request time for the rows' dates
  const status = statusF ? statusParts(statusF, now, 'live', DEMO_PROFILE.line /* #10: the demo line names Demo, not a broker */) : null;
  // F-1 PR-3 fix round 4 (UX lead demand 1, POLICY F3/A1, TR-1): the list shows one window of 50 closes (`?closes=N`);
  // every close stays one "Show 50 more" away, and the stats and the chart above cover the whole record.
  const win = closesWindow((await searchParams)?.closes, trades.length);
  const handleError = isMe ? profileHandleError((await searchParams)?.handle) : undefined;
  const listed = trades.slice(win.start, win.start + win.shown);
  const firstNew = win.next !== null ? trades[win.end] : null;

  // A provisional profile (no display name set yet) shows the handle once, as the heading.
  const provisional = user.display_name === user.handle;
  const fresh = isMe && !claimed && !user.snaptrade_user_id && trades.length === 0;
  const similar = await similarP;

  // FIXES-LABELS (PR #85 review, nit 1): on the owner's own profile the share prompt, the new-trades prompt and the share
  // card follow the headline figures and their F3 line (they were above them, which pushed the F3 line off the first
  // screen at 360 and 320 px); a record without headline figures keeps them where they were.
  const shareAfterFigures = complete && trades.length > 0;
  const ownerPrompts = (<>
      {isMe && !claimed && shareable && sharePromptShowing && (
        <SharePrompt handle={user.handle} displayName={user.display_name} trades={trades.length} range={promptCard?.range ?? null} isNew={isNew}
          previewAlt={`Preview of your share card. ${promptCard ? cardAlt(promptCard) : ''}`} />
      )}
      {isMe && !claimed && shareable && user.trades_prompt_seen_at !== null && !sharePromptShowing && nt.shown.length > 0 && (
        <NewTradesPrompt handle={user.handle} trades={nt.shown.map((x) => ({ sellId: x.sellId, symbol: x.symbol, returnPct: x.returnPct, closedAt: x.closedAt.toISOString() }))} more={nt.more} />
      )}
  </>);
  const ownerShareCard = (<>
      {isMe && !claimed && shareable && trades.length > 0 && !sharePromptShowing && (
        <ShareCard handle={user.handle} recapYm={recapYm}
          recapLabel={recapYm ? new Date(`${recapYm}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : null} />
      )}
  </>);

  return (
    <main className="page profile-page">{/* QA round 2 (B2): .profile-page tightens the h1 on a phone (globals.css) */}
      {/* fix-user-text fix round 5 (item 5): the name is isolated (<bdi>), like WhoName. */}
      <h1 style={{ marginBottom: 4 }}>{provisional ? `@${user.handle}` : <bdi>{user.display_name}</bdi>}</h1>
      {/* PR-2b: one line reserved, so the badge arriving when an import finishes does not push the banner down. */}
      <p className="muted" style={{ marginTop: 0, minHeight: '1.45em' }}>
        {!provisional && `@${user.handle} `}{complete && trades.length > 0 && trust.badge && <Badge kind={trust.badge} />}{pub && <span className="muted"> {PUBLIC.kind}</span>} {complete && isNew && trades.length > 0 && <span className="badge new">New record</span>}
      </p>
      {pub && filer && <div className="public-top" data-public-top>
        <PublicNotice link={false} />
        <p className="muted small">{PUBLIC.since(trades.length ? day(new Date(Math.min(...trades.map((t) => t.opened_at.getTime())))) : PUBLIC.notYet, filer.lastChecked ? day(filer.lastChecked) : PUBLIC.notYet)} · <Link className="tap44" href="/public-records">{PUBLIC.correction}</Link></p>
        <p className="muted small">{PUBLIC.caveat}{stale && ` ${PUBLIC.stale}`}</p>
      </div>}
      {me && !isMe && !pub && <div className="profile-follow"><FollowButton handle={user.handle} following={following} signedIn />{doneLine && <p role="status" className="small">{doneLine}{done === 'hidden' && <> <Link href="/me/following">{FOLLOW.settingsLink}</Link></>}</p>}</div>}
      {fresh && <p role="status">{PROFILE.youreIn}</p>}
      {/* S5: the live banner (owner polls; visitors see the server's line). Rendered in every state so its finished
          line survives the refresh that follows the end of the import. */}
      {!pub && <ImportBanner state={state} closes={trades.length} read={read} owner={isMe} quiet={sharePromptShowing} />}
      {state === 'failed' && (
        <WarnNotice role={isMe ? 'alert' : 'status'}>{RECORD_BODY.failed}{isMe && <> <Link className="button secondary" href="/connect">{RECORD_BODY.retry}</Link></>}</WarnNotice>
      )}
      {/* FIXES-LABELS: status. Two rows (design system StatusLine): row 1 (since · connected, partial or frozen), row 2
          (last close · updated, or the idle fact), then the accounts when there are two or more. A record the
          status line does not cover (importing, failed, no connection) keeps today's line; an F-7 public record has
          neither (its own lines are above). */}
      {status?.show && !pub ? (
        <div className="record-status-block">
          <StatusText segments={segments(status.line1)} kind="line1" />
          <StatusText segments={segments(status.line2)} kind="line2" />
          <StatusList items={status.accounts.map((p) => segments([p]))} label={STATUS_LINE.accountsLabel} />
        </div>
      ) : complete && first && !pub && (
        <p className="muted small" style={{ marginTop: 0 }}>
          Record since {first.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {connected}
        </p>
      )}

      {isMe && <ReferralFeedback handles={referred.handles} byVia={referred.byVia} />}

      {claimed && (
        <p role="alert" className="down"><b>{ACCOUNT_CLAIMED_TITLE}</b> {ACCOUNT_CLAIMED_BODY}</p>
      )}
      {!shareAfterFigures && ownerPrompts /* FIXES-LABELS (PR #85 review, nit 1) */}
      {isMe && !claimed && user.trades_prompt_seen_at === null && <MarkTradesPromptSeen />}
      {isMe && (state === 'none' || claimed) && (
        <p><a className="button" href="/connect">Connect your broker (read-only)</a></p>
      )}
      {/* F-2 PR-2 fix round 1: Settings (sign out, delete my profile, following and hidden traders) is reachable by tapping. */}
      {isMe && <p className="settings-link"><Link className="tap" href="/settings">{SETTINGS.title}</Link></p>}
      {isMe && (
        // Fix round 2 (D): with a rejection the panel renders open and the field takes focus, so the error is seen; the
        // rule is a visible hint and the field's title, so a pattern failure explains itself.
        <details className="handle-edit" open={!!handleError}>
          <summary className="button secondary">{PROFILE.changeHandle}</summary>
          <form action={setHandle} className="inline">
            <label htmlFor="new-handle" className="sr-only">New handle</label>
            <input id="new-handle" name="handle" type="text" required pattern="[a-z0-9_]{3,20}" title={HANDLE_RULE} defaultValue={user.handle} autoFocus={!!handleError} aria-describedby={handleError ? 'handle-hint handle-err' : 'handle-hint'} />
            <button>Save</button>
          </form>
          <p id="handle-hint" className="muted small">{HANDLE_RULE}</p>
          {handleError && <p id="handle-err" role="alert" className="down small">{handleError}</p>}
        </details>
      )}
      {!shareAfterFigures && ownerShareCard /* FIXES-LABELS (PR #85 review, nit 1) */}

      {/* Headline = win rate + avg return: readable in one glance (DESIGN Stage 2, BL). */}
      {/* OPTIONS (D5, D6): "Share trades" over the share-only headline; the count line (gated) or the options lines. */}
      {complete && (trades.length > 0 || hasOptions(opt.counts)) && <ShareTradesLabel counts={opt.counts} />}
      {complete && trades.length === 0 && shareLabel(opt.counts) && <p className="stat-empty">{OPTIONS.noShareCloses}</p>}
      {complete && trades.length === 0 && <OptionsLines m={opt} />}
      {complete && trades.length === 0 && opt.gate === 'open' && hasOptions(opt.counts) && <p className="muted small">{OPTIONS.chartNone}</p>}
      {complete && trades.length > 0 && <>
      <section className="stats" aria-label={open ? OPEN.realizedLabel : undefined} data-long={long}>
        {open && <RealizedLabel />}
        <div className="stat big"><b>{(s.winRate * 100).toFixed(0)}%</b><small>win rate</small></div>
        {/* F-6: with open positions, tone by the printed sign beside the unrealized row ("0.0%" uncolored in both). */}
        <div className="stat big"><b className={toneClass(s.avgReturn) /* QA round 1 (finding 8): tone of the printed value */}>{pct(s.avgReturn)}</b><small>avg return / trade</small>
          {/* PR-2b: "Too early to tell" is said once, in the evidence line below; here only an actual range. */}
          {range && <small className="range">{`${range} · 95% range`}</small>}
        </div>
      </section>
      {/* F-6: the unrealized grid directly under the realized one, same size (TR-4), then the combined average. */}
      {open && <OpenGrid o={open} asOf={openAsOf ?? undefined} long={long} />}
      {both && <CombinedLine c={both} />}
      {/* FIXES-LABELS (D-09): the F3 line right after the headline figures. QA round 2 (B2): before the evidence line, so
          it is on the first screen at 320 px with an F-7 top block or a 40-character name above the figures. */}
      <Disclaimer />
      {shareAfterFigures && <>{ownerPrompts}{ownerShareCard}</> /* FIXES-LABELS (PR #85 review, nit 1): after the F3 line */}
      <div className="evidence">
        <p style={{ margin: 0 }}>
          {/* F-4 rework: the card's evidence (shown); F-6: "Closed trades: " scopes it when there are open positions. */}
          {shown.edge
            ? <>{open ? <span data-open>{OPEN.evidencePrefix}</span> : 'Past results: '}<b className={shown.edge === 'positive' ? 'up' : shown.edge === 'negative' ? 'down' : ''}>{edgeText(shown.edge)}</b>{evidenceLine(shown).slice(`Past results: ${edgeText(shown.edge)}`.length)}</>
            : <>{open && <span data-open>{OPEN.evidencePrefix}</span>}{evidenceLine(shown)}</>}
        </p>
        <details>
          <summary>What&apos;s this?</summary>
          95% range from independent bets (same-stock trades that overlap count as one). A wider range means less evidence.
        </details>
      </div>
      {/* OPTIONS fix round 3 (item 3): the options block after the evidence line, before the secondary stats. */}
      <OptionsLines m={opt} long={long} />
      <section className="stats">
        <div className="stat"><b>{count(s.trades)}</b><small>closed trades</small></div>
        <div className="stat"><b>{s.profitFactor === null ? '—' : s.profitFactor.toFixed(2)}</b><small>profit factor</small></div>
        <div className="stat"><b>{s.medianHoldingDays.toFixed(1)}d</b><small>median hold</small></div>
        <div className="stat"><b className="down">{pct(-s.maxDrawdown)}</b><small>max drawdown (per-trade, equal-weight)</small></div>
      </section>
      {/* F-23: a server-packed chart at full resolution (every figure from stored values, the printed precision on the
          wire) and `now` as its UTC day: the browser compounds nothing. */}
      <PerformanceChart shareOnly={shareLabel(opt.counts)} chart={profileChart(trades.map((t) => ({ id: String(t.id), symbol: t.symbol, returnPct: t.return_pct, closedAt: t.closed_at, holdingDays: t.holding_days, thesis: t.thesis_status === 'published' ? t.thesis : null, ...(t.thesis_status === 'published' ? { writtenAt: t.thesis_written_at, editedAt: t.thesis_edited_at } : {}) /* FIXES-CYCLE4-PART2 (F4-16) */ })), new Date())} now={wireToday()} current={win.end} noteBy={user.handle} />
      {open && <ChartNote o={open} />}
      </>}
      {/* F-6: open positions and no closes: the unrealized grid alone (the closed-trades section below says there are none). */}
      {complete && trades.length === 0 && open && <OpenGrid o={open} asOf={openAsOf ?? undefined} long={longValues(pct(open.avg), String(open.n))} />}
      {/* F-21: the one sum and its reason lines (positions, future sells, corporate, F-24 held, shared accounts, the summed
          filing reasons, then the option count lines per gate); the pane and strip lines link here. */}
      <ExcludedSection c={{ ...fromRow(user, filer?.excluded ?? null), options: opt.counts, gate: opt.gate }} />
      {paper > 0 && <p className="muted">{RECORD_BODY.paperExcluded(paper)}</p>}
      {filer && publicExclusions(Object.fromEntries(Object.entries(filer.excluded).filter(([k]) => !PUBLIC_KINDS[k as PublicReason]?.summed))).map((l) => <p key={l} className="muted" data-public-excluded>{l}</p>)}
      {filer && filer.openSymbols.length > 0 && <section aria-labelledby="public-open" data-public-open>
        <h2 id="public-open">{PUBLIC.openTitle}</h2>
        <p>{[...filer.openSymbols].sort().join(', ')}</p>
        <p className="muted small">{PUBLIC.openNote}</p>
      </section>}

      {/* FIXES-LABELS: status. ponytail: open-position rows number accounts per symbol, not "Account i of n" — map rows through accountLabels with an f6 spec update */}
      {/* TR-4: open positions, symbol and unrealized percent only, before the closed trades (S5 and S8). */}
      {complete && <UnsupportedLine counts={opt.counts} />}
      {/* OPTIONS fix round 3 (item 1): one "Open positions" heading and one list, share rows first, option rows after. */}
      <OpenPositionsBlock title={RECORD_BODY.positionsTitle} hasShares={positions.length > 0} open={optOpen}
        asOf={open && openAsOf && <p className="muted small" data-open={positions.length > 0 ? true : undefined}>{OPEN.asOf(asOfDay(openAsOf))}</p>}
        shareRows={positions.map((p) => (
          <li key={p.key}><div className="line"><b><Link href={`/t/${encodeURIComponent(p.symbol)}`}>{p.symbol}</Link>{p.account !== null && <span className="muted small"> account {p.account}</span>}</b><b className={toneClass(p.pct)}>{pct(p.pct)}</b></div></li>
        ))} />

      {showJoin && <JoinCta handle={user.handle} via={ctaVia((await searchParams)?.via)} />}

      <h2>Closed trades</h2>
      {recordBodyCopy(state, trades.length) && <p className="muted record-body">{recordBodyCopy(state, trades.length)}</p>}
      {trades.length > CLOSES_PAGING.size && <p className="muted small closes-showing">{CLOSES_PAGING.showing(win.start, win.shown, trades.length)}</p>}
      <RowFocus window={win.end} />
      <ul className="rows closes">
        {listed.map((t) => (
          <li key={t.id} id={`trade-${t.id}`} tabIndex={-1}>
            <div className="line">
              <span><b><Link href={`/t/${encodeURIComponent(t.symbol)}`}>{t.symbol}</Link></b> <span className="muted">{dateText(t.closed_at, now)}</span></span>
              <Link className="trade-link" href={`/u/${user.handle}/trade/${encodeURIComponent(t.sell_id)}`} aria-label={`${t.symbol} ${pct(t.return_pct)}, open trade page`}>
                <b className={toneClass(t.return_pct)}>{pct(t.return_pct)}</b>
              </Link>
            </div>
            {t.filing_url && <a className="filing-link" href={t.filing_url} target="_blank" rel="noopener noreferrer" aria-label={PUBLIC.filingName(t.symbol, day(t.closed_at))}>{PUBLIC.filing}</a>}
            {/* F-9: UserNote (Report only for a signed-in reader who is not the author); the author sees the hold and its reason in plain words, muted (fix round 2: lib/report-copy.ts#heldLine). */}
            {t.thesis_status === 'published' && <UserNote text={t.thesis} handle={user.handle} writtenAt={t.thesis_written_at} editedAt={t.thesis_edited_at} reportId={me && !isMe ? String(t.id) : undefined} symbol={t.symbol} />}
            {isMe && t.thesis_status === 'held' && !!t.thesis && <HeldNote rule={t.thesis_hold_rule} />}{/* F-26: the one held-line markup (lib/user-note.ts); an empty note is never held */}
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
      {opt.gate === 'open' && complete && <OptionTradesSection trades={opt.trades} start={Number((await searchParams)?.options) || 0} handle={user.handle} />}
      {similar && <SimilarSection handle={user.handle} similar={similar} signedIn={!!me} />}
      <p><Link href="/" className="tap44">← Feed</Link></p>
    </main>
  );
}
