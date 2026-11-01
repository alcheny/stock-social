// F-17 handle and name integrity (docs/features/F-17-handle-and-name-integrity.md; plan
// docs/features/logs/F-16-F-17/plan.md §6, §8 F-17 #1, #2, #7, #8, #16; §R2 B3, B5, E7; §R3). Pure tests: the reserved
// list, the look-alike classes, display-name rules and the confusables set, the rename seam for the profile, and
// source checks on changeHandle and setHandle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  checkDisplayName, handleVerdict, HANDLE_REASON, nextRenameAt, nextRenameText, profileHandleError, RENAME_DAYS, RENAME_RULE,
  RESERVED, RESERVED_SUBSTRINGS, STAFF_WORDS, signInErrorText,
} from './handles.ts';
import { normalizeHandle } from './referral.ts';
import { MARKS, scanText } from '../scripts/compliance.ts';

const src = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');
const flat = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const VENDOR = 'snaptrade'; // the integrated vendor (POLICY T1), the one pinned non-generic entry (Q1)

// ---- AC 1: the reserved list ----

test('F-17 AC1: the reserved lists hold no third-party or person name; the integrated vendor is the one pinned exception', () => {
  const lists = { RESERVED, RESERVED_SUBSTRINGS, STAFF_WORDS };
  const marks = MARKS.map(flat);
  for (const [name, list] of Object.entries(lists)) {
    for (const w of list) {
      const f = flat(w);
      assert.ok(!marks.some((m) => f.includes(m) || (f.length >= 4 && m.includes(f))), `${name}: ${w} matches a listed third-party or person name`);
    }
    // Every entry is a generic, staff, route or own-product word, except the vendor's.
    const own = (w: string) => flat(w) === 'stocksocial';
    const nonGeneric = list.filter((w) => !GENERIC.has(w) && !own(w));
    assert.deepEqual(nonGeneric, [VENDOR], `${name}: only the integrated vendor's word may be a name`);
  }
});

// The generic, staff and route words the decision lists (plus their kin). Adding any other word to lib/handles.ts
// fails the test above until it is added here, so a brand or person can't slip in unseen.
const GENERIC = new Set(['admin', 'administrator', 'support', 'help', 'helpdesk', 'moderator', 'mod', 'mods', 'staff', 'team',
  'official', 'verified', 'demo', 'root', 'system', 'api', 'security', 'legal', 'press', 'privacy', 'terms', 'abuse', 'report',
  'me', 'how', 'login', 'settings', 'connect', 't', 'u', 'review']);

