// F-7 launch switch (plan.md §2 item 5, Round 4 item 6; legal C19), env read at call time. PUBLIC_TRADERS=0 off; =1 on (in
// production only with PUBLIC_FILINGS_CONTACT and PUBLIC_RECORDS_CONTACT); unset: on outside production and in the e2e
// sandbox. The importer reaches a non-loopback base only with an explicit =1 and the contact (no real filer in dev/CI).
import { sql } from './db.ts';
import { isSandbox } from './launch-gate.ts';
import { isLoopbackUrl, type Env } from './vendor-env.ts';
export const PUBLIC_SOURCES = ['insider_reports'] as const;
export type PublicSource = (typeof PUBLIC_SOURCES)[number];
export const PUBLIC_FEED_DELAY_DAYS = 30; // feed, similar and suggest: this long after the latest filing behind a trade
export const PUBLIC_STALE_DAYS = 7; // "may be out of date" after this long without a successful import
export const PLACEHOLDER_ATTESTED_AT = new Date(0); // filer rows' NOT NULL attestation: a placeholder, not an attestation
export const FILER_HANDLE_PREFIX = 'pf_'; // nobody can sign up or rename into it
const set = (v: string | undefined) => !!v && v.trim().length > 0;

export function publicTradersOn(env: Env = process.env): boolean {
  if (env.PUBLIC_TRADERS === '0') return false;
  if (env.PUBLIC_TRADERS === '1') return env.NODE_ENV !== 'production' || (set(env.PUBLIC_FILINGS_CONTACT) && set(env.PUBLIC_RECORDS_CONTACT));
  return env.NODE_ENV !== 'production' || isSandbox(env);
}
export const importerBaseAllowed = (base: string, env: Env = process.env) =>
  publicTradersOn(env) && (isLoopbackUrl(base) || (env.PUBLIC_TRADERS === '1' && set(env.PUBLIC_FILINGS_CONTACT)));
// Only the sources this release knows; anything else listed is ignored.
export function publicSources(env: Env = process.env): PublicSource[] {
  const want = (env.PUBLIC_SOURCES ?? 'insider_reports').split(',').map((s) => s.trim());
  return PUBLIC_SOURCES.filter((s) => want.includes(s));
}
export const isFilerHandle = (handle: string) => handle.startsWith(FILER_HANDLE_PREFIX);
// SQL: users row `u` may be shown (switch off: no filer; on: not a hidden or removed one). Other users unaffected.
export function filerVisibleSql(alias = 'u', env: Env = process.env) {
  const col = sql(`${alias}.public_filer_id`);
  if (!publicTradersOn(env)) return sql`${col} is null`;
  return sql`(${col} is null or exists (select 1 from public_filers pf where pf.id = ${col} and pf.hidden_at is null and pf.removed_at is null))`;
}
// SQL: closed trade `t` may appear on a feed-side surface (feed, similar, suggest, sections).
export const feedReadySql = (alias = 't') => sql`(${sql(`${alias}.feed_after`)} is null or ${sql(`${alias}.feed_after`)} <= now())`;
export type FilerInfo = { filerId: number; demo: boolean; hidden: boolean; removed: boolean; lastChecked: Date | null; excluded: Record<string, number>; openSymbols: string[] };
// The filer behind a users row, or null for a broker or demo user.
export async function filerInfo(userId: number): Promise<FilerInfo | null> {
  const [r] = await sql`select pf.id, pf.demo, pf.hidden_at, pf.removed_at, pf.excluded, pf.open_symbols, s.last_success_at
    from users u join public_filers pf on pf.id = u.public_filer_id left join public_import_state s on s.source = pf.source
    where u.id = ${userId}`;
  if (!r) return null;
  return { filerId: r.id, demo: r.demo, hidden: !!r.hidden_at, removed: !!r.removed_at, lastChecked: r.last_success_at ?? null, excluded: r.excluded ?? {}, openSymbols: r.open_symbols ?? [] };
}
export const filerVisible = (f: FilerInfo | null, env: Env = process.env) => !f || (publicTradersOn(env) && !f.hidden && !f.removed);
