// fix-user-text B (F-9, POLICY U1): the release path for held theses and the start-up re-check.
// - releaseThesis: the owner publishes a held thesis (thesis_reviewed_at set, rule cleared) or keeps it held (reviewed,
//   rule kept). Either way thesis_reports_from is set: only reports made after it count (lib/reports.ts), and no edit
//   clears it, so an edit after a release never brings the old reports back. Run by scripts/review-theses.ts. It only changes a thesis's state, never its text, and never deletes.
// - remoderateAll: after a rules change, every published thesis is matched again; a match flips it to held. Only
//   published → held; a thesis the owner released is skipped (an edit clears the release, lib/thesis-save.ts).
//   Returns counts only, and nothing here logs a thesis or an id.
// - listHeld: the review list (the script and the flagged review page). Read-only.
// No session or viewer is read here: the owner runs the script; the page is off until real admin identity exists.
import { sql } from './db.ts';
import { moderateDetail } from './moderation.ts';

export type Decision = 'publish' | 'keep';
const PAGE = 1000;

/** True when the thesis was found held and its state changed. Covers both closed_trades and kept_theses. */
export async function releaseThesis(userId: number, sellId: string, decision: Decision): Promise<boolean> {
  if (!Number.isInteger(userId) || !sellId) return false;
  const publish = decision === 'publish';
  return sql.begin(async (tx) => {
    const set = publish
      ? tx`thesis_status = 'published', thesis_hold_rule = null, thesis_reviewed_at = now(), thesis_reports_from = now()`
      : tx`thesis_reviewed_at = now(), thesis_reports_from = now()`;
    const a = await tx`update closed_trades set ${set} where user_id = ${userId} and sell_id = ${sellId} and thesis is not null and thesis_status = 'held' returning 1`;
    const b = await tx`update kept_theses set ${set} where user_id = ${userId} and sell_id = ${sellId} and thesis_status = 'held' returning 1`;
    return a.length + b.length > 0;
  });
}

export type HeldRow = { userId: number; handle: string; sellId: string; symbol: string | null; closedAt: Date | null; rule: string | null; thesis: string; reviewed: boolean; kept: boolean; reports: number };

/** Held theses, oldest trade first, with the matched rule and how many readers reported each (no reporter ids). */
export async function listHeld(limit = 200): Promise<HeldRow[]> {
  const rows = await sql`
    select h.user_id, u.handle, h.sell_id, h.symbol, h.closed_at, h.thesis_hold_rule, h.thesis, h.thesis_reviewed_at is not null as reviewed, h.kept,
      (select count(*)::int from thesis_reports r where r.trader_id = h.user_id and r.sell_id = h.sell_id) as reports
    from (
      select user_id, sell_id, symbol, closed_at, thesis_hold_rule, thesis, thesis_reviewed_at, false as kept from closed_trades where thesis_status = 'held' and thesis is not null
      union all
      select k.user_id, k.sell_id, null, null, k.thesis_hold_rule, k.thesis, k.thesis_reviewed_at, true from kept_theses k
      where k.thesis_status = 'held' and not exists (select 1 from closed_trades c where c.user_id = k.user_id and c.sell_id = k.sell_id)
    ) h join users u on u.id = h.user_id and u.deleted_at is null
    order by h.user_id, h.sell_id limit ${limit}`;
  return rows.map((r) => ({ userId: r.user_id, handle: r.handle, sellId: r.sell_id, symbol: r.symbol, closedAt: r.closed_at ?? null, rule: r.thesis_hold_rule, thesis: r.thesis, reviewed: r.reviewed, kept: r.kept, reports: r.reports }));
}

/** Re-match every published, unreleased thesis; flip matches to held. Counts only. `only` limits it to some traders (tests). */
export async function remoderateAll(only?: number[]): Promise<{ checked: number; held: number }> {
  let checked = 0, held = 0;
  const scope = () => (only ? sql`and user_id = any(${only})` : sql``);
  for (let after = '0'; ;) {
    const page = await sql`select id::text as id, thesis from closed_trades
      where thesis_status = 'published' and thesis is not null and thesis_reviewed_at is null and id > ${after}::bigint ${scope()}
      order by id limit ${PAGE}`;
    for (const r of page) {
      checked++;
      const m = moderateDetail(r.thesis);
      if (m.status !== 'held') continue;
      const u = await sql`update closed_trades set thesis_status = 'held', thesis_hold_rule = ${m.rule}
        where id = ${r.id} and thesis_status = 'published' and thesis_reviewed_at is null returning 1`;
      held += u.length;
    }
    if (page.length < PAGE) break;
    after = page[page.length - 1].id;
  }
  for (let after: { u: number; s: string } | null = null; ;) {
    const page: { user_id: number; sell_id: string; thesis: string }[] = await sql<{ user_id: number; sell_id: string; thesis: string }[]>`select user_id, sell_id, thesis from kept_theses
      where thesis_status = 'published' and thesis_reviewed_at is null ${scope()}
      ${after ? sql`and (user_id, sell_id) > (${after.u}, ${after.s})` : sql``}
      order by user_id, sell_id limit ${PAGE}`;
    for (const r of page) {
      checked++;
      const m = moderateDetail(r.thesis);
      if (m.status !== 'held') continue;
      const u = await sql`update kept_theses set thesis_status = 'held', thesis_hold_rule = ${m.rule}
        where user_id = ${r.user_id} and sell_id = ${r.sell_id} and thesis_status = 'published' and thesis_reviewed_at is null returning 1`;
      held += u.length;
    }
    if (page.length < PAGE) break;
    const last = page[page.length - 1];
    after = { u: last.user_id, s: last.sell_id };
  }
  return { checked, held };
}

// The review page's flag (app/review/theses/page.tsx). Off unless REVIEW_QUEUE=1, and never in production.
// ponytail: the page stays off until real admin identity exists — then gate it on that identity, not on an env flag.
export function reviewQueueOn(env: Record<string, string | undefined> = process.env): boolean {
  return env.REVIEW_QUEUE === '1' && env.NODE_ENV !== 'production';
}
