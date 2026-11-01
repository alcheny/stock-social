import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDisplayName, handleVerdict, hskel, NAME_REASON, RESERVED, signInErrorText, stripTail, HANDLE_RESERVED_DAYS } from './handles.ts';

const DEMO = ['momentum_maya', 'dividend_dan', 'yolo_yuki'];
const ctx = (others: string[] = DEMO) => ({ others, demo: DEMO });

test('hskel: lower case, rn→m, 0→o, 1→l; stripTail drops a trailing run of digits or _', () => {
  assert.equal(hskel('RnOmentum_0l1'), 'momentum_oll');
  assert.equal(stripTail('momentum_maya_1_'), 'momentum_maya');
  assert.equal(stripTail('trader_2024'), 'trader');
  assert.equal(HANDLE_RESERVED_DAYS, 365);
});

test('refused: reserved words, their look-alikes and the product name', () => {
  for (const h of ['stocksocial', 'stock_social', 'admin', 'official', 'verified', 'support', 'snaptrade', 'login', 'review']) {
    assert.equal(handleVerdict(h, ctx()), 'reserved', h);
  }
  for (const h of ['adrnin', 'admin_2024', 'mod_1', '0fficial_desk', 'the_verified_one', 'stock_social1', 'team_1', 'my_official']) {
    assert.equal(handleVerdict(h, ctx()), 'reserved', h);
  }
  assert.ok(RESERVED.every((r) => !/[A-Z]/.test(r)));
});

test('refused: look-alikes of a demo profile, with or without a trailing run', () => {
  for (const h of ['momentum_maya1', 'momentum_maya_', 'rnomentum_maya', 'momentum_rnaya', 'dividend_dan2']) {
    assert.equal(handleVerdict(h, ctx([])), 'lookalike', h);
  }
});

test('refused: look-alike of any other handle or reservation; exact match is taken', () => {
  assert.equal(handleVerdict('ca1m_trader', ctx(['calm_trader'])), 'lookalike');
  assert.equal(handleVerdict('calm_trader', ctx(['calm_trader'])), 'taken');
  assert.equal(handleVerdict('momentum_maya', ctx()), 'taken');
});

test('accepted: ordinary handles, trailing digits that match nothing, provisional handles', () => {
  for (const h of ['trader_2024', 'maya_2024', 'calm_trader', 'dan_2', 'officer_k']) assert.equal(handleVerdict(h, ctx()), 'ok', h);
  // A provisional trader_* needs only taken and reserved: a look-alike of another provisional handle is fine.
  assert.equal(handleVerdict('trader_abcd1234', { others: ['trader_abcdl234'], demo: DEMO, provisional: true }), 'ok');
  assert.equal(handleVerdict('trader_abcd1234', { others: ['trader_abcd1234'], demo: DEMO, provisional: true }), 'taken');
  // The same suffix rule never applies to other users' handles: trader_2024 is free next to trader_2023.
  assert.equal(handleVerdict('trader_2024', ctx(['trader_2023'])), 'ok');
});

test('format: anything normalizeHandle refuses', () => {
  for (const h of ['Bad Handle!', 'ab', 'x'.repeat(21), '', null, 42]) assert.equal(handleVerdict(h, ctx()), 'format', String(h));
  assert.equal(handleVerdict('  Calm_Trader ', ctx([])), 'ok'); // normalized like the form
});

test('checkDisplayName: accepts ordinary names, cleans invisible characters', () => {
  for (const n of ['Maya', 'Ana María', '李雷', 'Sam \u{1F680}\u{1F680}', 'Dave Rified', 'O’Neil', 'Officer K']) {
    const c = checkDisplayName(n);
    assert.ok(c.ok, n);
  }
  assert.deepEqual(checkDisplayName('  Ma​ya‮ '), { ok: true, name: 'Maya' });
  assert.deepEqual(checkDisplayName('Line\nbreak'), { ok: true, name: 'Line break' });
});

