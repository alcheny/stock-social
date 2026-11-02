// FIXES-CYCLE5 WP4 focus and timing (source checks; the browser behaviour is in e2e/fixes-cycle5-a11y.spec.ts):
// F5-21 (the hide bar waits 20 s and pauses for the reader), F5-22 (rule forms keep focus and say what changed), F5-23
// (delete step 1 focuses its alert), F5-19 (no X-Powered-By).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = (f: string) => readFileSync(join(root, f), 'utf8');
const walk = (d: string): string[] => readdirSync(join(root, d)).flatMap((f) => {
  const p = join(d, f);
  return statSync(join(root, p)).isDirectory() ? walk(p) : /\.tsx?$/.test(f) ? [p] : [];
});

test('F5-22: no "tap to clear" under app/', () => {
  for (const f of walk('app')) assert.doesNotMatch(src(f), /tap to clear/i, f);
});

test('F5-22: setRule redirects to its card with a fixed kind and verb; the card focuses its h3 under a status line', () => {
  const a = src('app/actions.ts');
  const set = a.slice(a.indexOf('export async function setRule'), a.indexOf('export async function reportNote'));
  assert.match(set, /redirect\(`\/me\/record\?rule=\$\{c\.kind\}&did=\$\{c\.days === null \? 'clear' : 'set'\}#rule-\$\{c\.kind\}`\)/);
  assert.match(set, /checkRule\(/, 'the kind is checked (isRuleKind) before it reaches the URL');
  const page = src('app/me/record/page.tsx');
  assert.match(page, /isRuleKind\(sp\.rule\) && \(sp\.did === 'set' \|\| sp\.did === 'clear'\)/);
  assert.match(page, /<section key=\{kind\} id=\{`rule-\$\{kind\}`\}/);
  assert.match(page, /<h3 id=\{`rule-\$\{kind\}-h`\} tabIndex=\{-1\}>/);
  assert.match(page, /<p role="status" className="small">\{done\.did === 'set' \? FC5\.ruleSet\(label\) : FC5\.ruleCleared\}<\/p>\s*<FocusHeading id=\{`rule-\$\{kind\}-h`\} \/>/);
});

test('F5-23: delete step 1 focuses its alert, never the delete button', () => {
  const s = src('app/settings/page.tsx');
  assert.match(s, /<p id="delete-confirm" role="alert" tabIndex=\{-1\}><b>\{SETTINGS\.confirm\}<\/b><\/p>\s*<FocusHeading id="delete-confirm" \/>/);
  assert.doesNotMatch(s, /autoFocus/);
});

test('F5-21: the hide bar waits HIDE_UNDO_MS = 20 s; the follow bar keeps UNDO_MS = 5 s', () => {
  const h = src('app/feed-hides.tsx');
  assert.match(h, /export const HIDE_UNDO_MS = 20_000;/);
  assert.match(h, /window\.setTimeout\(close, HIDE_UNDO_MS\)/);
  assert.doesNotMatch(h, /import \{[^}]*\bUNDO_MS\b/, 'the hide bar no longer uses the follow bar limit');
  assert.match(src('app/follow-button.tsx'), /export const UNDO_MS = 5_000;/);
});

test('F5-21: pause on pointer over or pressed, or a focusin the bar did not make; Dismiss (44 px) closes onto the next card', () => {
  const h = src('app/feed-hides.tsx');
  assert.match(h, /const paused = \(\) => hover\.current \|\| pressed\.current \|\| engaged\.current;/);
  assert.match(h, /onFocus=\{\(\) => \{ if \(selfFocus\.current\) return; engaged\.current = true; pause\(\); \}\}/);
  assert.match(h, /selfFocus\.current = true;[^\n]*\n\s*undoBtn\.current\.focus\(\{ preventScroll: true \}\);\n\s*selfFocus\.current = false;/);
  assert.match(h, /style=\{\{ minHeight: 44, minWidth: 44 \}\} onClick=\{\(\) => \{ clearTimeout\(timer\.current\); setBar\(null\); toCard\(\); \}\}>\{FC5\.dismiss\}<\/button>/);
  assert.doesNotMatch(h, /e\.key === 'Tab'/, 'Tab moves through the bar and out; it no longer closes it');
  assert.doesNotMatch(h, /:focus-visible/);
});

test('F5-21: /me/hidden focuses its status line after Show again', () => {
  const s = src('app/me/hidden/page.tsx');
  assert.match(s, /<p id="hidden-back" role="status" className="follow-status" tabIndex=\{back \? -1 : undefined\}>/);
  assert.match(s, /\{back && <FocusHeading id="hidden-back" \/>\}/);
});

test('F5-19: next.config.ts turns the X-Powered-By header off', () => {
  assert.match(src('next.config.ts'), /^\s*poweredByHeader: false,$/m);
});
