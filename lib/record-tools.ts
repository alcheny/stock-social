// F-3 · Record tools, the first paid feature (docs/features/F-3-viewer-subscriptions.md; legal committee conditions in
// docs/features/logs/F-3/committee-2026-11-01.md, "K<n>" below). Saved views and private notes, visible only to their
// owner; every read and write here is keyed by the owner's own id and checked on the server (K4). A view stores a name
// and ordered traders only, never a number (K4); the comparison recomputes every figure from the same functions and
// tables the public profile reads, at the same time (K2). Nothing here sorts traders by a number, highlights one,
// writes discovery_events, counts profile views or sends anything (K3, K7, K13). Notes are never read by ranking or
// discovery code and never logged (K5).
import { sql } from './db.ts';
import { confidence, evidenceLine, isNewRecord, pct, rangeText, stats, type Confidence } from './trades.ts';
import { connectedLine, HIDDEN_NOTICE, PROFILE, RECORD_BODY } from './copy.ts';
import { DISCLAIMER } from './share.ts';
import { publicRecordDetail, recordInstitutions, type PublicState } from './connections.ts';
import { paneTrust } from './pane.ts';
import { followHandles, shownName, traderId } from './follows.ts';
import { exportSubscription } from './billing.ts';
import { toneClass } from './open-split.ts';
import { visibleId, visibleUser } from './visible-users.ts';

// F-3: set by /tools/signin, read once by the sign-in landing (lib/auth/landing.ts) to come back to Record tools.
export const AFTER_SIGNIN_COOKIE = 'after_signin';

export const MAX_TRADERS = 4;
export const MAX_VIEWS = 20;
export const NOTE_MAX = 2000;
export const NAME_MAX = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const isViewId = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);
const cleanName = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, NAME_MAX);
  return s || null;
};

// ---- views ----------------------------------------------------------------------------------------------------------

export type ViewSummary = { id: string; name: string; traders: number };
// Creation order, never by a number (K3).
export async function listViews(owner: number): Promise<ViewSummary[]> {
  const rows = await sql`select v.id, v.name, (select count(*)::int from record_view_traders t join users u on u.id = t.trader_id and u.deleted_at is null where t.view_id = v.id) as traders
    from record_views v where v.owner_id = ${owner} order by v.created_at, v.id`;
  return rows.map((r) => ({ id: r.id as string, name: r.name as string, traders: r.traders as number }));
}

export type ViewTrader = { id: number; handle: string; name: string };
export type View = { id: string; name: string; traders: ViewTrader[] };
// Null for a missing view, a malformed id and someone else's view alike (K4: the same 404).
export async function getView(owner: number, id: unknown): Promise<View | null> {
  if (!isViewId(id)) return null;
  const [v] = await sql`select id, name from record_views where id = ${id} and owner_id = ${owner}`;
  if (!v) return null;
  const traders = await sql`select u.id, u.handle, ${shownName('u')} as display_name from record_view_traders t join users u on u.id = t.trader_id and u.deleted_at is null
    where t.view_id = ${id} order by t.position, t.trader_id`;
  return { id: v.id as string, name: v.name as string, traders: traders.map((t) => ({ id: t.id as number, handle: t.handle as string, name: (t.display_name as string | null) ?? HIDDEN_NOTICE.name })) };
}

