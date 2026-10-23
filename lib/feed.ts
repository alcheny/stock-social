import { sql } from './db.ts';

// Feed ranking (DESIGN §2.6): size of move × recency. |return| means losses rank as high as equal gains.
// score = ln(1 + |r|·100) · exp(-min(age_hours / RECENCY_HOURS, MAX_DECAY))
// F-1 PR-3 fix round 4 (business lead blocker): unclamped, exp(-age/48) underflows past ~35,800 hours (4.08 years) and
// the database raises "value out of range: underflow" for the whole feed. The exponent is clamped at MAX_DECAY:
// e^-600 ≈ 2.7e-261 stays a normal double, and so does its product with the smallest non-zero size term
// (ln(1 + 2.2e-16) ≈ 2.2e-16). Closes younger than MAX_DECAY × RECENCY_HOURS (3.3 years) score exactly as before; older
// ones share the floor and keep their order by size of move. Ties break on (closed_at, id), newest first.
export const RECENCY_HOURS = 48;
export const MAX_DECAY = 600;
export const FEED_CANDIDATES = 200;

export type FeedCandidate = {
  id: number; symbol: string; return_pct: number; holding_days: number; closed_at: Date; verified: boolean;
  thesis: string | null; thesis_status: string | null; handle: string; display_name: string; user_id: number; score: number;
};

// `ids` is a test hook (rank only these traders); the feed passes none.
export async function feedCandidates(opts: { ids?: number[] } = {}): Promise<FeedCandidate[]> {
  const score = sql`ln(1 + abs(t.return_pct) * 100) * exp(-least(extract(epoch from now() - t.closed_at) / 3600 / ${RECENCY_HOURS}::float8, ${MAX_DECAY}::float8))`;
  return (await sql`
    select t.id, t.symbol, t.return_pct, t.holding_days, t.closed_at, t.verified, t.thesis, t.thesis_status,
           u.handle, u.display_name, u.id as user_id, ${score} as score
    from closed_trades t join users u on u.id = t.user_id and u.deleted_at is null
    where t.user_id in (select user_id from closed_trades group by user_id having count(*) >= 5)
      ${opts.ids ? sql`and t.user_id in ${sql(opts.ids.length ? opts.ids : [0])}` : sql``}
      -- F-1 fix round 3 (TR-3): a record with an import still running is not in the feed until it is whole.
      and not exists (select 1 from connections c where c.user_id = t.user_id and c.state = 'importing' and c.consent_at is not null)
    order by score desc, t.closed_at desc, t.id desc
    limit ${FEED_CANDIDATES}`) as unknown as FeedCandidate[];
}
