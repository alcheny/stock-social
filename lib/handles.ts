// Handle and display-name integrity (fix committee 2026-11-01, decisions 7, 8, 11; D-08, C9 overlap).
// A rejection names its rule (C9): taken, reserved, looks like another handle, or format.
import type { TransactionSql } from 'postgres';
import { sql } from './db.ts';
import { normalizeHandle } from './referral.ts';
import { leet, sanitizeUserText, skeleton, squash } from './text-safety.ts';
import { LAUNCH, SIGNIN } from './copy.ts';

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
// Refused anywhere inside a handle (compared on the handle skeleton with underscores removed, in both readings of 1).
// Fix round 1: the vendor's name too ("snap_trade_fan" would otherwise pass here and fail as a display name).
export const RESERVED_SUBSTRINGS: readonly string[] = ['verified', 'official', 'stocksocial', 'snaptrade'];
// Fix round 1: staff and product words that are also refused as a plural or behind "the" ("admins", "the_admin",
// "the_support_team" is not one: only the word itself). Route and generic words ("me", "help", "press", "terms") are
// left out on purpose, so "theme", "helps" or "the_press_box" stay free.
export const STAFF_WORDS: readonly string[] = ['admin', 'administrator', 'support', 'helpdesk', 'moderator', 'mod', 'staff',
  'team', 'official', 'verified', 'security', 'abuse', 'system', 'stocksocial', 'snaptrade'];

// Handle skeleton: lower case, rn→m, 0→o, 1→l, in this order. HSKEL_SQL is the same expression in SQL; the
// users_handle_skel index (db/schema.sql) is built on it, and lib/handles.db.test.ts proves the two agree.
// Fix round 1: against the reserved words and the demo handles, 1 is also read as i ("adm1n", "ver1fied") and
// underscores are ignored ("a_d_m_i_n", "momentum__maya"); a doubled last letter matches a demo handle too
// ("momentum_mayaa").
// ponytail: other users' handles are compared on hskel only (1→l, underscores kept) — "ca1m_trader" is caught but
// "calm__trader" or "d1vidend" next to an ordinary handle is not; add a second skeleton index (underscores removed, 1→i)
// and query it in checkHandle if such handles show up.
export const hskel = (h: string): string => h.toLowerCase().replaceAll('rn', 'm').replaceAll('0', 'o').replaceAll('1', 'l');
export const HSKEL_SQL = (col: string) => `replace(replace(replace(lower(${col}), 'rn', 'm'), '0', 'o'), '1', 'l')`;
// A trailing run of digits or underscores, removed before comparing with the reserved list and the demo handles only,
// so "momentum_maya1" is refused while "trader_2024" stays free.
export const stripTail = (h: string): string => h.replace(/[0-9_]+$/, '');
// Both readings of a handle (1→l and 1→i), underscores removed.
const flatReadings = (h: string): string[] => [...new Set([hskel(h), hskel(h.replaceAll('1', 'i'))])].map((k) => k.replaceAll('_', ''));
const RESERVED_FLAT = new Set(RESERVED.map((r) => r.replaceAll('_', '')));
const STAFF = new Set(STAFF_WORDS);
const staffForm = (f: string, staff: ReadonlySet<string> = STAFF): boolean => {
  const bare = f.replace(/^the(?=.)/, '');
  return [f, bare].some((v) => staff.has(v) || (v.endsWith('s') && staff.has(v.slice(0, -1))));
};
// Serializes look-alike handle claims (changeHandle, createUserForAttempt): two transactions after the same skeleton
// take turns, so they can't both pass the check before either commits.
export async function lockHandleSkeleton(tx: TransactionSql, handle: string): Promise<void> {
  await tx`select pg_advisory_xact_lock(hashtext(${`handle:${hskel(handle)}`}))`;
}

