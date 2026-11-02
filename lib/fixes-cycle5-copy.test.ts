// FIXES-CYCLE5 WP4: copy and the sign-in error path. F5-6 (the connect line, legal committee 2026-11-02 2a), F5-7 (the
// email error and the kept 18+ tick, legal committee 2026-11-02 item 1 A1-A11, 2b), owner decision 2026-11-02 (1)
// (the held-sells line). The browser behaviour is in e2e/fixes-cycle5-a11y.spec.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONSENT, FC5, FC5_WP4, PROFILE, SIGNIN, TRUST_NOTICE } from './copy.ts';
import { ATTEST_KEEP_COOKIE, ATTEST_KEEP_PATH, ATTEST_KEEP_SECONDS, ATTEST_KEEP_VALUE, keepsTick } from './auth/attest-keep.ts';
import { COOKIE_TABLE } from './privacy-cookies.ts';

const src = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const code = (f: string) => src(f).replace(/(^|\s)\/\/[^\n]*/g, '$1').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('F5-6: both connect lines say "your broker provides"; none says "your full trade history" or claims completeness', () => {
  const lines = [TRUST_NOTICE.lines[3], CONSENT.lines(2, 1)[0]];
  for (const l of lines) {
    assert.match(l, /your broker provides/);
    assert.doesNotMatch(l, /your full trade history|all of your trades|every trade|complete/i);
  }
  assert.equal(TRUST_NOTICE.lines[3], 'Every account under this login, except simulated ones, and the full trade history your broker provides are included. No trades are imported until you confirm on the next screen.');
  assert.ok(!TRUST_NOTICE.lines.some((l) => /your full trade history|Nothing is imported/.test(l)));
});

test('F5-7 (2b): the email error names the format with the reserved example domain; never prefilled or a placeholder', () => {
  assert.equal(SIGNIN.emailError, 'Enter a full email address, like name@example.com.');
  const page = code('app/login/page.tsx');
  assert.doesNotMatch(page, /placeholder=/);
  assert.doesNotMatch(page, /example\.com/);
});

test('F5-7 (A7): the email error carries exactly one 18+ sentence, matching the box', () => {
  const page = src('app/login/page.tsx');
  assert.match(page, /<p id="email-err" role="alert"[^>]*>\{SIGNIN\.emailError\} \{ticked \? FC5_WP4\.tickKept : FC5\.attestAgain\}<\/p>/);
  assert.match(page, /name="adult" defaultChecked=\{ticked\}/);
  assert.match(page, /const ticked = keepsTick\(jar\.get\(ATTEST_KEEP_COOKIE\)\?\.value, error\);/);
  assert.match(FC5_WP4.tickKept, /“I am 18 or older” box is still ticked/);
  assert.equal(FC5.attestAgain, 'Then tick “I am 18 or older” again.');
  // email: autofocus, described by the alert; rate: the alert takes focus.
  assert.match(page, /aria-describedby=\{error === 'email' \? 'email-err' : undefined\}[^/]*autoFocus=\{error === 'email'\}/);
  assert.match(page, /<p id="email-rate" role="alert" tabIndex=\{-1\}[^>]*>\{SIGNIN\.tooMany\}<\/p><FocusHeading id="email-rate" \/>/);
});

test('F5-7 (A2, A4): only the fixed cookie value together with error=email ticks the box', () => {
  assert.equal(ATTEST_KEEP_VALUE, '1');
  assert.equal(keepsTick('1', 'email'), true);
  for (const e of [undefined, '', 'attest', 'rate', 'provider', 'closed', 'expired', 'used', 'EMAIL']) assert.equal(keepsTick('1', e), false, String(e));
  for (const v of [undefined, '', '0', 'true', 'on', '1 ', 'a@b.co']) assert.equal(keepsTick(v, 'email'), false, String(v));
  // No query parameter reaches the box: the page passes only sp.error and the cookie to keepsTick.
  const page = code('app/login/page.tsx');
  assert.equal([...page.matchAll(/defaultChecked/g)].length, 1);
  assert.doesNotMatch(page, /sp\.(adult|attest|checked)/);
  assert.match(page, /type SP = \{ ref\?: string; via\?: string; error\?: string; method\?: string \};/);
});

