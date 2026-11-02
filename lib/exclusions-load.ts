// F-21: the exclusion counters for many records in one statement (committee decision 9: exactly one new query per page
// or route). Stored columns only (users, public_filers.excluded); the option part comes from the OptionHeadline each
// surface already reads (lib/options-load.ts#optionHeadline), so the gate state travels with the counts.
import { sql } from './db.ts';
import type { OptionHeadline } from './options-view.ts';
import { lineCount, type ExclusionInput, type ShareCounts } from './exclusions.ts';

export type StoredExclusions = ShareCounts & { public: Record<string, number> | null };
const ZERO: StoredExclusions = { excluded_positions: 0, excluded_future_sells: 0, excluded_corporate: 0, excluded_held: 0, excluded_shared: 0, excluded_transfer: 0, public: null };

/** The users counters behind the sum (the SQL select list every reader shares). */
export const SHARE_COLUMNS = ['excluded_positions', 'excluded_future_sells', 'excluded_corporate', 'excluded_held', 'excluded_shared', 'excluded_transfer'] as const;
export const fromRow = (r: Record<string, unknown> | undefined, pub?: Record<string, number> | null): StoredExclusions => !r ? ZERO : {
  excluded_positions: Number(r.excluded_positions) || 0, excluded_future_sells: Number(r.excluded_future_sells) || 0,
  excluded_corporate: Number(r.excluded_corporate) || 0, excluded_held: Number(r.excluded_held) || 0, excluded_shared: Number(r.excluded_shared) || 0,
  excluded_transfer: Number(r.excluded_transfer) || 0,
  public: pub ?? (r.public_excluded as Record<string, number> | null) ?? null,
};

export async function storedExclusions(userIds: number[]): Promise<Map<number, StoredExclusions>> {
  const ids = [...new Set(userIds)];
  if (!ids.length) return new Map();
  const rows = await sql`select u.id, u.excluded_positions, u.excluded_future_sells, u.excluded_corporate, u.excluded_held, u.excluded_shared, u.excluded_transfer,
      pf.excluded as public_excluded
    from users u left join public_filers pf on pf.id = u.public_filer_id where u.id in ${sql(ids)}`;
  return new Map(rows.map((r) => [r.id as number, fromRow(r)]));
}

export const exclusionInput = (s: StoredExclusions | undefined, h: OptionHeadline): ExclusionInput => ({ ...(s ?? ZERO), options: h.counts, gate: h.gate });

/** The line's count per trader (0 while importing). */
export function exclusionLines(stored: Map<number, StoredExclusions>, heads: Map<number, OptionHeadline>, states: Map<number, { state: string } | undefined>): Map<number, number> {
  const out = new Map<number, number>();
  for (const [id, h] of heads) out.set(id, lineCount(exclusionInput(stored.get(id), h), states.get(id)?.state ?? 'connected'));
  return out;
}
