// F-16 engineer C (plan docs/features/logs/F-16-F-17/plan.md §2.1–§2.4, §5.4, §5.7, §8 #6, #10, #13, #14, #15; v2 B1,
// B6, B7; E16): the static checks of the UI slice, one named test per acceptance criterion. Pure: no database.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MARKS } from '../scripts/compliance.ts';
import { allCopy, HIDDEN_NOTICE, HIDDEN_OWN, PRODUCT_NAME, RETIRED_NOTICE, TAKEDOWN, TRUST_LINE } from './copy.ts';
import { impersonationLineShown, takedownContact, takedownReachable } from './takedown.ts';
import { gateState } from './launch-gate.ts';
import { REPORT_CATEGORIES } from './report-copy.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const MARK_RE = new RegExp(`\\b(${MARKS.map((m) => m.replace(/ /g, '[\\s-]?')).join('|')})\\b`, 'i');
const LEGAL_CLAIM = /safe harbou?r|designated agent|\b512\b|within \d+ (hours?|days?)|business days?/i;
const ADDRESS = /[\w.+-]+@[\w-]+\.[a-z]{2,}/i;
const HIDDEN_WORDS = /report|review/i;

// The launch gate's three states, as env combinations (lib/launch-gate.ts).
const SANDBOX = { NODE_ENV: 'test' };
const SANDBOX_PROD = { NODE_ENV: 'production', ALLOW_DEV_AUTH: '1', SNAPTRADE_BASE_URL: 'http://127.0.0.1:4102', SNAPTRADE_CLIENT_ID: 'e2e' };
const CLOSED = { NODE_ENV: 'production', SNAPTRADE_CLIENT_ID: 'real' };
const CLOSED_DEV = { NODE_ENV: 'production', ALLOW_DEV_AUTH: '1', SNAPTRADE_CLIENT_ID: 'real' }; // admits allowlisted real accounts
const OPEN = { NODE_ENV: 'production', LAUNCH_OPEN: '1', SNAPTRADE_CLIENT_ID: 'real' };
const CONTACT = { TAKEDOWN_CONTACT: 'notices@example.com' };

test('AC-F16-13 takedown: reachable in the sandbox; on a deploy that admits real users only once approved and a role mailbox is set', () => {
  assert.equal(gateState(SANDBOX), 'sandbox');
  assert.equal(gateState(SANDBOX_PROD), 'sandbox');
  assert.equal(gateState(CLOSED), 'closed');
  assert.equal(gateState(CLOSED_DEV), 'closed');
  assert.equal(gateState(OPEN), 'open');
  // Draft (the repo's state): the sandbox only.
  assert.equal(takedownReachable(SANDBOX, false), true);
  assert.equal(takedownReachable(SANDBOX_PROD, false), true);
  for (const env of [CLOSED, CLOSED_DEV, OPEN]) {
    assert.equal(takedownReachable(env, false), false, JSON.stringify(env));
    assert.equal(takedownReachable({ ...env, ...CONTACT }, false), false, JSON.stringify(env));
    // Approved: still needs the contact, and a contact that is an address.
    assert.equal(takedownReachable(env, true), false, JSON.stringify(env));
    assert.equal(takedownReachable({ ...env, TAKEDOWN_CONTACT: '   ' }, true), false);
    assert.equal(takedownReachable({ ...env, TAKEDOWN_CONTACT: 'not an address' }, true), false);
    assert.equal(takedownReachable({ ...env, ...CONTACT }, true), true, JSON.stringify(env));
  }
  // The default reads the repo's constant: draft.
  assert.equal(TAKEDOWN.approved, false);
  assert.equal(takedownReachable({ ...OPEN, ...CONTACT }), false);
  assert.equal(takedownReachable({ ...CLOSED, ...CONTACT }), false);
  assert.equal(takedownContact({ TAKEDOWN_CONTACT: ' notices@example.com ' }), 'notices@example.com');
  assert.equal(takedownContact({}), null);
});