test('checkDisplayName: refuses check glyphs, verified/official, product or vendor name, 3+ emoji, 41+ characters, no letter or digit', () => {
  const refused = ['Sam ✓', 'Sam ✔', 'Sam ✅', 'Sam ☑', 'Verified Sam', 'V3r1f1ed', 'v.e.r.i.f.i.e.d', 'Official Desk',
    '0fficial', 'Stock Social Team', 'stocksocial', 'S t o c k S o c i a l', 'snaptrade fan', '\u{1F680}\u{1F680}\u{1F680}',
    'a\u{1F468}‍\u{1F469}‍\u{1F467}\u{1F680}\u{1F525}', 'x'.repeat(41), '!!!', '', '   ', '​​'];
  for (const n of refused) {
    const c = checkDisplayName(n);
    assert.equal(c.ok, false, n);
    if (!c.ok) assert.ok(c.reason.length > 10 && !c.reason.includes(n.trim() || '\u0000'), n);
  }
  assert.ok(checkDisplayName('x'.repeat(40)).ok);
  assert.ok(checkDisplayName('a\u{1F468}‍\u{1F469}‍\u{1F467}\u{1F680}').ok, 'a joined emoji sequence counts once');
});

// ---- Fix round 1 ----

test('refused: the 1→i reading, plurals and "the" forms of staff words, spaced-out reserved words, the vendor name', () => {
  for (const h of ['adm1n', 'ver1fied', 'offic1al', 'ver1fied_trader', 'my_offic1al_desk', 'admins', 'the_admin', 'theadmin',
    'the_admins', 'a_d_m_i_n', 's_u_p_p_o_r_t', 'mods', 'the_mod', 'staff_2024', 'the_staff', 'teams', 'moderators',
    'snap_trade', 'snaptrade_fan', 'snap_trade_desk', 'v3rified', 'st0ck_s0cial', '5nap7rade', 'support_team', 'helpdesk_1']) {
    assert.equal(handleVerdict(h, ctx()), 'reserved', h);
  }
});

test('not over-blocked: ordinary handles near the reserved words stay free', () => {
  for (const h of ['trader_2024', 'maya_2024', 'admiral_x', 'supportive', 'theme', 'thermos', 'helps_out', 'the_press_box',
    'officer_k', 'modest_gains', 'teamwork_trades', 'stafford', 'systematic_sam', 'administer', 'dan_the_man', 'press_on']) {
    assert.equal(handleVerdict(h, ctx()), 'ok', h);
  }
});

test('refused: demo look-alikes with underscores removed, doubled or with a doubled last letter, or 1 read as i', () => {
  for (const h of ['momentum__maya', 'momentummaya', 'momentum_mayaa', 'momentum_mayaa_1', 'd1vidend_dan', 'dividenddan', 'yolo_yukii']) {
    assert.equal(handleVerdict(h, ctx([])), 'lookalike', h);
  }
  for (const h of ['momentum_mia', 'dividend_dana', 'yolo_yuko', 'maya_momentum']) assert.equal(handleVerdict(h, ctx([])), 'ok', h);
});

test('an active reservation held by someone else is "reserved", not "taken"; its look-alike is "lookalike"', () => {
  const c = { others: ['old_name', 'live_user'], reservations: ['old_name'], demo: DEMO };
  assert.equal(handleVerdict('old_name', c), 'reserved');
  assert.equal(handleVerdict('o1d_name', c), 'lookalike');
  assert.equal(handleVerdict('live_user', c), 'taken');
  assert.equal(handleVerdict('old_name', { ...c, provisional: true }), 'reserved');
});

test('a handle the rules accept is always an acceptable display name (the dev sign-in fallback never fails)', () => {
  const corpus = ['v3rified', 'support_team', '5taff', 'adm1n', 'the_mods', 'helpteam', 'snap_trade', 'st0ck_s0cial', 'sec_urity',
    'trustandsafety', 'customer_support', 'moderation_team', 'team_support', 'official_x', '0ff1c1al', 'calm_trader', 'trader_2024',
    'v_e_r_i_f_i_e_d', 's7aff', 'mod_team', 'staffteam', 'thestaff', 'adm1ns', 'h3lpdesk', 'supp0rt', 'sn4ptrade'];
  for (const h of corpus) {
    if (handleVerdict(h, ctx([])) !== 'ok') continue;
    const c = checkDisplayName(h);
    assert.ok(c.ok, `${h} passes the handle rules but fails as a name: ${!c.ok && c.reason}`);
  }
});

