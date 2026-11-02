// F-16 (docs/features/F-16-trust-and-safety-slice.md; plan docs/features/logs/F-16-F-17/plan.md §5.6): the owner's
// trust-and-safety digest, read in the owner's terminal (scripts/trust-digest.ts). No page, no route, no session, no
// email: nothing here sends anything, and nothing logs. It reads reports, held and hidden theses, hidden profiles and
// the sync shards' last tick; its only write is the owner's resolution of a profile report (resolved_at, resolution).
// Open profile reports come first by category, "May be under 18" always first (K18), even at 0.
// ponytail: an owner-run CLI is the only admin identity — move to an admin page once real admin identity exists.
import { sql } from './db.ts';
import { HIDDEN_RULE, REPORT_CATEGORIES, type ReportCategory } from './report-copy.ts';
import { RESOLUTIONS, isResolution, type Resolution } from './reports.ts';
export { RESOLUTIONS, isResolution, type Resolution };

export const UNDER_18 = 'may-be-under-18' satisfies ReportCategory;
// Category order in the digest: under-18 first, then the form's order.
export const DIGEST_ORDER: readonly ReportCategory[] = [UNDER_18, ...REPORT_CATEGORIES.map((c) => c.code).filter((c) => c !== UNDER_18)];
// ponytail: each category lists at most PROFILES_PER_CATEGORY profiles (most reported first; the count line is
// complete) — add a `from` cursor if a category ever outgrows it.
export const PROFILES_PER_CATEGORY = 50;
// A reporter whose profile reports the owner found unfounded this many times is listed for the owner (never acted on
// automatically: the owner decides).
export const REPEAT_UNFOUNDED_AT = 2;

export type DigestGroup = { category: ReportCategory; label: string; reports: number; profileCount: number; profiles: { handle: string; reports: number }[] };
export type Digest = {
  open: number; openProfiles: number; groups: DigestGroup[];
  held: number; hiddenProfiles: number; hiddenTheses: number; repeatUnfounded: number;
  lastTick: Date | null; stoppedAtDeadline: boolean;
};

/** Read the digest. `only` limits the per-user counts to some user ids (tests on the shared database); the sync tick is global. */
export async function digest(only?: number[]): Promise<Digest> {
  const scope = (col: string) => (only ? sql`and ${sql(col)} = any(${only})` : sql``);
  const rows = await sql`select r.category, u.handle, count(*)::int as n from thesis_reports r
    join users u on u.id = r.trader_id and u.deleted_at is null
    where r.target = 'profile' and r.resolved_at is null ${scope('r.trader_id')}
    group by r.category, u.handle order by n desc, u.handle`;
  const groups: DigestGroup[] = DIGEST_ORDER.map((code) => {
    const mine = rows.filter((r) => r.category === code);
    return {
      category: code, label: REPORT_CATEGORIES.find((c) => c.code === code)!.label,
      reports: mine.reduce((a, r) => a + (r.n as number), 0), profileCount: mine.length,
      profiles: mine.slice(0, PROFILES_PER_CATEGORY).map((r) => ({ handle: r.handle as string, reports: r.n as number })),
    };
  });
  const [c] = await sql`select
      (select count(*)::int from closed_trades t where t.thesis_status = 'held' and t.thesis is not null
        and t.thesis_hold_rule is distinct from ${HIDDEN_RULE} ${scope('t.user_id')}) as held, -- fix round 1: a hidden note counts once, under hidden
      (select count(*)::int from users u where u.hidden_at is not null and u.deleted_at is null ${scope('u.id')}) as hidden_profiles,
      (select count(*)::int from closed_trades t where t.thesis_hold_rule = ${HIDDEN_RULE} and t.thesis is not null ${scope('t.user_id')}) as hidden_theses,
      (select count(distinct r.trader_id)::int from thesis_reports r join users u on u.id = r.trader_id and u.deleted_at is null
        where r.target = 'profile' and r.resolved_at is null ${scope('r.trader_id')}) as open_profiles,
      (select max(heartbeat_at) from sync_shards) as last_tick,
      (select coalesce(bool_or((last_run->>'stoppedAtDeadline')::boolean), false) from sync_shards) as stopped`;
  return {
    open: groups.reduce((a, g) => a + g.reports, 0), openProfiles: c.open_profiles, groups,
    held: c.held, hiddenProfiles: c.hidden_profiles, hiddenTheses: c.hidden_theses,
    repeatUnfounded: (await repeatUnfounded(only)).length,
    lastTick: c.last_tick ?? null, stoppedAtDeadline: c.stopped === true,
  };
}