export type HandleContext = {
  // Other accounts' handles and active reservations not held by this account, that equal the handle or share its
  // skeleton (checkHandle fetches exactly these; extra rows are harmless).
  others: readonly string[];
  // Demo profiles' handles (any source='demo' activity).
  demo: readonly string[];
  // Fix round 1: the subset of `others` that are active reservations (an exact match is 'reserved', not 'taken').
  reservations?: readonly string[];
  // A random provisional trader_* handle: only taken and reserved apply.
  provisional?: boolean;
};

// Every reading a reserved-word check uses: both readings of 1, and the leet forms (3→e, 4→a, 5→s, 7→t ...) the
// display-name rules use too, so a handle the rules accept is always an acceptable display name (the dev sign-in
// falls back to it).
const allReadings = (h: string): string[] => [...new Set([h, ...leet(h)].flatMap(flatReadings))];
// Fix round 2 (G): l and i read alike in the reserved comparisons ("admln", "verlfied", "offlcial"): both the handle's
// readings and the reserved words are compared with every l turned into i.
const il = (f: string) => f.replaceAll('l', 'i');
const RESERVED_FLAT_IL = new Set([...RESERVED.map((r) => il(r.replaceAll('_', '')))]);
const SUBSTRINGS_IL = RESERVED_SUBSTRINGS.map(il);
const STAFF_IL = new Set(STAFF_WORDS.map(il));

function isReserved(h: string, provisional: boolean): boolean {
  if (RESERVED.includes(h)) return true;
  if (allReadings(h).some((f) => RESERVED_SUBSTRINGS.some((w) => f.includes(w)) || SUBSTRINGS_IL.some((w) => il(f).includes(w)))) return true;
  if (provisional) return false;
  const forms = [...allReadings(h), ...allReadings(stripTail(h))].filter((f) => f.length > 0);
  return forms.some((f) => RESERVED_FLAT.has(f) || staffForm(f) || roleOnly(f) || RESERVED_FLAT_IL.has(il(f)) || staffForm(il(f), STAFF_IL));
}

// A demo handle's look-alike: same flat reading, or the same with a doubled last letter.
// Fix round 2 (G): also with any doubled letter collapsed ("momentumm_maya", "mommentum_maya") and with a digit read as
// a letter ("swing_5am" next to "swing_sam", "d1v1dend_dan"), both sides compared the same way.
const collapse = (f: string) => f.replace(/(.)\1+/g, '$1');
const demoForms = (h: string): string[] => {
  const t = stripTail(h);
  return [...new Set([t, ...leet(t)].flatMap(flatReadings).flatMap((f) => [f, collapse(f)]))].filter((f) => f.length > 0);
};
function demoLookalike(h: string, demo: readonly string[]): boolean {
  const mine = flatReadings(stripTail(h)).flatMap((f) => (/(.)\1$/.test(f) ? [f, f.slice(0, -1)] : [f])).filter((f) => f.length > 0);
  const wide = new Set([...mine, ...demoForms(h)]);
  return demo.some((d) => d !== h && (flatReadings(stripTail(d)).some((f) => mine.includes(f)) || demoForms(d).some((f) => wide.has(f))));
}