test('display names: only a staff or role word is refused, in any case or look-alike; names containing one are fine', () => {
  for (const n of ['Admin', 'admin', 'ADMIN', 'Аdmin', 'Adm1n', 'Support', 'Support Team', 'support team', 'Moderator', 'The Moderators',
    'Staff', 'Official Team', 'S T A F F', 'Help Desk', 'Security Team', 'Trust & Safety']) {
    const c = checkDisplayName(n);
    assert.equal(c.ok, false, n);
  }
  assert.deepEqual(checkDisplayName('Support Team'), { ok: false, reason: NAME_REASON.role, code: 'role' });
  for (const n of ['Maya from Support Street', 'Sam the Admiral', 'Teamster Joe', 'Staffan', 'Moderately Bullish', 'Helpful Hank']) {
    assert.ok(checkDisplayName(n).ok, n);
  }
});

test('display names: keycaps and flags count toward the 2-emoji cap; check-like glyphs are refused', () => {
  const key1 = '1\uFE0F\u20E3', key2 = '2\u20E3', flag = '\u{1F1FA}\u{1F1F8}';
  assert.ok(checkDisplayName(`Sam ${key1}${flag}`).ok, 'two is fine');
  assert.equal(checkDisplayName(`Sam ${key1}${key2}${flag}`).ok, false);
  assert.equal(checkDisplayName(`Sam ${flag}${flag}${flag}`).ok, false);
  assert.equal(checkDisplayName(`Sam \u{1F680}${key1}${flag}`).ok, false);
  for (const g of ['ꓦ', '⩗', '⩘', '⍻', '\u{10102}', '✓', '✔', '☑', '✅', '\u{1F5F8}']) {
    const c = checkDisplayName(`Sam ${g}`);
    assert.equal(c.ok, false, g);
    if (!c.ok) assert.equal(c.code, 'check');
  }
});

test('display names: invisible fillers are removed before the words are checked', () => {
  for (const n of ['Maya Veri\u3164fied', 'Maya Veri\u2800fied', 'Maya Veri\u034Ffied', 'Maya Veri\uFFA0fied', 'Maya Veri\u{E0041}fied', 'Maya Vérified']) {
    const c = checkDisplayName(n);
    assert.equal(c.ok, false, JSON.stringify(n));
  }
  assert.deepEqual(checkDisplayName('Ma\u3164ya\u2800'), { ok: true, name: 'Maya' });
});

test('signInErrorText: known codes only; never echoes the URL', () => {
  assert.equal(signInErrorText('name-verified'), NAME_REASON.verified);
  assert.equal(signInErrorText('name-role'), NAME_REASON.role);
  assert.equal(signInErrorText('handle-reserved'), 'That handle is reserved. Try another.');
  // Fix round 2 (D): taken and look-alike say what to do next.
  assert.equal(signInErrorText('handle-lookalike'), 'That handle looks too much like another one. Try another.');
  assert.equal(signInErrorText('handle-taken'), 'That handle is taken. Try another.');
  assert.equal(signInErrorText('handle-format'), 'Handle: 3–20 lowercase letters, numbers or _.');
  for (const bad of [undefined, '', 'name-', 'name-toString', 'handle-ok', 'name-__proto__', 'Buy now at example.com', ['name-role']]) {
    assert.equal(signInErrorText(bad), undefined, String(bad));
  }
});

test('dev sign-in: only a typed name is checked, and a refused name or handle goes back to the form, never a 500', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../app/actions.ts', import.meta.url), 'utf8');
  const login = src.slice(src.indexOf('export async function login'), src.indexOf('export async function saveThesis'));
  assert.match(login, /const name = String\(form\.get\('name'\) \?\? ''\)\.trim\(\);/);
  assert.doesNotMatch(login, /\|\| handle;/, 'the handle is never passed as a typed name');
  assert.match(login, /instanceof DisplayNameError\) made = \{ error: `name-\$\{e\.code\}` \}/);
  assert.match(login, /instanceof HandleTakenError\) made = \{ error: `handle-\$\{e\.verdict\}` \}/);
  assert.match(login, /redirect\(`\/login\/dev\?error=\$\{made\.error\}`\)/);
  const page = readFileSync(new URL('../app/login/dev/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /signInErrorText\(sp\?\.error\)/);
  assert.match(page, /role="alert"/);
});

