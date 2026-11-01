// F-15 second half (docs/features/logs/F-15/plan-second-half.md, Round 2 revisions): share_action rows (E5, G2). One row
// per completed share of a trader's own record: UTC day, share class (surface), outcome (sheet or copy) and the record's
// headline sign at that moment. The record's owner only, checked here against the session user (a viewer's share of
// someone else's record is never stored: that would be a per-viewer event tying a viewer to a trader, POLICY P3, and
// F-2's opt-in log is off by default). Never a destination, recipient, thesis, account id, sell id, month, path, time of
// day, IP, agent, session or cookie. Never read by any page or by ordering (lib/f15-isolation.test.ts); the owner's
// readout (scripts/f15-readout.ts) is the only reader. The four users share columns are still written by their own
// actions (app/actions.ts) and are no longer read for measurement.
import { sql } from './db.ts';
import { tone } from './format.ts';
import { publicRecordDetail } from './connections.ts';
import { isDemoUser } from './demo.ts';

export const SHARE_SURFACES = ['card', 'story', 'trade', 'month'] as const; // = lib/referral.ts SHARE_VIAS
export type ShareSurface = (typeof SHARE_SURFACES)[number];
export const SHARE_OUTCOMES = ['sheet', 'copy'] as const;
export type ShareOutcome = (typeof SHARE_OUTCOMES)[number];
export const RECORD_SIGNS = ['up', 'down', 'flat', 'none'] as const;
export type RecordSign = (typeof RECORD_SIGNS)[number];
export const SHARE_CAP_PER_DAY = 20; // a scripted loop is bounded; G2 needs only "at least once", so no gate figure moves
export const SHARE_RETENTION_DAYS = 120; // as the view rollup, so the Privacy Policy states one number (owner may change)
// Two-int advisory lock namespace. In use: 1 USER_LOCK (lib/sync.ts), 2 ATTEMPT_LOCK (lib/connections.ts), 3 PURGE_LOCK
// (lib/discovery/purge.ts), 4 IDENTITY_LOCK (lib/claims.ts), 41 PRIVACY_PURGE_LOCK, 47 PUBLIC_IMPORT_LOCK.
export const SHARE_ACTION_LOCK = 15;

// The shared path → its handle and share class, or null. The three record routes only, anchored, after dropping the
// query (?via=…) and fragment; no trailing slash, no dot segments. The handle rule is the one handles are made with
// (lib/follows.ts HANDLE, signup and the handle form): keep the two in step.
const RECORD_PATH = /^\/u\/([a-z0-9_]{3,20})(?:\/(trade)\/[^/]+|\/(month)\/\d{4}-(?:0[1-9]|1[0-2]))?$/;
export function shareTarget(path: unknown, picture: unknown): { handle: string; surface: ShareSurface } | null {
  if (typeof path !== 'string' || path.length > 300) return null;
  const m = RECORD_PATH.exec(path.split(/[?#]/)[0]);
  if (!m || /(^|\/)\.\.?(\/|$)/.test(path)) return null;
  const kind = m[2] ?? m[3];
  if (kind) return picture === true ? null : { handle: m[1], surface: kind as 'trade' | 'month' };
  return { handle: m[1], surface: picture === true ? 'story' : 'card' };
}
export const shareOutcome = (how: unknown): ShareOutcome | null => (how === 'shared' ? 'sheet' : how === 'copied' ? 'copy' : null);

// The headline's sign as the profile shows it: the same rows its stats() reads (every closed trade of the trader), the
// average per trade at the headline's one decimal (lib/format.ts#tone); 'none' when the profile shows no headline (no
// closed trade, or an import running). A failed import still shows the headline (with the incomplete line), so it
// keeps its sign (independent review, blocking 1).
// ponytail: the state is read without the profile's clocks (lib/connections.ts#applyClocks), so an import past its
// deadline that the profile would show as failed still reads as running here until the hourly tick moves it — fix: run
// the clocks first if a share in that window ever matters.
export async function recordSign(userId: number): Promise<RecordSign> {
  const [{ n, avg }] = await sql<{ n: number; avg: number | null }[]>`select count(*)::int n, avg(return_pct)::float8 avg from closed_trades where user_id = ${userId}`;
  if (!n || avg === null) return 'none';
  const { state } = (await publicRecordDetail(userId)).public;
  if (state === 'importing') return 'none';
  return tone(avg);
}

export type ShareViewer = { id: number; handle: string } | null;
// ponytail: completion is reported by the trader's own browser (the share sheet resolved, the link copied), so a trader
// could record a share that never left the device — up to the cap; G2 rests on that report (the readout says so) — fix:
// none without reading the destination, which is never stored.
// One row for the session user's own completed share, or nothing: unknown outcome or path, another trader's record, a
// demo or deleted account, or the day's cap reached. Never throws for bad input; a database error is the caller's to log.
export async function writeShareAction(viewer: ShareViewer, path: unknown, how: unknown, picture: unknown): Promise<boolean> {
  const target = shareTarget(path, picture), outcome = shareOutcome(how);
  if (!viewer || !target || !outcome || target.handle !== viewer.handle) return false;
  // The cheap capped count first, so a loop past the cap costs one query (the locked count below is the authority).
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int n from share_action where user_id = ${viewer.id} and day = (now() at time zone 'utc')::date`;
  if (n >= SHARE_CAP_PER_DAY) return false;
  if (await isDemoUser(viewer.id)) return false;
  const sign = await recordSign(viewer.id);
  const rows = await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(${SHARE_ACTION_LOCK}, ${viewer.id})`; // count then insert, one caller per trader
    return tx`insert into share_action (user_id, day, surface, outcome, record_sign)
      select u.id, (now() at time zone 'utc')::date, ${target.surface}, ${outcome}, ${sign}
      from users u where u.id = ${viewer.id} and u.handle = ${viewer.handle} and u.deleted_at is null
        and (select count(*) from share_action s where s.user_id = u.id and s.day = (now() at time zone 'utc')::date) < ${SHARE_CAP_PER_DAY}`;
  });
  return rows.count === 1;
}
