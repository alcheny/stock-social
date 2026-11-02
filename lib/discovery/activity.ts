// F-2 PR-5: the viewer's two personalization switches and the activity log's storage. Every read and write is keyed by
// the viewer's own id; nothing here is read for anyone else, and nothing is stored for a signed-out reader.
// - "Personalize my feed" (users.personalize_feed, default On): Off, ordering ignores follows, likes and activity.
// - "Personalize with my activity" (users.activity_log_on_at, default Off, owner 2026-11-01): Off, the logger is not
//   mounted, /api/events stores nothing and stored events are not read. "Clear my activity" deletes every event at once;
//   nothing is derived from them and stored (the profile is computed on read, lib/discovery/personal.ts), so nothing
//   else needs clearing.
// Stored events are kept until the viewer clears them or deletes the account (owner 2026-11-01: no timer); ordering
// reads only the last READ_DAYS, fading (lib/discovery/personal.ts).
import { sql } from '../db.ts';
import { BATCH_MAX_PER_WINDOW, BATCH_WINDOW_MS, EVENT_TYPES, SURFACES, type RawEvent } from './events.ts';
import { forgetViewer } from './personal-cache.ts';
import { visibleUser } from '../visible-users.ts';

export const READ_DAYS = 90;
// ponytail: ordering reads only the newest READ_MAX events in the 90-day window — a per-viewer aggregate table would cover
// heavier readers without reading more rows.
export const READ_MAX = 2_000; // the newest events read per viewer

export type Settings = { personalize: boolean; activity: boolean };
export const DEFAULT_SETTINGS: Settings = { personalize: true, activity: false };

export async function settingsFor(viewer: number): Promise<Settings> {
  const [r] = await sql`select personalize_feed, activity_log_on_at from users where id = ${viewer} and deleted_at is null`;
  return r ? { personalize: r.personalize_feed as boolean, activity: r.activity_log_on_at !== null } : DEFAULT_SETTINGS;
}
export async function setPersonalize(viewer: number, on: boolean): Promise<void> {
  await sql`update users set personalize_feed = ${on} where id = ${viewer}`;
  forgetViewer(viewer); // the kept personal lists go at once (lib/discovery/personal-cache.ts)
}
// Turning activity Off stops logging and use at once; what was stored stays (stored until cleared, owner 2026-11-01) and
// is unused while Off. Turning it On sets the time it was turned on (Off clears it).
export async function setActivity(viewer: number, on: boolean): Promise<void> {
  await sql`update users set activity_log_on_at = ${on ? sql`coalesce(activity_log_on_at, now())` : null} where id = ${viewer}`;
  forgetViewer(viewer);
}
export async function hasActivity(viewer: number): Promise<boolean> {
  return (await sql`select 1 from discovery_events where viewer_id = ${viewer} limit 1`).length > 0;
}
export async function clearActivity(viewer: number): Promise<number> {
  const n = (await sql`delete from discovery_events where viewer_id = ${viewer}`).count;
  forgetViewer(viewer); // nothing derived from the cleared events is used again
  return n;
}