// ---- Fix round 2 ----

test('fix round 2 (D): the profile names the handle rejection; taken and look-alike say "Try another."', async () => {
  const { profileHandleError, HANDLE_RULE } = await import('./handles.ts');
  assert.equal(HANDLE_RULE, '3–20 lowercase letters, numbers or _');
  assert.equal(profileHandleError('taken'), 'That handle is taken. Try another.');
  assert.equal(profileHandleError('lookalike'), 'That handle looks too much like another one. Try another.');
  assert.equal(profileHandleError('reserved'), 'That handle is reserved. Try another.');
  assert.equal(profileHandleError('format'), '3–20 lowercase letters, numbers or _.');
  for (const bad of [undefined, '', 'ok', 'toString', '__proto__', 'Buy now', ['taken']]) assert.equal(profileHandleError(bad), undefined, String(bad));
  const { readFileSync } = await import('node:fs');
  const page = readFileSync(new URL('../app/u/[handle]/page.tsx', import.meta.url), 'utf8');
  // The panel opens with an error (the alert inside a collapsed <details> was invisible); the field takes focus.
  assert.match(page, /<details className="handle-edit" open=\{!!handleError\}>/);
  assert.match(page, /<input id="new-handle"[^>]*title=\{HANDLE_RULE\}[^>]*autoFocus=\{!!handleError\}[^>]*aria-describedby=\{handleError \? 'handle-hint handle-err' : 'handle-hint'\}/);
  assert.match(page, /<p id="handle-hint" className="muted small">\{HANDLE_RULE\}<\/p>/);
  assert.match(page, /\{handleError && <p id="handle-err" role="alert" className="down small">\{handleError\}<\/p>\}/);
});

