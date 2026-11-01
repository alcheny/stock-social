// Handle and display-name integrity (fix committee 2026-11-01, decisions 7, 8, 11; D-08, C9 overlap).
// A rejection names its rule (C9): taken, reserved, looks like another handle, or format.
import type { TransactionSql } from 'postgres';
import { sql } from './db.ts';
import { normalizeHandle } from './referral.ts';
import { leet, sanitizeUserText, skeleton, squash } from './text-safety.ts';

// A deleted or renamed handle stays unavailable to others for a year (lib/delete.ts re-exports this).
export const HANDLE_RESERVED_DAYS = 365;

export type HandleVerdict = 'ok' | 'taken' | 'reserved' | 'lookalike' | 'format';

// The product's own, staff, generic and route words, plus the integrated vendor's name. No third-party names.
export const RESERVED: readonly string[] = [
  'admin', 'administrator', 'support', 'help', 'helpdesk', 'moderator', 'mod', 'mods', 'staff', 'team', 'official',
  'verified', 'demo', 'root', 'system', 'api', 'security', 'legal', 'press', 'privacy', 'terms', 'abuse', 'report',
  'stocksocial', 'stock_social', 'snaptrade',
  // routes
  'me', 'how', 'login', 'settings', 'connect', 't', 'u', 'review',
];
// Refused anywhere inside a handle (compared on the handle skeleton with underscores removed).
export const RESERVED_SUBSTRINGS: readonly string[] = ['verified', 'official', 'stocksocial'];

// Handle skeleton: lower case, rn→m, 0→o, 1→l, in this order. HSKEL_SQL is the same expression in SQL; the
// users_handle_skel index (db/schema.sql) is built on it, and lib/handles.db.test.ts proves the two agree.
// ponytail: the map is decision 7's (rn, 0, 1→l) — 1 read as i ("adm1n") or 5 as s is not caught; extend hskel, HSKEL_SQL
// and the index together if such handles show up.
export const hskel = (h: string): string => h.toLowerCase().replaceAll('rn', 'm').replaceAll('0', 'o').replaceAll('1', 'l');
export const HSKEL_SQL = (col: string) => `replace(replace(replace(lower(${col}), 'rn', 'm'), '0', 'o'), '1', 'l')`;
// A trailing run of digits or underscores, removed before comparing with the reserved list and the demo handles only,
// so "momentum_maya1" is refused while "trader_2024" stays free.
export const stripTail = (h: string): string => h.replace(/[0-9_]+$/, '');

export type HandleContext = {
  // Other accounts' handles and active reservations not held by this account, that equal the handle or share its
  // skeleton (checkHandle fetches exactly these; extra rows are harmless).
  others: readonly string[];
  // Demo profiles' handles (any source='demo' activity).
  demo: readonly string[];
  // A random provisional trader_* handle: only taken and reserved apply.
  provisional?: boolean;
};

function isReserved(h: string, provisional: boolean): boolean {
  if (RESERVED.includes(h)) return true;
  const flat = hskel(h).replaceAll('_', '');
  if (RESERVED_SUBSTRINGS.some((w) => flat.includes(w))) return true;
  if (provisional) return false;
  const k = hskel(h), kt = hskel(stripTail(h));
  return RESERVED.some((r) => hskel(r) === k || (kt.length > 0 && hskel(stripTail(r)) === kt));
}

// Pure verdict for an already-fetched context.
export function handleVerdict(raw: unknown, ctx: HandleContext): HandleVerdict {
  const h = normalizeHandle(raw);
  if (!h) return 'format';
  const provisional = !!ctx.provisional;
  if (isReserved(h, provisional)) return 'reserved';
  if (ctx.others.includes(h)) return 'taken';
  if (provisional) return 'ok';
  const k = hskel(h), kt = hskel(stripTail(h));
  if (ctx.others.some((o) => hskel(o) === k)) return 'lookalike';
  if (kt.length > 0 && ctx.demo.some((d) => d !== h && hskel(stripTail(d)) === kt)) return 'lookalike';
  return 'ok';
}

type Db = TransactionSql | typeof sql;