/** The owner's terminal lines: counts and links (handles only; never a reporter, a thesis or a figure). */
export function formatDigest(d: Digest, site: string, now = new Date()): string[] {
  const out = [`Open profile reports: ${d.open} on ${d.openProfiles} ${d.openProfiles === 1 ? 'profile' : 'profiles'}`];
  for (const g of d.groups) {
    const links = g.profiles.map((p) => `${site}/u/${p.handle} (${p.reports})`).join(', ');
    const more = g.profileCount > g.profiles.length ? ` (first ${g.profiles.length} of ${g.profileCount} shown)` : '';
    out.push(`  ${g.label}: ${g.reports}${links ? ` — ${links}` : ''}${more}`);
  }
  out.push(`Held theses: ${d.held} (scripts/review-theses.ts list)`);
  out.push(`Hidden: ${d.hiddenProfiles} ${d.hiddenProfiles === 1 ? 'profile' : 'profiles'}, ${d.hiddenTheses} ${d.hiddenTheses === 1 ? 'thesis' : 'theses'} (scripts/hide.ts history <user_id>)`);
  out.push(`Reporters with ${REPEAT_UNFOUNDED_AT} or more unfounded reports: ${d.repeatUnfounded} (scripts/trust-digest.ts reporters)`);
  const age = d.lastTick ? ` (${((now.getTime() - d.lastTick.getTime()) / 3_600_000).toFixed(1)} h ago)` : '';
  out.push(`Last sync tick: ${d.lastTick ? d.lastTick.toISOString() : 'none'}${age}; stopped at deadline: ${d.stoppedAtDeadline ? 'yes' : 'no'}`);
  return out;
}

/**
 * The only text a future notification may carry (plan §5.6, F-16 AC "templates carry no handle, name, thesis, symbol or
 * return"): counts and a fixed instruction. No sender exists; if the owner ever chooses one, it sends this and nothing
 * else (lib/f16-digest.db.test.ts pins that no handle, name, thesis, symbol or return reaches it).
 */
export function digestNotice(d: Digest): string {
  const under18 = d.groups.find((g) => g.category === UNDER_18)?.reports ?? 0;
  return `Trust and safety: ${d.open} open profile reports (${under18} may be under 18), ${d.held} held theses, `
    + `${d.hiddenProfiles + d.hiddenTheses} hidden items. Run scripts/trust-digest.ts for details.`;
}

/** One trader's open and resolved profile reports for the owner: category, time, resolution (reporter ids for resolve). */
export async function reportsOn(traderId: number) {
  const rows = await sql`select reporter_id, category, created_at, resolved_at, resolution from thesis_reports
    where trader_id = ${traderId} and target = 'profile' order by created_at, reporter_id`;
  return rows.map((r) => ({ reporterId: r.reporter_id as number, category: r.category as string, at: r.created_at as Date, resolvedAt: (r.resolved_at ?? null) as Date | null, resolution: (r.resolution ?? null) as Resolution | null }));
}

/** The owner resolves one profile report: true when an open one was resolved. Changes nothing else (no hide). */
export async function resolveReport(reporterId: number, traderId: number, resolution: Resolution): Promise<boolean> {
  if (!isResolution(resolution) || !Number.isInteger(reporterId) || !Number.isInteger(traderId)) return false;
  const r = await sql`update thesis_reports set resolved_at = now(), resolution = ${resolution}
    where reporter_id = ${reporterId} and trader_id = ${traderId} and sell_id = '' and target = 'profile' and resolved_at is null returning 1`;
  return r.length === 1;
}

/** Reporter ids with REPEAT_UNFOUNDED_AT or more unfounded profile reports (the owner's terminal only). */
export async function repeatUnfounded(only?: number[]): Promise<{ reporterId: number; unfounded: number }[]> {
  const rows = await sql`select reporter_id, count(*)::int as n from thesis_reports
    where target = 'profile' and resolution = 'unfounded' ${only ? sql`and reporter_id = any(${only})` : sql``}
    group by reporter_id having count(*) >= ${REPEAT_UNFOUNDED_AT} order by n desc, reporter_id`;
  return rows.map((r) => ({ reporterId: r.reporter_id as number, unfounded: r.n as number }));
}
