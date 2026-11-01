// OPTIONS (docs/features/logs/options/plan.md D5, D6, AC 16, 22, 23): the only reader of the option tables for
// display. Closed gate: counts only (no return, contract term or underlying is selected). Open gate: the full model.
// Renders (app/u/[handle]/options-block.tsx, the pane and the record card) are pure functions of what this returns,
// and the display log stores only its text. Callers never pass the gate argument (tests do, lib/options-load.test.ts).
import { sql } from './db.ts';
import { optionSummary } from './options.ts';
import { consentCoversOptions, optionsPublic } from './options-gate.ts';
import { hasOptions, optionDisplayText, type OpenOptionView, type OptionCounts, type OptionHeadline, type OptionRecord, type OptionTradeView } from './options-view.ts';
export * from './options-view.ts';

/** D5 per trader (rounds 3–5): the scope line names options AND every account holding option rows maps to at least one
 *  consented connection, every one of which carries a covering hash (frozen ones included). An account no connection
 *  holds keeps the trader gated. A demo trader (no broker row at all) skips the per-trader part. */
// ponytail: K10 existing traders stay gated until they consent again, and reconnecting alone may not open the gate (a
// frozen connection holding the same account under an old hash still blocks) — a re-consent prompt on /me that rewrites
// consent_scope_hash on every connection holding the account (the owner words it).
export async function traderOptionsPublic(userId: number): Promise<boolean> {
  if (!optionsPublic()) return false;
  const [d] = await sql`select
      exists (select 1 from option_activities where user_id = ${userId} and source = 'demo') or exists (select 1 from activities where user_id = ${userId} and source = 'demo') as demo,
      exists (select 1 from option_activities where user_id = ${userId} and source <> 'demo') or exists (select 1 from activities where user_id = ${userId} and source <> 'demo') as broker`;
  if (d.demo && !d.broker) return true;
  const rows = await sql`with accts as (
      select distinct account_id from option_activities where user_id = ${userId} and account_id is not null
      union select distinct account_id from open_option_positions where user_id = ${userId})
    select a.account_id, coalesce(json_agg(c.consent_scope_hash) filter (where c.id is not null), '[]') as hashes
    from accts a left join connections c on c.user_id = ${userId} and c.consent_at is not null
      and exists (select 1 from jsonb_array_elements(c.accounts) x where x->>'id' = a.account_id)
    group by a.account_id`;
  return rows.every((r) => (r.hashes as (string | null)[]).length > 0 && (r.hashes as (string | null)[]).every((h) => consentCoversOptions(h)));
}

// AC 16: the closed-gate read. Counts only — the test reads this function's text and finds no return, term or symbol.
// COUNTS-ONLY-BEGIN
async function loadCounts(userIds: number[]): Promise<Map<number, OptionCounts>> {
  if (!userIds.length) return new Map();
  const rows = await sql`select u.id, u.excluded_options_short, u.excluded_options_other, u.open_options_short, u.open_unsupported,
      (select count(*)::int from option_trades t where t.user_id = u.id) as shown,
      (select count(*)::int from open_option_positions p where p.user_id = u.id) as open_long
    from users u where u.id in ${sql(userIds)}`;
  return new Map(rows.map((r) => [r.id as number, {
    shown: r.shown as number, short: r.excluded_options_short as number, other: r.excluded_options_other as number,
    openLong: r.open_long as number, openShort: r.open_options_short as number, unsupported: r.open_unsupported as number,
  }]));
}
// COUNTS-ONLY-END
const ZERO: OptionCounts = { shown: 0, short: 0, other: 0, openLong: 0, openShort: 0, unsupported: 0 };

async function loadTrades(userIds: number[]): Promise<Map<number, OptionTradeView[]>> {
  const rows = await sql`select id, user_id, underlying, option_right, to_char(option_expiry, 'YYYY-MM-DD') as expiry, opened_at, closed_at, return_pct, holding_days, verified
    from option_trades where user_id in ${sql(userIds)} order by closed_at desc, id desc`;
  const m = new Map<number, OptionTradeView[]>();
  for (const r of rows) {
    const t: OptionTradeView = { id: String(r.id), underlying: r.underlying, right: r.option_right, expiry: r.expiry, openedAt: r.opened_at, closedAt: r.closed_at,
      returnPct: Number(r.return_pct), holdingDays: Number(r.holding_days), verified: r.verified };
    const a = m.get(r.user_id as number); if (a) a.push(t); else m.set(r.user_id as number, [t]);
  }
  return m;
}

/** The profile's option record. `gate` is for tests only (AC 23 inventory). */
export async function loadOptionRecord(userId: number, gate: boolean | Promise<boolean> = traderOptionsPublic(userId)): Promise<OptionRecord> {
  const counts = (await loadCounts([userId])).get(userId) ?? ZERO;
  if (!(await gate)) return { gate: 'closed', counts };
  const trades = (await loadTrades([userId])).get(userId) ?? [];
  const open = await sql`select position_key, underlying, option_right, to_char(option_expiry, 'YYYY-MM-DD') as expiry, unrealized_pct
    from open_option_positions where user_id = ${userId} order by underlying, option_expiry, option_right, position_key, account_id`;
  return {
    gate: 'open', counts, summary: optionSummary(trades), trades,
    open: open.map((p, i) => ({ key: `${p.position_key}:${i}`, underlying: p.underlying, right: p.option_right, expiry: p.expiry, pct: Number(p.unrealized_pct) })),
  };
}

// ponytail: K4 similar, compare, recap, /me/record and the import banner count ignore options — read this loader there
// (counts while gated) when those surfaces should mention them.
/** The pane's and the record card's headline model, per trader. The default gate is worked out per trader, never once
 *  per batch (round 4 legal); `gate` is for tests only. */
export async function optionHeadline(userIds: number[], gate?: (userId: number) => boolean | Promise<boolean>): Promise<Map<number, OptionHeadline>> {
  const ids = [...new Set(userIds)];
  const counts = await loadCounts(ids);
  const out = new Map<number, OptionHeadline>();
  const open: number[] = [];
  for (const id of ids) {
    const c = counts.get(id) ?? ZERO;
    // Nothing to gate without option rows; otherwise each trader's own state.
    if (hasOptions(c) && (await (gate ?? traderOptionsPublic)(id))) open.push(id);
    else out.set(id, { gate: 'closed', counts: c });
  }
  if (open.length) {
    const trades = await loadTrades(open);
    for (const id of open) out.set(id, { gate: 'open', counts: counts.get(id) ?? ZERO, summary: optionSummary(trades.get(id) ?? []) });
  }
  return out;
}

export async function loadOptionDisplayText(userId: number): Promise<string | null> {
  return optionDisplayText((await optionHeadline([userId])).get(userId)!);
}