// DB verdict. A reservation held by selfUserId (its own old handle) counts as free: the trader can take it back.
export async function checkHandle(handle: unknown, selfUserId?: number | null, opts: { provisional?: boolean; db?: Db } = {}): Promise<HandleVerdict> {
  const h = normalizeHandle(handle);
  if (!h) return 'format';
  const db = opts.db ?? sql;
  const self = selfUserId ?? null;
  const k = hskel(h);
  // The skeleton expression is spelt out (not interpolated) so it matches the users_handle_skel index exactly.
  const rows = await db`
    select handle from users where (${self}::int is null or id <> ${self}::int)
      and (handle = ${h} or replace(replace(replace(lower(handle), 'rn', 'm'), '0', 'o'), '1', 'l') = ${k})
    union
    select handle from handle_reservations where until > now() and (${self}::int is null or user_id is distinct from ${self}::int)
      and (handle = ${h} or replace(replace(replace(lower(handle), 'rn', 'm'), '0', 'o'), '1', 'l') = ${k})`;
  const demo = opts.provisional ? [] : await db`select handle from users where id in (select user_id from activities where source = 'demo')`;
  return handleVerdict(h, { others: rows.map((r) => r.handle as string), demo: demo.map((r) => r.handle as string), provisional: opts.provisional });
}

// ---- Display names (decision 11) ----

export const DISPLAY_NAME_MAX = 40;
const CHECK_GLYPHS = /[✓✔☑✅√\u{1F5F8}\u{1F5F9}\u{2BBD}\u{1F197}]/u;
const NAME_WORDS: [RegExp, string][] = [
  [/verified|official/, 'Display names can’t say verified or official.'],
  [/stock\s?social|snaptrade/, 'Display names can’t use the product’s or the broker connection’s name.'],
];
const graphemes = (s: string) => Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s), (g) => g.segment);

// Cleans the name (lib/text-safety.ts) and checks it. Returns the cleaned name or the reason it is refused.
export function checkDisplayName(raw: unknown): { ok: true; name: string } | { ok: false; reason: string } {
  const name = sanitizeUserText(String(raw ?? '').replace(/\n/g, ' '), 400).replace(/\n/g, ' ');
  if (!/[\p{L}\p{N}]/u.test(name)) return { ok: false, reason: 'Display names need at least one letter or number.' };
  if (Array.from(name).length > DISPLAY_NAME_MAX) return { ok: false, reason: `Display names can be at most ${DISPLAY_NAME_MAX} characters.` };
  if (CHECK_GLYPHS.test(name.normalize('NFKC'))) return { ok: false, reason: 'Display names can’t include check marks.' };
  if (graphemes(name).filter((g) => /\p{Extended_Pictographic}/u.test(g)).length > 2) return { ok: false, reason: 'Display names can have at most 2 emoji.' };
  const sk = skeleton(name);
  const forms = [sk, ...leet(sk)].flatMap((f) => [f, squash(f), f.replace(/[^\p{L}\p{N}\s]/gu, '')]);
  for (const [re, reason] of NAME_WORDS) if (forms.some((f) => re.test(f))) return { ok: false, reason };
  return { ok: true, name };
}

// Start-up re-check: a stored display name that now fails falls back to the handle. Returns the count; never logs
// names. Called once per deploy (scripts/db-setup.ts is owned by another session; wired there).
// ponytail: reads every typed display name in one query — page by id once there are more than ~100k accounts.
// `userIds` limits the pass (tests on a shared database).
export async function recheckDisplayNames(opts: { userIds?: number[]; db?: typeof sql } = {}): Promise<number> {
  const db = opts.db ?? sql;
  const rows = await db`select id, handle, display_name from users where display_name <> handle
    ${opts.userIds ? db`and id = any(${opts.userIds})` : db``}`;
  const bad = rows.filter((r) => { const c = checkDisplayName(r.display_name); return !c.ok || c.name !== r.display_name; });
  let n = 0;
  for (const r of bad) {
    const c = checkDisplayName(r.display_name);
    const next = c.ok ? c.name : (r.handle as string);
    const res = await db`update users set display_name = ${next} where id = ${r.id} and display_name = ${r.display_name as string}`;
    n += res.count;
  }
  return n;
}