// Store a parsed batch for this viewer. In one transaction: the gate (activity On, personalize On, the account live, and at
// most BATCH_MAX_PER_WINDOW batches from this viewer per BATCH_WINDOW_MS: a row lock on the viewer, so it holds across
// server instances, business lead demand 5; tester finding 1: a window, so the page-leave batch right after a periodic
// one is not refused), then one multi-row insert of the targets that exist (a trade by its card id → its stable key
// and trader; a trader by handle), never the viewer themselves, at most DAY_MAX a UTC day. 'rate': the gate refused.
// ponytail: events past DAY_MAX in a UTC day are dropped silently — raise it, or keep a count, if real readers reach it.
export const DAY_MAX = 2_000;
export async function recordEvents(viewer: number, events: readonly RawEvent[]): Promise<number | 'rate' | 'off'> {
  return sql.begin(async (tx) => {
    const [g] = await tx`select activity_log_on_at is not null and personalize_feed and deleted_at is null as on,
      activity_batch_at is not null and activity_batch_at > now() - ${BATCH_WINDOW_MS} * interval '1 millisecond' as open, activity_batch_n as n
      from users where id = ${viewer} for update`;
    if (!g?.on) return 'off' as const;
    if (g.open && g.n >= BATCH_MAX_PER_WINDOW) return 'rate' as const;
    await tx`update users set ${g.open ? sql`activity_batch_n = activity_batch_n + 1` : sql`activity_batch_at = now(), activity_batch_n = 1`} where id = ${viewer}`;
    if (!events.length) return 0;
    const tradeIds = [...new Set(events.flatMap((e) => (e.target.kind === 'trade' ? [e.target.id] : [])))];
    const handles = [...new Set(events.flatMap((e) => (e.target.kind === 'trader' ? [e.target.handle] : [])))];
    const trades = tradeIds.length ? await tx`select t.id::text as id, t.trade_key, t.user_id from closed_trades t join users u on u.id = t.user_id and ${visibleUser('u')} where t.id = any(${tradeIds}::bigint[])` : []; // F-16: never a hidden trader's
    const traders = handles.length ? await tx`select id, handle from users u where handle = any(${handles}) and ${visibleUser('u')}` : [];
    const byTrade = new Map(trades.map((r) => [r.id as string, { key: r.trade_key as string, user: r.user_id as number }]));
    const byHandle = new Map(traders.map((r) => [r.handle as string, r.id as number]));
    const rows: { s: number; t: number; k: string; u: number | null; key: string | null; sym: string | null }[] = [];
    for (const e of events) {
      const base = { s: SURFACES[e.surface], t: EVENT_TYPES[e.type] };
      if (e.target.kind === 'trade') { const r = byTrade.get(e.target.id); if (r && r.user !== viewer) rows.push({ ...base, k: 'trade', u: r.user, key: r.key, sym: null }); }
      else if (e.target.kind === 'trader') { const u = byHandle.get(e.target.handle); if (u && u !== viewer) rows.push({ ...base, k: 'trader', u, key: null, sym: null }); }
      else rows.push({ ...base, k: 'symbol', u: null, key: null, sym: e.target.symbol });
    }
    if (!rows.length) return 0;
    const col = <K extends keyof (typeof rows)[number]>(k: K) => rows.map((r) => r[k]);
    return (await tx`insert into discovery_events (viewer_id, surface, type, target_kind, target_user_id, target_trade_key, target_symbol)
      select ${viewer}, s, t, k, u, key, sym from unnest(${col('s')}::smallint[], ${col('t')}::smallint[], ${col('k')}::text[], ${col('u')}::int[], ${col('key')}::text[], ${col('sym')}::text[])
        with ordinality as x(s, t, k, u, key, sym, n)
      where n <= ${DAY_MAX} - (select count(*) from discovery_events where viewer_id = ${viewer} and at >= date_trunc('day', now(), 'UTC'))`).count;
  });
}

// The events ordering reads: this viewer's, made at or before `asOf` and within READ_DAYS of it, newest READ_MAX, with
// the trade's symbol when the close still exists. Only called when the activity switch is On.
export type LoggedEvent = { type: number; trader: number | null; symbol: string | null; at: number };
export async function eventsFor(viewer: number, asOf: Date): Promise<LoggedEvent[]> {
  const rows = await sql`select e.type, e.target_user_id, e.at, (select t.symbol from closed_trades t where t.trade_key = e.target_trade_key limit 1) as symbol
    from discovery_events e where e.viewer_id = ${viewer} and e.at <= ${asOf} and e.at > ${asOf}::timestamptz - ${READ_DAYS} * interval '1 day'
      and e.target_kind <> 'symbol'
    order by e.at desc limit ${READ_MAX}`;
  return rows.map((r) => ({ type: r.type as number, trader: r.target_user_id as number | null, symbol: r.symbol as string | null, at: (r.at as Date).getTime() }));
}