test('F-17 AC1: the compliance scanner finds no third-party mark or person in the list, its tests or fixtures', () => {
  for (const f of ['./handles.ts', './handles.test.ts', './handles.db.test.ts', './f17-handles.test.ts', './f17-rename.db.test.ts',
    './f17-normaliser.test.ts', './f17-logs.test.ts', '../e2e/f17-handles.spec.ts']) {
    const v = scanText(f.replace(/^\.\.?\//, ''), src(f)).filter((x) => x.rule === 'third-party mark or real person');
    assert.deepEqual(v, [], f);
  }
});

// ---- AC 2: every class of refusal (unit, one per class) ----

const DEMO = ['momentum_maya', 'dividend_dan', 'yolo_yuki'];
test('F-17 AC2: every reserved handle is refused, in any case', () => {
  for (const h of RESERVED.filter((r) => normalizeHandle(r))) {
    assert.equal(handleVerdict(h, { others: [], demo: DEMO }), 'reserved', h);
    assert.equal(handleVerdict(h.toUpperCase(), { others: [], demo: DEMO }), 'reserved', h.toUpperCase());
  }
});

test('F-17 AC2: a look-alike of a reserved handle is refused (reserved class)', () => {
  for (const h of ['adm1n', 'supp0rt', '0fficial', 'ver1fied', 'the_admins', 'st0ck_s0cial']) assert.equal(handleVerdict(h, { others: [], demo: DEMO }), 'reserved', h);
});

test('F-17 AC2: a look-alike of a demo handle is refused (demo class)', () => {
  for (const h of ['m0mentum_maya', 'momentum_mayaa', 'd1vidend_dan']) assert.equal(handleVerdict(h, { others: [], demo: DEMO }), 'lookalike', h);
});

test('F-17 AC2: a look-alike of a connected trader\'s handle is refused (connected class)', () => {
  // `others` is every other account's handle (Q3: the superset, connected traders included).
  for (const h of ['ca1m_trader', 'calm_trader'.replace('m', 'rn')]) assert.equal(handleVerdict(h, { others: ['calm_trader'], demo: DEMO }), 'lookalike', h);
});

test('F-17 AC2: a look-alike of an F-7 public-profile handle is refused (F-7 class)', () => {
  // F-7 handles are users rows (pf_…) read at runtime, never listed; sign-up and rename refuse the prefix outright too.
  assert.equal(handleVerdict('pf_lee_fi1er', { others: ['pf_lee_filer'], demo: DEMO }), 'lookalike');
  assert.match(src('./auth/attempts.ts'), /if \(isFilerHandle\(handle\)\) throw new HandleTakenError\('reserved'\); \/\/ F-7: nobody renames into a filer handle/);
});

// ---- AC 7, 8, 16: display names ----

test('F-17 AC7: NFKC applies in matching (full-width), direction controls are stripped, check and seal glyphs are refused', () => {
  assert.equal(checkDisplayName('Ｖｅｒｉｆｉｅｄ').ok, false);
  const bidi = checkDisplayName('Ver‮ified');
  assert.ok(!bidi.ok && bidi.code === 'verified', 'a bidi override inside "Verified" is stripped, then refused');
  assert.deepEqual(checkDisplayName('Ma‮ya'), { ok: true, name: 'Maya' }, 'a bidi name is stored without its control');
  assert.deepEqual(checkDisplayName('⁧Sam⁩ Lee'), { ok: true, name: 'Sam Lee' });
  for (const g of ['✓', '\u{1F5F8}', '\u{2BBD}', '\u{1F3F5}', '\u{1F396}', '\u{1F3C5}', '\u{1F4DB}', '\u{1F4AE}', '㊙', '\u{1F6E1}️']) {
    const c = checkDisplayName(`Sam ${g}`);
    assert.ok(!c.ok && c.code === 'check', `check or seal glyph U+${g.codePointAt(0)!.toString(16)}`);
  }
  assert.match(checkDisplayName('Sam \u{1F3C5}').ok ? '' : (checkDisplayName('Sam \u{1F3C5}') as { reason: string }).reason, /check marks or seals/);
});

test('F-17 AC7/AC8: "Verified" and "Official" are refused as whole words only; inside a longer word they pass', () => {
  for (const n of ['Unofficially bullish', 'Officialdom fan', 'Unofficial Notes', 'Unverified Hunches', 'Officialdom']) {
    assert.ok(checkDisplayName(n).ok, n);
  }
  for (const n of ['Verified', 'Official', 'Un-official', 'Official Desk', 'v.e.r.i.f.i.e.d', 'Maya Verifled', 'The official one',
    'Sam (verified)', 'verified_sam', 'Sam Verified2', 'VerifiedTrader', 'MayaOfficial']) {
    const c = checkDisplayName(n);
    assert.ok(!c.ok && c.code === 'verified', n);
  }
});

test('F-17 (v2 E7): brand words stay substring rules', () => {
  for (const n of ['StockSocialFan', 'stocksocialfan', 'Stock Social Desk', 'snaptradefan']) {
    const c = checkDisplayName(n);
    assert.ok(!c.ok && c.code === 'brand', n);
  }
});

test('F-17 AC16: the confusables set is refused or folded as the decisions require', () => {
  const refused: [string, string][] = [
    ['Vеrified', 'mixed script (Cyrillic e)'],
    ['Οfficial', 'mixed script (Greek capital omicron)'],
    ['Ver​ified', 'zero-width space'],
    ['Off⁠icial', 'word joiner'],
    ['Ver‮ified', 'bidi override'],
    ['Ver⁦ified', 'bidi isolate'],
    ['Ｏｆｆｉｃｉａｌ', 'full-width'],
    ['OFFICIAL', 'case fold'],
    ['vErIfIeD', 'case fold'],
  ];
  for (const [n, why] of refused) {
    const c = checkDisplayName(n);
    assert.ok(!c.ok && c.code === 'verified', `${why}: ${JSON.stringify(n)}`);
  }
  // Handles: a mixed-script handle is a format error (ASCII only); a case fold is folded, then reserved.
  assert.equal(handleVerdict('аdmin', { others: [], demo: DEMO }), 'format');
  assert.equal(handleVerdict('ad‮min', { others: [], demo: DEMO }), 'format');
  assert.equal(handleVerdict('ad​min', { others: [], demo: DEMO }), 'format');
  assert.equal(handleVerdict('ａｄｍｉｎ', { others: [], demo: DEMO }), 'format');
  assert.equal(normalizeHandle('ADMIN'), 'admin');
  assert.equal(handleVerdict('ADMIN', { others: [], demo: DEMO }), 'reserved');
});

// ---- The rename seam (engineer C renders it on the profile) ----

test('F-17 seam: HANDLE_REASON.soon, RENAME_RULE and nextRenameAt / nextRenameText for the profile\'s rename panel', () => {
  assert.equal(RENAME_DAYS, 30);
  assert.equal(HANDLE_REASON.soon, 'You can change your handle once every 30 days.');
  assert.equal(profileHandleError('soon'), HANDLE_REASON.soon);
  assert.equal(signInErrorText('handle-soon'), HANDLE_REASON.soon);
  assert.equal(RENAME_RULE, 'You can change your handle once every 30 days. Your old handle stays reserved for you for a year and its links stop working. Changing again releases it.');
  assert.equal(nextRenameAt(null), null);
  assert.equal(nextRenameAt(new Date('2026-11-01T12:00:00Z'))!.toISOString(), '2026-12-01T12:00:00.000Z');
  assert.equal(nextRenameText(new Date('2026-11-01T12:00:00Z')), 'Next change: Dec 1, 2026.');
  assert.equal(nextRenameText(new Date('2026-11-30T23:30:00Z')), 'Next change: Dec 30, 2026.', 'UTC date');
  assert.equal(nextRenameText(null), undefined);
  for (const t of [HANDLE_REASON.soon, RENAME_RULE]) assert.doesNotMatch(t, /\b301\b|redirect|report|review/i);
});

test('F-17 seam: the rename action sends a 30-day refusal back to the profile as ?handle=soon (the verdict pattern)', () => {
  const a = src('../app/auth/actions.ts');
  const setHandle = a.slice(a.indexOf('export async function setHandle'), a.indexOf('export async function deleteProfile'));
  assert.match(setHandle, /if \(e instanceof HandleTakenError\) redirect\(`\/u\/\$\{user\.handle\}\?handle=\$\{e\.verdict\}`\);/);
  assert.match(src('./auth/attempts.ts'), /throw new HandleTakenError\('soon'\)/);
});

// ---- changeHandle source checks (v2 B3, B5; D22) ----

const changeHandleSrc = () => {
  const s = src('./auth/attempts.ts');
  const start = s.indexOf('export async function changeHandle');
  assert.ok(start > 0);
  return s.slice(start);
};

test('F-17 (v2 B3): changeHandle deletes nothing: no `delete from` anywhere in it', () => {
  assert.doesNotMatch(changeHandleSrc(), /delete\s+from/i);
  assert.match(changeHandleSrc(), /update handle_reservations set until = now\(\) where handle = \$\{handle\} and user_id = \$\{userId\}/);
});

test('F-17 (v2 B5): the old-links ponytail names no 301 or redirect', () => {
  const s = src('./auth/attempts.ts');
  const ponytails = s.split('\n').filter((l) => /ponytail:/.test(l));
  assert.ok(ponytails.some((l) => l.includes('old links show the neutral retired page by design (F-17); nothing to add')));
  for (const l of ponytails) assert.doesNotMatch(l, /\b301\b|redirect/i, l);
  assert.doesNotMatch(s, /no rename-frequency limit/, 'the rename limit exists now');
});

test('F-17 AC12 (D22): changeHandle asks the launch gate on every path, with an injectable env and clock', () => {
  const c = changeHandleSrc();
  assert.match(c, /opts: ChangeHandleOpts = \{\}/);
  assert.match(c, /if \(handleReserved\(handle, opts\.env \?\? process\.env\)\) throw new HandleTakenError\('reserved'\);/);
  assert.match(c, /const now = opts\.now \?\? new Date\(\);/);
});