export type CreateResult = { ok: true; id: string } | { ok: false; reason: 'name' | 'limit' };
// A blank name becomes "View n" (n = the owner's view count + 1).
export async function createView(owner: number, rawName: unknown): Promise<CreateResult> {
  if (rawName !== undefined && rawName !== null && typeof rawName !== 'string') return { ok: false, reason: 'name' };
  const name = cleanName(rawName);
  // One create at a time per owner, so the limit holds under concurrent creates (a count in the insert alone did not).
  const [v] = await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext(${`record_views:${owner}`}))`;
    return tx`insert into record_views (owner_id, name)
      select ${owner}, coalesce(${name}::text, 'View ' || (count(*) + 1)) from record_views where owner_id = ${owner}
      having count(*) < ${MAX_VIEWS} returning id`;
  });
  return v ? { ok: true, id: v.id as string } : { ok: false, reason: 'limit' };
}

export async function renameView(owner: number, id: unknown, rawName: unknown): Promise<boolean> {
  const name = cleanName(rawName);
  if (!isViewId(id) || !name) return false;
  return (await sql`update record_views set name = ${name}, updated_at = now() where id = ${id} and owner_id = ${owner}`).count === 1;
}

export async function deleteView(owner: number, id: unknown): Promise<boolean> {
  if (!isViewId(id)) return false;
  return (await sql`delete from record_views where id = ${id} and owner_id = ${owner}`).count === 1;
}

export type AddResult = { ok: true; position: number; count: number } | { ok: false; reason: 'view' | 'unknown' | 'duplicate' | 'full' };
// Exact handle only (K1): no search, no suggestion. The handle is never logged.
export async function addTrader(owner: number, viewId: unknown, handle: unknown): Promise<AddResult> {
  const view = await getView(owner, viewId);
  if (!view) return { ok: false, reason: 'view' };
  const trader = await traderId(typeof handle === 'string' ? handle.trim().replace(/^@/, '').toLowerCase() : handle);
  // F-7 (legal C21): public-filing records are never behind a paid feature, so a filer can't be added to a view.
  // F-16: a hidden trader is unknown here too (the add names nobody the public can't see).
  if (!trader || (await sql`select 1 from users u where u.id = ${trader} and (u.public_filer_id is not null or not ${visibleUser('u')})`).length) return { ok: false, reason: 'unknown' };
  if (view.traders.some((t) => t.id === trader)) return { ok: false, reason: 'duplicate' };
  if (view.traders.length >= MAX_TRADERS) return { ok: false, reason: 'full' };
  // E7: one add at a time per view, so two concurrent adds can never make a fifth trader.
  const [r] = await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext(${`record_view:${view.id}`}))`;
    return tx`insert into record_view_traders (view_id, trader_id, position)
      select ${view.id}, ${trader}, coalesce(max(position), 0) + 1 from record_view_traders where view_id = ${view.id}
      having count(*) < ${MAX_TRADERS}
      on conflict do nothing returning trader_id`;
  });
  if (!r) return { ok: false, reason: 'full' };
  await touch(view.id);
  const after = await getView(owner, view.id);
  return { ok: true, position: after!.traders.findIndex((t) => t.id === trader) + 1, count: after!.traders.length };
}

export async function removeTrader(owner: number, viewId: unknown, trader: unknown): Promise<boolean> {
  const view = await getView(owner, viewId);
  const id = Number(trader);
  if (!view || !Number.isInteger(id)) return false;
  const done = (await sql`delete from record_view_traders where view_id = ${view.id} and trader_id = ${id}`).count === 1;
  if (done) await touch(view.id);
  return done;
}

// Swaps with the neighbour in the saved order; the order is only ever the owner's (K1, K3).
export async function moveTrader(owner: number, viewId: unknown, trader: unknown, dir: 'up' | 'down'): Promise<{ position: number; count: number } | null> {
  const view = await getView(owner, viewId);
  const id = Number(trader);
  if (!view) return null;
  const i = view.traders.findIndex((t) => t.id === id);
  const j = dir === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= view.traders.length) return i < 0 ? null : { position: i + 1, count: view.traders.length };
  const order = view.traders.map((t) => t.id);
  [order[i], order[j]] = [order[j], order[i]];
  await sql.begin((tx) => order.map((t, k) => tx`update record_view_traders set position = ${k + 1} where view_id = ${view.id} and trader_id = ${t}`));
  await touch(view.id);
  return { position: j + 1, count: order.length };
}

const touch = (id: string) => sql`update record_views set updated_at = now() where id = ${id}`;

// The owner's follow list for the "Or choose someone you follow" select: alphabetical by handle only (K1), at most
// FOLLOW_OPTIONS_MAX (the exact-handle input covers anyone else; `more` shows a line saying so), leaving out `exclude`
// (the view's traders). Read through lib/follows.ts, the only module that reads the follows table.
export const FOLLOW_OPTIONS_MAX = 100;
export async function followOptions(owner: number, exclude: readonly string[] = []): Promise<{ options: { handle: string }[]; more: boolean }> {
  const { handles, more } = await followHandles(owner, FOLLOW_OPTIONS_MAX, exclude);
  return { options: handles.map((handle) => ({ handle })), more };
}