// Pure verdict for an already-fetched context.
export function handleVerdict(raw: unknown, ctx: HandleContext): HandleVerdict {
  const h = normalizeHandle(raw);
  if (!h) return 'format';
  const provisional = !!ctx.provisional;
  if (isReserved(h, provisional)) return 'reserved';
  if (ctx.reservations?.includes(h)) return 'reserved';
  if (ctx.others.includes(h)) return 'taken';
  if (provisional) return 'ok';
  const k = hskel(h);
  if (ctx.others.some((o) => hskel(o) === k)) return 'lookalike';
  if (demoLookalike(h, ctx.demo)) return 'lookalike';
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
    select handle, false as resv from users where (${self}::int is null or id <> ${self}::int)
      and (handle = ${h} or replace(replace(replace(lower(handle), 'rn', 'm'), '0', 'o'), '1', 'l') = ${k})
    union
    select handle, true from handle_reservations where until > now() and (${self}::int is null or user_id is distinct from ${self}::int)
      and (handle = ${h} or replace(replace(replace(lower(handle), 'rn', 'm'), '0', 'o'), '1', 'l') = ${k})`;
  const demo = opts.provisional ? [] : await db`select handle from users where id in (select user_id from activities where source = 'demo')`;
  return handleVerdict(h, {
    others: rows.map((r) => r.handle as string), reservations: rows.filter((r) => r.resv).map((r) => r.handle as string),
    demo: demo.map((r) => r.handle as string), provisional: opts.provisional,
  });
}

// ---- Display names (decision 11) ----

export const DISPLAY_NAME_MAX = 40;
// Fix round 1: check-like letters and signs too (Lisu ꓦ, ⩗ ⩘, ⍻, the Aegean check mark).
const CHECK_GLYPHS = /[✓✔☑✅√\u{1F5F8}\u{1F5F9}\u{2BBD}\u{1F197}\uA4E6\u2A57\u2A58\u237B\u{10102}]/u;
// Why a name is refused, by code (app/login/dev shows the reason from the code; the URL never carries the name).
export const NAME_REASON = {
  letter: 'Display names need at least one letter or number.',
  long: `Display names can be at most ${DISPLAY_NAME_MAX} characters.`,
  check: 'Display names can’t include check marks.',
  emoji: 'Display names can have at most 2 emoji.',
  verified: 'Display names can’t say verified or official.',
  brand: 'Display names can’t use the product’s or the broker connection’s name.',
  role: 'Display names can’t be only a staff or team word.',
} as const;
export type NameReasonCode = keyof typeof NAME_REASON;
// Fix round 2 (G): common misspellings too ("Verifled", "Verfied", "Offical", "Oficial"), on the skeleton and leet forms.
const NAME_WORDS: [RegExp, NameReasonCode][] = [
  [/verified|official|ver+[il1]?f[il1y]+e?d|of+[il1]c+[il1]?a[l1]/, 'verified'],
  [/stock\s?social|snaptrade/, 'brand'],
];
// Fix round 1: a name that is only a staff or role word ("Admin", "Support Team", "The Moderators"), compared on its
// letters and digits alone, in every look-alike reading.
const ROLE_NAMES = new Set(['admin', 'administrator', 'adminteam', 'support', 'supportteam', 'supportdesk', 'customersupport',
  'teamsupport', 'help', 'helpdesk', 'helpteam', 'moderator', 'moderation', 'moderationteam', 'modteam', 'mod', 'staff',
  'staffteam', 'team', 'officialteam', 'system', 'security', 'securityteam', 'trustandsafety', 'trustsafety', 'safetyteam']);
const roleOnly = (f: string): boolean => {
  const bare = f.replace(/^the(?=.)/, '');
  return [f, bare].some((v) => ROLE_NAMES.has(v) || (v.endsWith('s') && ROLE_NAMES.has(v.slice(0, -1))));
};
// Emoji for the 2-emoji cap: pictographic graphemes, keycaps (digit + U+20E3) and flags (regional-indicator pairs).
const EMOJI_LIKE = /\p{Extended_Pictographic}|\u20E3|\p{Regional_Indicator}/u;
const graphemes = (s: string) => Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s), (g) => g.segment);

// Cleans the name (lib/text-safety.ts) and checks it. Returns the cleaned name or the reason it is refused.
export function checkDisplayName(raw: unknown): { ok: true; name: string } | { ok: false; reason: string; code: NameReasonCode } {
  const no = (code: NameReasonCode) => ({ ok: false as const, reason: NAME_REASON[code], code });
  const name = sanitizeUserText(String(raw ?? '').replace(/\n/g, ' '), 400).replace(/\n/g, ' ');
  if (!/[\p{L}\p{N}]/u.test(name)) return no('letter');
  if (Array.from(name).length > DISPLAY_NAME_MAX) return no('long');
  if (CHECK_GLYPHS.test(name.normalize('NFKC'))) return no('check');
  if (graphemes(name).filter((g) => EMOJI_LIKE.test(g)).length > 2) return no('emoji');
  const sk = skeleton(name);
  const forms = [sk, ...leet(sk)].flatMap((f) => [f, squash(f), f.replace(/[^\p{L}\p{N}\s]/gu, '')]);
  for (const [re, code] of NAME_WORDS) if (forms.some((f) => re.test(f))) return no(code);
  if (forms.some((f) => roleOnly(f.replace(/[^\p{L}\p{N}]/gu, '')))) return no('role');
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

// Fix round 1 (dev sign-in): the reason shown for an `error` code on /login/dev (app/actions.ts#login redirects with
// `name-<code>` or `handle-<verdict>`). Unknown codes show nothing, so the URL can't put words on the page.
// Fix round 2 (D): taken and look-alike say what to do next ("Try another."); reserved and format are unchanged.
export const HANDLE_RULE = '3–20 lowercase letters, numbers or _';
const HANDLE_REASON: Record<Exclude<HandleVerdict, 'ok'>, string> = {
  taken: 'That handle is taken. Try another.',
  reserved: 'That handle is reserved.',
  lookalike: 'That handle looks too much like another one. Try another.',
  format: `Handle: ${HANDLE_RULE}.`,
};
// The profile's handle-change rejection (app/u/[handle]/page.tsx, ?handle=<verdict>): the same words, format without
// the "Handle:" prefix (the field is already labelled). Unknown values show nothing.
const PROFILE_HANDLE_REASON: Record<string, string> = { ...HANDLE_REASON, format: `${HANDLE_RULE}.` };
export const profileHandleError = (k: unknown): string | undefined =>
  typeof k === 'string' && Object.hasOwn(PROFILE_HANDLE_REASON, k) ? PROFILE_HANDLE_REASON[k] : undefined;
// Fix round 2 (F): the dev form also names a closed sign-up and a missing 18+ box (whole codes, no dash).
const WHOLE_CODES: Record<string, string> = { closed: LAUNCH.closed, attest: SIGNIN.attestError };
export function signInErrorText(code: unknown): string | undefined {
  if (typeof code !== 'string') return undefined;
  if (Object.hasOwn(WHOLE_CODES, code)) return WHOLE_CODES[code];
  const [kind, key] = [code.slice(0, code.indexOf('-')), code.slice(code.indexOf('-') + 1)];
  if (kind === 'name' && Object.hasOwn(NAME_REASON, key)) return NAME_REASON[key as NameReasonCode];
  if (kind === 'handle' && Object.hasOwn(HANDLE_REASON, key)) return HANDLE_REASON[key as Exclude<HandleVerdict, 'ok'>];
  return undefined;
}

/** Fix round 2 (F): the field a dev sign-in error code is about, for aria-describedby; undefined for unknown codes. */
export function signInErrorField(code: unknown): 'handle' | 'name' | 'adult' | undefined {
  if (signInErrorText(code) === undefined) return undefined;
  if (code === 'attest') return 'adult';
  return String(code).startsWith('name-') ? 'name' : 'handle';
}

/**
 * Fix round 2 (F): where a refused dev sign-in goes back to. The typed handle comes back as the field's value, cut to
 * the handle alphabet (lower case, a–z 0–9 _, at most 20), so the URL never carries other text. The display name is
 * never echoed (it is free text; the trader types it again).
 */
export function devLoginRedirect(code: string, typedHandle: unknown): string {
  const h = String(typedHandle ?? '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
  return `/login/dev?error=${encodeURIComponent(code)}${h ? `&handle=${h}` : ''}`;
}
/** The handle value the dev form shows again (the same cut as devLoginRedirect). */
export const devLoginHandleValue = (v: unknown): string => (typeof v === 'string' ? v.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20) : '');