test('AC-F16-13 takedown: own title, draft banner, no legal-status claim, agent or reply time, no address in the code', () => {
  assert.equal(TAKEDOWN.title, `Notices and takedown requests · ${PRODUCT_NAME}`);
  assert.match(TAKEDOWN.draft, /^Draft: /);
  const words = [TAKEDOWN.h1, TAKEDOWN.draft, TAKEDOWN.contactTitle, TAKEDOWN.unset, TAKEDOWN.link, ...TAKEDOWN.lines].join(' ');
  assert.doesNotMatch(words, LEGAL_CLAIM);
  assert.doesNotMatch(words, MARK_RE);
  assert.doesNotMatch(words, ADDRESS);
  for (const f of ['app/takedown/page.tsx', 'lib/takedown.ts']) {
    const src = code(read(f));
    assert.doesNotMatch(src, LEGAL_CLAIM, f);
    assert.doesNotMatch(src, ADDRESS, f); // the contact is env only (POLICY P1)
  }
  const page = read('app/takedown/page.tsx');
  assert.match(page, /if \(!takedownReachable\(\)\) notFound\(\);/);
  assert.match(page, /\{!TAKEDOWN\.approved && <p role="note"/);
  assert.match(page, /export const dynamic = 'force-dynamic'/);
  assert.match(read('.env.example'), /^TAKEDOWN_CONTACT=$/m);
});

test('AC-F16-14 line: the agreed wording, the product name as plain text, no platform, nothing about identity; draft until the owner flips it', () => {
  assert.equal(TRUST_LINE.text, `${PRODUCT_NAME} never messages anyone about a trading record. Anyone who contacts you elsewhere using this profile isn't acting for ${PRODUCT_NAME}.`);
  assert.equal(TRUST_LINE.approved, false);
  assert.equal(TRUST_LINE.text.split(PRODUCT_NAME).length - 1, 2);
  assert.doesNotMatch(TRUST_LINE.text, MARK_RE);
  assert.doesNotMatch(TRUST_LINE.text, /verif|identity|confirmed|real person|official/i);
  // Shown: approved, or the sandbox while it is a draft.
  assert.equal(impersonationLineShown(SANDBOX, false), true);
  assert.equal(impersonationLineShown(SANDBOX_PROD, false), true);
  for (const env of [CLOSED, CLOSED_DEV, OPEN]) {
    assert.equal(impersonationLineShown(env, false), false);
    assert.equal(impersonationLineShown(env, true), true);
    assert.equal(impersonationLineShown(env), false); // the repo's constant
  }
});

// Every local module an entry file reaches (relative and @/ imports).
function graph(entry: string): Set<string> {
  const seen = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const m of read(file).matchAll(/\bfrom\s+['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const spec = m[1] ?? m[2];
      const base = spec.startsWith('@/') ? join(ROOT, spec.slice(2)) : spec.startsWith('.') ? resolve(join(ROOT, dirname(file)), spec) : null;
      if (!base) continue;
      const hit = [base, `${base}.ts`, `${base}.tsx`].find((p) => existsSync(p) && /\.tsx?$/.test(p));
      if (hit) visit(hit.slice(ROOT.length + 1));
    }
  };
  visit(entry);
  return seen;
}

test('AC-F16-14 line: no image route reaches TrustFoot or TRUST_LINE (record card, link previews, story, month and stock images)', () => {
  const images = ['app/u/[handle]/opengraph-image.tsx', 'app/u/[handle]/trade/[sellId]/opengraph-image.tsx', 'app/u/[handle]/month/[ym]/opengraph-image.tsx',
    'app/u/[handle]/story/route.tsx', 'app/t/[symbol]/opengraph-image.tsx', 'app/home-card/route.tsx'];
  for (const img of images) {
    const files = graph(img);
    assert.ok(files.size > 1, img);
    assert.ok(!files.has('app/trust-foot.tsx'), `${img} reaches app/trust-foot.tsx`);
    for (const f of files) if (f !== 'lib/copy.ts') assert.doesNotMatch(code(read(f)), /\bTRUST_LINE\b|\bTrustFoot\b/, `${img} → ${f}`);
  }
  // The line lives in one component; the profile and the two pane mounts use it, app/pane.tsx is untouched (B1).
  assert.doesNotMatch(read('app/pane.tsx'), /trust-foot|TrustFoot|TRUST_LINE/);
  assert.match(read('app/feed-rows.tsx'), /\{paneOf\(t\)\}<TrustFoot inPane shown=\{trustShown\} \/>/);
  // Sheets: the line without its own disclaimer copy, the sheet's .sheet-note (POLICY F3) follows the pane directly.
  assert.match(read('app/feed-rows.tsx'), /<TrustFoot inPane shown=\{trustShown\} disclaimer=\{false\} \/>/);
  assert.match(read('app/lazy-pane.tsx'), /<TrustFoot inPane disclaimer=\{false\} \/>/);
  for (const f of ['app/suggest-section.tsx', 'app/u/[handle]/similar-section.tsx']) assert.match(read(f), /<p className="muted small sheet-note" tabIndex=\{-1\}>\{DISCLAIMER\}<\/p>/, f);
  // The pane foot carries the F3 disclaimer directly under the line.
  const foot = read('app/trust-foot.tsx');
  assert.match(foot, /<p className="muted small" data-trust-line>\{TRUST_LINE\.text\}<\/p>\s*\{disclaimer && <p className="muted small" data-trust-disclaimer>\{DISCLAIMER\}<\/p>\}/);
});

test('AC-F16-14 / B6 profile: the line is the last thing in <main>; the quiet menu sits with it, never beside Follow or Share, and not on your own profile', () => {
  const page = code(read('app/u/[handle]/page.tsx'));
  assert.match(page, /<div className="f16-block">\s*\{!isMe && <ProfileReportMenu handle=\{user\.handle\} \/>\}\s*<TrustFoot shown=\{trustShown\} \/>\s*<\/div>\s*<\/main>/);
  assert.equal(page.match(/<ProfileReportMenu\b/g)?.length, 1);
  // Not gated on a session: the menu shows signed out too (B6).
  assert.doesNotMatch(page, /me && !isMe && <ProfileReportMenu/);
  for (const near of ['<FollowButton', '<SharePrompt', '<ShareCard']) {
    const i = page.indexOf(near);
    assert.ok(i > 0 && Math.abs(page.indexOf('<ProfileReportMenu') - i) > 2000, near);
  }
  const foot = read('app/trust-foot.tsx');
  assert.match(foot, /href=\{`\/u\/\$\{encodeURIComponent\(handle\)\}\/report`\}>\{PROFILE_REPORT_COPY\.menu\}<\/Link>/);
});

test('AC-F16-10 hidden and retired notices and the hidden trader\'s private line: neutral words only, in the copy scan', () => {
  for (const s of [HIDDEN_NOTICE.title, HIDDEN_NOTICE.h1, HIDDEN_NOTICE.line, RETIRED_NOTICE.title, RETIRED_NOTICE.h1, RETIRED_NOTICE.line, HIDDEN_OWN.line, HIDDEN_OWN.settings]) {
    assert.doesNotMatch(s, HIDDEN_WORDS, s);
    assert.ok(allCopy().includes(s), s);
  }
  assert.match(HIDDEN_OWN.line, /not shown to others right now/);
  for (const s of [TRUST_LINE.text, TAKEDOWN.draft, ...TAKEDOWN.lines]) assert.ok(allCopy().includes(s), s);
  // The private line renders only for the signed-in hidden trader on their own handle, with the settings link.
  const nf = code(read('app/u/[handle]/not-found.tsx'));
  assert.match(nf, /if \(s !== 'hidden'\) return false;/);
  assert.match(nf, /\{own && <p className="muted" data-own-line>\{HIDDEN_OWN\.line\} <Link className="tap44" href="\/settings">/);
  assert.doesNotMatch(nf, /report|review/i);
});

test('AC-F16-6 / K18 report form: one fieldset of six labelled radios from REPORT_CATEGORIES, no free text', () => {
  assert.equal(REPORT_CATEGORIES.length, 6);
  const labels = REPORT_CATEGORIES.map((c) => c.label) as string[];
  assert.ok(labels.includes('Impersonating this trader elsewhere'));
  assert.ok(labels.includes('May be under 18'));
  const form = code(read('app/u/[handle]/report/report-form.tsx'));
  assert.equal(form.match(/<fieldset>/g)?.length, 1);
  assert.match(form, /<legend>\{C\.legend\}<\/legend>/);
  assert.match(form, /REPORT_CATEGORIES\.map/);
  assert.match(form, /<input type="radio" id=\{`report-\$\{c\.code\}`\} name="category"/);
  assert.match(form, /<label htmlFor=\{`report-\$\{c\.code\}`\}>\{c\.label\}<\/label>/);
  assert.doesNotMatch(form, /<textarea|type="text"|contentEditable/);
  // The error sits between the legend and the first radio, is an alert, and every radio is described by it.
  assert.match(form, /<legend>\{C\.legend\}<\/legend>\s*\{invalid && <p id="report-err" role="alert"/);
  assert.match(form, /aria-invalid=\{invalid \|\| undefined\} aria-describedby=\{describedBy\}/);
  assert.match(form, /<p role="status" tabIndex=\{-1\} ref=\{status\}/);
  const page = code(read('app/u/[handle]/report/page.tsx'));
  assert.equal(page.match(/<h1>/g)?.length, 1);
  assert.match(page, /robots: \{ index: false, follow: false \}/);
});

test('E16 / F-17 rename form: the "New handle" label is visible, and a rejection is the field\'s next sibling with aria-invalid', () => {
  const page = code(read('app/u/[handle]/page.tsx'));
  assert.match(page, /<label htmlFor="new-handle">New handle<\/label>/);
  assert.doesNotMatch(page, /<label htmlFor="new-handle" className="sr-only">/);
  assert.match(page, /aria-invalid=\{handleError \? true : undefined\} \/>\s*\{handleError && <p id="handle-err" role="alert"/);
  assert.match(page, /\{RENAME_RULE\}/);
});