test('F5-7 (A1, A3, A5, A6): set only on the error=email redirect, short-lived, httpOnly, lax, /login, secure on https; cleared on every submit and sign-out; the attestation is read only from the form', () => {
  assert.ok(ATTEST_KEEP_SECONDS > 0 && ATTEST_KEEP_SECONDS <= 60, 'Max-Age at most 60 s');
  assert.equal(ATTEST_KEEP_PATH, '/login');
  const a = code('app/auth/actions.ts');
  const keep = a.slice(a.indexOf('async function keepTick'), a.indexOf('export async function startSignIn'));
  assert.match(keep, /jar\.set\(ATTEST_KEEP_COOKIE, ATTEST_KEEP_VALUE, \{ httpOnly: true, sameSite: 'lax', path: ATTEST_KEEP_PATH, maxAge: ATTEST_KEEP_SECONDS, secure: https \}\)/);
  assert.doesNotMatch(keep, /sql|console\.|log|createAttempt|signup_attempts/, 'A8: no database write or log line');
  // keepTick(true) appears once, on the error=email redirect; every startSignIn and signOut start by clearing.
  assert.equal([...a.matchAll(/keepTick\(true\)/g)].length, 1);
  assert.match(a, /if \(!email\) \{ await keepEmail\(form\); await keepTick\(true\); return back\(\{ \.\.\.keep, error: 'email' \}\); \}/);
  assert.match(a, /export async function startSignIn\(form: FormData\) \{\n\s+await keepTick\(false\);/);
  assert.match(a, /export async function signOut\(\) \{\n\s+await keepTick\(false\);/);
  // A6: the attestation comes from the form's own field, checked before the email branch; the cookie is never read here.
  const start = a.slice(a.indexOf('export async function startSignIn'));
  assert.ok(start.indexOf("form.get('adult') !== 'on'") < start.indexOf("error: 'email'"));
  assert.doesNotMatch(a, /\.get\(ATTEST_KEEP_COOKIE\)\?\.value|keepsTick/);
  // A5: the proxy drops it from every non-POST /login request and clears it in the response.
  const p = code('proxy.ts');
  assert.match(p, /request\.method !== 'POST' && request\.nextUrl\.pathname === ATTEST_KEEP_PATH && request\.cookies\.has\(ATTEST_KEEP_COOKIE\)/);
  assert.match(p, /request\.cookies\.delete\(ATTEST_KEEP_COOKIE\)/);
  assert.match(p, /response\.cookies\.set\(ATTEST_KEEP_COOKIE, '', \{ httpOnly: true, sameSite: 'lax', path: ATTEST_KEEP_PATH, maxAge: 0, secure: https \}\)/);
  assert.doesNotMatch(src('lib/auth/attest-keep.ts'), /\bsql\b|console\./);
});

test('F5-7 (A8): the cookie table names it, its purpose (not consent) and its lifetime in words', () => {
  const row = COOKIE_TABLE.find((r) => r.name === ATTEST_KEEP_COOKIE);
  assert.ok(row);
  assert.equal(row.lifetimeSeconds, ATTEST_KEEP_SECONDS);
  assert.equal(row.path, '/login');
  assert.match(row.purpose, /18\+ tick/);
  assert.match(row.purpose, /not a record of consent/);
  assert.match(row.lifetime, /^30 seconds/);
  assert.deepEqual([...row.setIn].sort(), ['app/auth/actions.ts', 'proxy.ts']);
});

test('owner decision 2026-11-02 (1): the held-sells public line', () => {
  assert.equal(PROFILE.excludedHeld(2), '2 sells excluded while a possible duplicate is checked.');
  assert.equal(PROFILE.excludedHeld(1), '1 sell excluded while a possible duplicate is checked.');
});