// ---- notes ----------------------------------------------------------------------------------------------------------

export type Note = { traderId: number; handle: string; body: string; updatedAt: Date };
// ponytail: an owner's notes are listed whole (a note outlives its trader's place in a view, so the count is unbounded)
// — page the list past about 100 notes.
export async function listNotes(owner: number): Promise<Note[]> {
  const rows = await sql`select n.trader_id, u.handle, n.body, n.updated_at from record_notes n join users u on u.id = n.trader_id and u.deleted_at is null
    where n.owner_id = ${owner} order by u.handle`;
  return rows.map((r) => ({ traderId: r.trader_id as number, handle: r.handle as string, body: r.body as string, updatedAt: r.updated_at as Date }));
}

export type NoteResult = 'saved' | 'deleted' | 'too_long' | 'self' | 'unknown';
// Keyed by trader id, never by handle (K5): a handle reissued after a deletion never picks up an old note. An empty
// note deletes it. The 2,000-character limit is enforced here (and by the schema).
export async function saveNote(owner: number, trader: unknown, rawBody: unknown): Promise<NoteResult> {
  const id = Number(trader);
  if (!Number.isInteger(id)) return 'unknown';
  if (id === owner) return 'self';
  const body = typeof rawBody === 'string' ? rawBody.replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim() : '';
  if ([...body].length > NOTE_MAX) return 'too_long';
  // E7: a note is about a trader in one of the owner's views (or one already noted); never an arbitrary account id.
  const [t] = await sql`select 1 from users u where u.id = ${id} and u.deleted_at is null and u.public_filer_id is null and (
    exists (select 1 from record_view_traders t join record_views v on v.id = t.view_id where v.owner_id = ${owner} and t.trader_id = ${id})
    or exists (select 1 from record_notes n where n.owner_id = ${owner} and n.trader_id = ${id}))`;
  if (!t) return 'unknown';
  if (!body) { await sql`delete from record_notes where owner_id = ${owner} and trader_id = ${id}`; return 'deleted'; }
  await sql`insert into record_notes (owner_id, trader_id, body) values (${owner}, ${id}, ${body})
    on conflict (owner_id, trader_id) do update set body = excluded.body, updated_at = now()`;
  return 'saved';
}
export async function deleteNote(owner: number, trader: unknown): Promise<boolean> {
  const id = Number(trader);
  if (!Number.isInteger(id)) return false;
  return (await sql`delete from record_notes where owner_id = ${owner} and trader_id = ${id}`).count === 1;
}

// K12: whether a trader named in this owner's views or notes deleted their account since the owner last dismissed the
// line. Reading never clears it (a page render or a link prefetch must not use it up); "OK" does, by POST.
export async function removedNotice(owner: number): Promise<boolean> {
  const [r] = await sql`select removed from record_tool_notices where owner_id = ${owner}`;
  return !!r && (r.removed as number) > 0;
}
export async function dismissRemovedNotice(owner: number): Promise<void> {
  await sql`delete from record_tool_notices where owner_id = ${owner}`;
}

// ---- the comparison (K2, K3) ----------------------------------------------------------------------------------------

export type Card = {
  id: number; handle: string; name: string;
  state: PublicState; badge: 'verified' | 'demo' | null; isNew: boolean;
  since: string | null; connected: string;
  closed: number;
  figures: null | { winRate: string; avg: string; avgSign: 'up' | 'down' | ''; range: string | null; low: string | null; evidence: string; drawdown: string };
  excluded: string[]; // the profile's exclusion lines, each only when non-zero, in the profile's order
};

// One card per trader, in the given (saved) order. Every figure comes from the same functions the profile uses
// (stats, confidence, evidenceLine, rangeText, pct) over the same rows; nothing is compared across traders.
export async function compareCards(traders: ViewTrader[], now = new Date()): Promise<Card[]> {
  return Promise.all(traders.map((t) => card(t, now)));
}

