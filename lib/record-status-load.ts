// F-11: the status line's facts for many traders in ONE query (docs/features/logs/fixes-labels/plan.md §1, §5): the
// last successful sync (users.last_synced_at), the first entry and last close, today's "Connected:" inputs, and the
// consented connected connections with their accounts' removal dates. It reads no cron setting, no schedule and no
// render clock (F-11 AC2): "updated" is whatever the last completed rebuild wrote. The record state is the caller's
// (lib/connections.ts#recordStates), so a page that already has it never computes it twice.
import { sql } from './db.ts';
import { logSafe } from './privacy-log.ts';
import type { RecordStatus, PublicState } from './connections.ts';
import type { StatusConnection, StatusFacts } from './record-status.ts';

export type StatusRow = Omit<StatusFacts, 'state'>;
type Json = { id: number; consentAt: string; disconnectedAt: string | null; institution: string | null; accounts: { id: string; isPaper: boolean; institution: string | null; removedAt: string | null }[] };

const date = (s: string | null) => (s ? new Date(s) : null);

// ponytail: the account count and the demo check scan each trader's activities (as the profile's own reads do) — a
// per-user account count and source flag written by the sync would make them constant-time on a feed page
// ponytail: an account the vendor lists again but with no trade after its removal still reads "Account removed" — fix:
// stamp a per-account last_listed_at in lib/sync.ts and compare it with removed_at here
export async function statusRows(userIds: number[]): Promise<Map<number, StatusRow>> {
  const ids = [...new Set(userIds)].map(Number);
  const out = new Map<number, StatusRow>();
  if (!ids.length) return out;
  const rows = await sql`
    with closes as (
      select user_id, min(opened_at) as first_entry, max(closed_at) as last_close from closed_trades where user_id = any(${ids}::int[]) group by user_id
    ), accts as (
      select user_id, count(distinct account_id)::int as n from activities where user_id = any(${ids}::int[]) and source = 'snaptrade' group by user_id
    ), conns as (
      select c.user_id, jsonb_agg(jsonb_build_object('id', c.id, 'consentAt', c.consent_at, 'disconnectedAt', c.disconnected_at, 'institution', c.institution,
        'accounts', (select coalesce(jsonb_agg(jsonb_build_object('id', x.a->>'id', 'isPaper', coalesce((x.a->>'isPaper')::boolean, false),
            'institution', x.a->>'institution',
            -- FIXES-LABELS (code review): a removed account the vendor listed again (a trade on it executed after the
            -- removal, which only a later listing imports) no longer reads "Account removed"; removed_at itself is never
            -- cleared (lib/sync.ts).
            'removedAt', case when exists (select 1 from activities av where av.user_id = c.user_id and av.account_id = ba.account_id
              and av.executed_at > ba.removed_at) then null else ba.removed_at end) order by x.ord), '[]'::jsonb)
          from jsonb_array_elements(c.accounts) with ordinality x(a, ord)
          left join broker_accounts ba on ba.account_id = x.a->>'id' and ba.user_id = c.user_id)) order by c.id) as list
      from connections c where c.user_id = any(${ids}::int[]) and c.consent_at is not null and c.state = 'connected' group by c.user_id
    ), insts as (
      -- lib/connections.ts#recordInstitutions, per trader: institutions of consented real accounts, in link order.
      select user_id, array_agg(inst order by first, inst) as list from (
        select c.user_id, x.a->>'institution' as inst, min(c.id) as first from connections c, jsonb_array_elements(c.accounts) x(a)
        where c.user_id = any(${ids}::int[]) and c.consent_at is not null and c.state in ('importing', 'connected', 'failed')
          and coalesce((x.a->>'isPaper')::boolean, false) = false and coalesce(btrim(x.a->>'institution'), '') <> ''
        group by 1, 2) i group by user_id
    )
    select u.id, u.last_synced_at, cl.first_entry, cl.last_close, coalesce(ac.n, 0) as accounts,
      coalesce(cn.list, '[]'::jsonb) as connections, coalesce(i.list, '{}'::text[]) as brokers,
      exists (select 1 from activities d where d.user_id = u.id and d.source = 'demo') as demo,
      exists (select 1 from connections c where c.user_id = u.id and c.consent_at is not null and c.state in ('importing', 'connected', 'failed')) as consented,
      exists (select 1 from broker_accounts b where b.user_id = u.id and b.confirmed_at is not null and b.connection_id is null) as legacy
    from users u
    left join closes cl on cl.user_id = u.id left join accts ac on ac.user_id = u.id
    left join conns cn on cn.user_id = u.id left join insts i on i.user_id = u.id
    where u.id = any(${ids}::int[])`;
  for (const r of rows) {
    const connections: StatusConnection[] = (r.connections as Json[]).map((c) => ({
      id: Number(c.id), consentAt: new Date(c.consentAt), disconnectedAt: date(c.disconnectedAt), institution: c.institution,
      accounts: c.accounts.map((a) => ({ id: a.id, isPaper: a.isPaper, institution: a.institution, removedAt: date(a.removedAt) })),
    }));
    out.set(Number(r.id), {
      source: r.demo ? 'demo' : r.consented || r.legacy ? 'broker' : 'none',
      firstEntry: (r.first_entry as Date | null) ?? null, lastClose: (r.last_close as Date | null) ?? null, lastSyncedAt: (r.last_synced_at as Date | null) ?? null,
      brokers: r.brokers as string[], accounts: r.accounts as number, connections,
    });
  }
  return out;
}

// FIXES-LABELS (code review): the status line is an extra on the feed; its read failing leaves the line out (an empty
// map), never the page. Logged as counts only. `load` is a test hook.
export function statusRowsOrEmpty(userIds: number[], load: (ids: number[]) => Promise<Map<number, StatusRow>> = statusRows): Promise<Map<number, StatusRow>> {
  const traders = userIds.length;
  return Promise.resolve().then(() => load(userIds)).catch((e: unknown) => {
    console.error('status rows failed, status line left out', JSON.stringify({ traders }), logSafe(e));
    return new Map<number, StatusRow>();
  });
}

export function withStates(rows: Map<number, StatusRow>, states: Map<number, RecordStatus | { state: PublicState }>): Map<number, StatusFacts> {
  const out = new Map<number, StatusFacts>();
  for (const [id, r] of rows) out.set(id, { ...r, state: states.get(id)?.state ?? 'none' });
  return out;
}

// The facts for the `recordStates` id set and its states (one query).
export async function statusFacts(userIds: number[], states: Map<number, RecordStatus | { state: PublicState }>): Promise<Map<number, StatusFacts>> {
  return withStates(await statusRows(userIds), states);
}

// One trader (profile, trade and month pages), with the state the page already read.
export async function statusFor(userId: number, state: PublicState): Promise<StatusFacts | null> {
  return (await statusFacts([userId], new Map([[userId, { state }]]))).get(userId) ?? null;
}
