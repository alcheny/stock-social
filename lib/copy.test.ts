import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MARKS, MINORS, PROMO } from '../scripts/compliance.ts';
import { allCopy, LEGAL_PLACEHOLDER, SIGNIN, TRUST_NOTICE, VENDOR_SECURITY_URL } from './copy.ts';

const MARK_RE = new RegExp(`\\b(${MARKS.map((m) => m.replace(/ /g, '[\\s-]?')).join('|')})\\b`, 'i');
const MINORS_RE = new RegExp(`\\b(${MINORS.map((m) => m.replace(/ /g, '\\s')).join('|')})\\b`, 'i');
// F-1 acceptance: no "endorsed", "recommended", "guaranteed", "secure" as a bare promise, anywhere in the fixed strings.
const BANNED = [/\bendorse[sd]?\b/i, /\brecommend(ed|s|ation)?\b/i, /\bguarantee[sd]?\b/i, /\bsecure\b/i, /\baudit(ed)? (of|your|the) (record|trade)/i, /\bsafe\b/i];

test('every F-1 string passes the banned-claims list, the marks list and the promo list', () => {
  const all = allCopy();
  assert.ok(all.length > 20);
  for (const s of all) {
    for (const re of PROMO) assert.doesNotMatch(s, re, s);
    for (const re of BANNED) assert.doesNotMatch(s, re, s);
    assert.doesNotMatch(s, MARK_RE, s);
    assert.doesNotMatch(s, MINORS_RE, s);
  }
});

test('S1 and S2 copy is the UX lead\'s, verbatim', () => {
  assert.equal(SIGNIN.title, 'Publish your trades');
  assert.equal(SIGNIN.sub, 'Read-only. We can never place trades or move money.');
  assert.equal(SIGNIN.attestError, 'Confirm you are 18 or older to continue.');
  assert.equal(SIGNIN.linkSent, 'Check your email. The link works for 15 minutes.');
  assert.equal(SIGNIN.linkExpired, 'That link has expired. Send a new one?');
  assert.equal(TRUST_NOTICE.title, 'Before you connect');
  assert.equal(TRUST_NOTICE.lines.length, 4);
  assert.equal(TRUST_NOTICE.lines[0], 'Read-only. Stock Social can never place trades or move money.');
  assert.equal(TRUST_NOTICE.primary, 'Connect brokerage (read-only)');
  assert.match(TRUST_NOTICE.lines[2], /reports an independent audit of its security controls/);
  assert.match(VENDOR_SECURITY_URL, /^https:\/\//);
  assert.match(LEGAL_PLACEHOLDER.placeholder, /^Placeholder: the owner supplies the final text before launch\./);
});