test('fix round 2 (F): dev sign-in refusals go back to the form, decided before the attempt row is written', async () => {
  const { devLoginRedirect, devLoginHandleValue, signInErrorField } = await import('./handles.ts');
  const { LAUNCH, SIGNIN } = await import('./copy.ts');
  assert.equal(signInErrorText('closed'), LAUNCH.closed);
  assert.equal(signInErrorText('attest'), SIGNIN.attestError);
  assert.equal(signInErrorField('attest'), 'adult');
  assert.equal(signInErrorField('closed'), 'handle');
  assert.equal(signInErrorField('handle-format'), 'handle');
  assert.equal(signInErrorField('name-verified'), 'name');
  assert.equal(signInErrorField('name-nope'), undefined);
  assert.equal(signInErrorField('Buy now'), undefined);
  // The typed handle comes back cut to the handle alphabet; nothing else rides in the URL.
  assert.equal(devLoginRedirect('handle-format', 'Bad Handle!<b>'), '/login/dev?error=handle-format&handle=badhandleb');
  assert.equal(devLoginRedirect('attest', ''), '/login/dev?error=attest');
  assert.equal(devLoginRedirect('closed', 'x'.repeat(40)), `/login/dev?error=closed&handle=${'x'.repeat(20)}`);
  assert.equal(devLoginHandleValue('<script>Maya'), 'scriptmaya');
  assert.equal(devLoginHandleValue(['a']), '');

  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../app/actions.ts', import.meta.url), 'utf8');
  const login = src.slice(src.indexOf('export async function login'), src.indexOf('export async function saveThesis'));
  const attempt = login.indexOf('createAttempt(');
  for (const step of ["back('handle-format')", "back('attest')", "back('closed')", 'back(`name-${c.code}`)', 'back(`handle-${verdict}`)']) {
    assert.ok(login.indexOf(step) > 0 && login.indexOf(step) < attempt, `${step} before createAttempt`);
  }
  assert.doesNotMatch(login, /throw new Error\('Handle: /, 'a bad-format handle is no longer a 500');
  assert.doesNotMatch(login, /devLoginRedirect\([^)]*name/, 'the name is never echoed');
  const page = readFileSync(new URL('../app/login/dev/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /<p id="dev-err" role="alert" className="down small">\{error\}<\/p>/);
  assert.match(page, /<input id="handle"[^>]*title=\{HANDLE_RULE\}[^>]*defaultValue=\{devLoginHandleValue\(sp\?\.handle\)\}[^>]*aria-describedby=\{desc\('handle', 'handle-hint'\)\}/);
  assert.match(page, /<p id="handle-hint" className="muted small">\{HANDLE_RULE\}<\/p>/);
  assert.match(page, /<input id="name"[^>]*aria-describedby=\{desc\('name'\)\}/);
  assert.doesNotMatch(page, /sp\?\.name/, 'the name is never read back from the URL');
});

test('fix round 2 (G): misspelt verified/official names, l-for-i reserved handles, doubled and digit look-alikes of demo handles', () => {
  for (const n of ['Maya Verifled', 'Maya Offical', 'Maya Verfied', 'Maya Oficial', 'Maya 0ffical', 'Maya V3rifled']) {
    const c = checkDisplayName(n);
    assert.ok(!c.ok && c.code === 'verified', n);
  }
  for (const h of ['admln', 'verlfied', 'offlcial', 'the_admln']) assert.equal(handleVerdict(h, ctx()), 'reserved', h);
  const demo = { others: [], demo: [...DEMO, 'swing_sam'] };
  for (const h of ['momentumm_maya', 'mommentum_maya', 'momentum_mayya', 'swing_5am', 'm0mentum_maya', 'd1v1dend_dan']) assert.equal(handleVerdict(h, demo), 'lookalike', h);
});

test('fix round 2 (G): no over-blocking — ordinary handles and names stay free', () => {
  const demo = { others: [], demo: [...DEMO, 'swing_sam'] };
  for (const h of ['trader_2024', 'maya_2024', 'reporter', 'admiral_x', 'supportive', 'stafford', 'theme', 'dillon', 'allie', 'swing_trader',
    'sam_swings', 'momentum_max', 'dan_2', 'officer_k', 'billie_l', 'lillian', 'allison_99', 'swing_5', 'yolo_yukio']) {
    assert.equal(handleVerdict(h, demo), 'ok', h);
  }
  for (const n of ['dillon', 'allie', 'Lillian', 'Officer K', 'Dave Rified', 'Vera Field', 'Office Hours', 'Offcourse Trading', 'Maya']) {
    assert.ok(checkDisplayName(n).ok, n);
  }
});

// ---- Fix round 3 ----

test('dev sign-in: a handle whose profile is pending deletion is treated as new (closed or taken), never a 500', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../app/actions.ts', import.meta.url), 'utf8');
  const login = src.slice(src.indexOf('export async function login'), src.indexOf('export async function saveThesis'));
  // Fix round 4: the lookup is lib/handles.ts#findLiveUserByHandle, whose deleted_at filter lib/handles.db.test.ts tests
  // against the database (reverting the filter fails there).
  assert.match(login, /const known = await findLiveUserByHandle\(handle\);/);
  assert.match(src, /import \{[^}]*\bfindLiveUserByHandle\b[^}]*\} from '@\/lib\/handles\.ts';/);
  assert.ok(login.indexOf('const known') < login.indexOf("back('closed')"));
});

// F-7 merge: a public filer's generated handle (pf_…) is never signed up, signed into from the dev form, or renamed into.
test('F-7 filer handles are refused on every chosen-handle path', async () => {
  const { readFileSync } = await import('node:fs');
  const src = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');
  assert.match(src('../app/actions.ts'), /if \(isFilerHandle\(handle\)\) back\('handle-reserved'\);/);
  const att = src('./auth/attempts.ts');
  assert.equal([...att.matchAll(/if \(isFilerHandle\(handle\)\) throw new HandleTakenError\('reserved'\);/g)].length, 2);
  assert.match(src('./reports.ts'), /u\.public_filer_id is null/);
});
