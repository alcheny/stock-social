// F-7 launch switch for public-record traders (docs/features/logs/F-7/plan.md §2 item 5, Round 4 item 6; legal C19).
// Pure and env-driven; env is read at call time.
//
//   PUBLIC_TRADERS=0   off everywhere.
//   PUBLIC_TRADERS=1   on; in production only when PUBLIC_FILINGS_CONTACT and PUBLIC_RECORDS_CONTACT are both set.
//   unset              on outside production and in the e2e sandbox (lib/launch-gate.ts#isSandbox), off in production.
//
// The importer may reach the official filing system only with an explicit PUBLIC_TRADERS=1 and the contact; otherwise
// it reaches a loopback base URL only, so no real filer enters a dev, test or CI database.
import { sql } from './db.ts';
import { isSandbox } from './launch-gate.ts';
import { isLoopbackUrl, type Env } from './vendor-env.ts';

export const PUBLIC_SOURCES = ['insider_reports'] as const;
export type PublicSource = (typeof PUBLIC_SOURCES)[number];
/** Nothing from a filing reaches the feed, similar or suggest until this long after the latest filing behind it. */
export const PUBLIC_FEED_DELAY_DAYS = 30;
/** "This record may be out of date" once the source has had no successful import for this long. */
export const PUBLIC_STALE_DAYS = 7;
/** Placeholder on filer rows' NOT NULL attestation column: not an attestation (db/schema.sql F-7 block). */
export const PLACEHOLDER_ATTESTED_AT = new Date(0);
/** Filer handles: nobody can sign up or rename into this prefix. */
export const FILER_HANDLE_PREFIX = 'pf_';

const set = (v: string | undefined) => !!v && v.trim().length > 0;

export function publicTradersOn(env: Env = process.env): boolean {
  const v = env.PUBLIC_TRADERS;
  if (v === '0') return false;
  if (v === '1') return env.NODE_ENV !== 'production' || (set(env.PUBLIC_FILINGS_CONTACT) && set(env.PUBLIC_RECORDS_CONTACT));
  return env.NODE_ENV !== 'production' || isSandbox(env);
}

/** Whether the importer may call this base URL under the current switch. */
export function importerBaseAllowed(base: string, env: Env = process.env): boolean {
  if (!publicTradersOn(env)) return false;
  if (isLoopbackUrl(base)) return true;
  return env.PUBLIC_TRADERS === '1' && set(env.PUBLIC_FILINGS_CONTACT);
}

/** Enabled sources: only the ones this release knows; anything else listed is ignored. */
export function publicSources(env: Env = process.env): PublicSource[] {
  const want = (env.PUBLIC_SOURCES ?? 'insider_reports').split(',').map((s) => s.trim());
  return PUBLIC_SOURCES.filter((s) => want.includes(s));
}

export const isFilerHandle = (handle: string) => handle.startsWith(FILER_HANDLE_PREFIX);

/**
 * SQL condition: the users row `u` may be shown. With the switch off no filer is shown; with it on, a hidden or
 * removed filer is not. Broker and demo users are unaffected.
 */
export function filerVisibleSql(alias = 'u', env: Env = process.env) {
  const col = sql(`${alias}.public_filer_id`);
  if (!publicTradersOn(env)) return sql`${col} is null`;
  return sql`(${col} is null or exists (select 1 from public_filers pf where pf.id = ${col} and pf.hidden_at is null and pf.removed_at is null))`;
}

/** SQL condition: the closed trade `t` may appear on a feed-side surface (feed, similar, suggest, sections). */
export function feedReadySql(alias = 't') {
  return sql`(${sql(`${alias}.feed_after`)} is null or ${sql(`${alias}.feed_after`)} <= now())`;
}

export type FilerInfo = { filerId: number; demo: boolean; hidden: boolean; removed: boolean; lastChecked: Date | null; excluded: Record<string, number>; openSymbols: string[] };

/** The filer behind a users row, or null for a broker or demo user. */
export async function filerInfo(userId: number): Promise<FilerInfo | null> {
  const [r] = await sql`select pf.id, pf.demo, pf.hidden_at, pf.removed_at, pf.excluded, pf.open_symbols, s.last_success_at
    from users u join public_filers pf on pf.id = u.public_filer_id left join public_import_state s on s.source = pf.source
    where u.id = ${userId}`;
  if (!r) return null;
  return { filerId: r.id, demo: r.demo, hidden: !!r.hidden_at, removed: !!r.removed_at, lastChecked: r.last_success_at ?? null, excluded: r.excluded ?? {}, openSymbols: r.open_symbols ?? [] };
}

/** Whether a filer's record may be shown now (switch on, not hidden or removed). Non-filers: always true. */
export function filerVisible(f: FilerInfo | null, env: Env = process.env): boolean {
  return !f || (publicTradersOn(env) && !f.hidden && !f.removed);
}