// ponytail: each card reads the trader's whole closed_trades, exactly as the profile does (up to 4 profile reads per
// view) — share a cached per-trader summary once the profile has one.
async function card(t: ViewTrader, now: Date): Promise<Card> {
  const [u] = await sql`select excluded_positions, excluded_future, excluded_corporate from users where id = ${t.id}`;
  const trades = await sql`select symbol, return_pct, holding_days, opened_at, closed_at, verified from closed_trades where user_id = ${t.id} and ${visibleId(t.id)}`;
  const [{ accounts }] = await sql`select count(distinct account_id)::int as accounts from activities where user_id = ${t.id} and source = 'snaptrade'`;
  const { public: { state, paper } } = await publicRecordDetail(t.id);
  const brokers = await recordInstitutions(t.id);
  const c: Confidence = confidence(trades.map((x) => ({ symbol: x.symbol, openedAt: x.opened_at, closedAt: x.closed_at, returnPct: x.return_pct, holdingDays: x.holding_days })), now);
  const s = stats(trades.map((x) => ({ returnPct: x.return_pct, holdingDays: x.holding_days, closedAt: x.closed_at })));
  const trust = paneTrust(trades.map((x) => ({ verified: x.verified as boolean })), state);
  const allVerified = trades.length > 0 && trades.every((x) => x.verified);
  const first = trades.length ? new Date(Math.min(...trades.map((x) => (x.opened_at as Date).getTime()))) : null;
  const complete = state !== 'importing';
  const show = complete && trades.length > 0;
  return {
    id: t.id, handle: t.handle, name: t.name, state,
    badge: show && (trust.badge === 'verified' || trust.badge === 'demo') ? trust.badge : null, // F-7: filers never reach a view
    isNew: show && isNewRecord(trades.map((x) => ({ openedAt: x.opened_at })), trades.length, now),
    since: complete && first ? first.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null,
    connected: allVerified ? connectedLine(brokers, accounts) : 'Demo data',
    closed: trades.length,
    figures: show ? {
      winRate: `${(s.winRate * 100).toFixed(0)}%`,
      avg: pct(s.avgReturn), avgSign: toneClass(s.avgReturn) ?? '', // A11Y-FIXES #23: 0.0% is neutral
      range: rangeText(c), low: c.perTrade ? pct(c.perTrade.low) : null,
      evidence: evidenceLine(c),
      drawdown: pct(-s.maxDrawdown),
    } : null,
    excluded: [
      ...((u?.excluded_positions as number) > 0 ? [PROFILE.excludedPositions(u.excluded_positions as number)] : []),
      ...((u?.excluded_future as number) > 0 ? [PROFILE.excludedFuture(u.excluded_future as number)] : []),
      ...((u?.excluded_corporate as number) > 0 ? [PROFILE.excludedCorporate(u.excluded_corporate as number)] : []), // F3-13
      ...(paper > 0 ? [RECORD_BODY.paperExcluded(paper)] : []),
    ],
  };
}

// ---- export (K11) ---------------------------------------------------------------------------------------------------

// Exactly: the disclaimer, views (name, ordered handles, times), notes (trader handle, text, time) and the subscription
// (plan, status, period end, cancel at period end). No performance figures. A trader's export never includes other
// users' notes about them: only rows this account owns are read.
export async function exportFor(owner: number) {
  const views = await sql`select id, name, created_at, updated_at from record_views where owner_id = ${owner} order by created_at, id`;
  const members = views.length ? await sql`select t.view_id, u.handle from record_view_traders t join users u on u.id = t.trader_id and u.deleted_at is null
    where t.view_id in ${sql(views.map((v) => v.id as string))} order by t.position, t.trader_id` : [];
  const notes = await listNotes(owner);
  return {
    disclaimer: DISCLAIMER,
    views: views.map((v) => ({ name: v.name as string, traders: members.filter((m) => m.view_id === v.id).map((m) => m.handle as string), createdAt: (v.created_at as Date).toISOString(), updatedAt: (v.updated_at as Date).toISOString() })),
    notes: notes.map((n) => ({ trader: n.handle, text: n.body, updatedAt: n.updatedAt.toISOString() })),
    subscription: await exportSubscription(owner),
  };
}
