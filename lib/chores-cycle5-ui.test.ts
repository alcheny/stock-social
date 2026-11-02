// Chores cycle 5, UI slice (docs/ideas/approval-2026-11-01-cycle5.md → Routed, chore lane): C5-39 arrows out of
// accessible names, C5-38 the pressed range tab in forced colours, C5-36 (narrowed) two Settings copy lines, C5-37
// (narrowed) one "Legal" landmark on /account. The rendered checks are in e2e/chores-cycle5-ui.spec.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lex } from './source-lex.ts';
import { splitArrow } from './arrow.ts';
import * as COPY from './copy.ts';
import { BILLING } from './copy.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const tsx = (dir: string, out: string[] = []): string[] => {
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) tsx(p, out); else if (e.name.endsWith('.tsx')) out.push(p);
  }
  return out;
};
const ARROW = /[←→]/;

test('C5-39: splitArrow keeps the drawn text exactly and separates a leading or trailing arrow from the words', () => {
  for (const [s, lead, words, trail] of [
    ['← Back', '← ', 'Back', ''],
    ['Trade page →', '', 'Trade page', ' →'],
    ['See their record, wins and losses →', '', 'See their record, wins and losses', ' →'],
    ['Request a correction or removal →', '', 'Request a correction or removal', ' →'],
    ['Back to the feed', '', 'Back to the feed', ''],
  ] as const) {
    const r = splitArrow(s);
    assert.deepEqual(r, { lead, words, trail }, s);
    assert.equal(r.lead + r.words + r.trail, s);
    assert.doesNotMatch(r.words, ARROW, s);
  }
});

test('C5-39: every arrow glyph drawn in app/ JSX sits in an aria-hidden span, outside the link or button name', () => {
  const bad: string[] = [];
  for (const f of tsx('app')) {
    // lex() blanks comments and string literals in place (same offsets), so the raw aria-hidden spans are cut by position.
    const src = read(f);
    let code = lex(src).code;
    for (const m of src.matchAll(/<span aria-hidden="true">[^<]*<\/span>/g)) code = code.slice(0, m.index) + ' '.repeat(m[0].length) + code.slice(m.index + m[0].length);
    code.split('\n').forEach((l, i) => { if (ARROW.test(l)) bad.push(`${relative(ROOT, join(ROOT, f))}:${i + 1}`); });
  }
  assert.deepEqual(bad, []);
});

test('C5-39: a copy constant that carries an arrow is never rendered bare inside a link or button: it goes through <Arrowed>', () => {
  const arrowed: string[] = [];
  for (const [name, v] of Object.entries(COPY)) {
    if (v && typeof v === 'object') for (const [k, s] of Object.entries(v as Record<string, unknown>)) if (typeof s === 'string' && ARROW.test(s)) arrowed.push(`${name}.${k}`);
  }
  for (const want of ['SIGNIN.back', 'SIMILAR.trade', 'HIDDEN_TRADES.trade', 'PUBLIC.correction']) assert.ok(arrowed.includes(want), want);
  const bad: string[] = [];
  for (const f of tsx('app')) {
    const code = lex(read(f)).code;
    for (const c of arrowed) {
      const bare = new RegExp(`>\\s*\\{${c.replace('.', '\\.')}\\}\\s*</(Link|a|button|summary)>`);
      if (bare.test(code)) bad.push(`${f}: ${c}`);
    }
  }
  assert.deepEqual(bad, []);
  assert.match(read('app/arrow.tsx'), /<span aria-hidden="true">\{lead\}<\/span>/);
  assert.match(read('app/arrow.tsx'), /<span aria-hidden="true">\{trail\}<\/span>/);
});

test('C5-38: in forced colours the pressed range tab gets a currentColor border, the tab keeps its size, no colour literal', () => {
  const css = read('app/globals.css');
  const m = /@media \(forced-colors: active\) \{ \.tabs button\[aria-pressed="true"\] \{ ([^}]*) \} \}/.exec(css);
  assert.ok(m, 'forced-colors rule for the pressed tab');
  assert.match(m[1], /border: 2px solid currentColor;/);
  assert.match(m[1], /padding: 4px 10px;/); // 6px 12px less the 2px border
  assert.match(css, /\.tabs button \{ background: none; color: var\(--muted\); padding: 6px 12px;/);
});

test('C5-36 (narrowed): Settings names Record tools once, as its link; the "Thesis held" ruling is untouched', () => {
  const page = read('app/settings/page.tsx');
  assert.equal(page.match(/\{RECORD_TOOLS\.title\}/g)?.length, 1);
  assert.match(page, /<p><Link href="\/tools">\{RECORD_TOOLS\.title\}<\/Link><\/p>/);
  assert.doesNotMatch(page, /<h2>\{RECORD_TOOLS\.title\}<\/h2>/);
  assert.match(page, /<p><Link href="\/account">\{RECORD_TOOLS\.account\}<\/Link><\/p>/);
});

test('C5-36 (narrowed): the delete screen\'s notes line drops "if you publish" and still shows only when it applies', () => {
  assert.equal(BILLING.deleteNotes, "Other subscribers' private notes about you are deleted and you are removed from their saved views.");
  assert.doesNotMatch(BILLING.deleteNotes, /if you publish/i);
  assert.match(read('app/settings/page.tsx'), /\{await notesLineApplies\(me\.id\) && <p className="muted">\{BILLING\.deleteNotes\}<\/p>\}/);
});

test('C5-37 (narrowed): the one Disclaimer component has no "Legal" landmark; /account uses its muted variant, /tools the bold one', () => {
  const parts = read('app/tools/parts.tsx');
  const fn = parts.slice(parts.indexOf('export function Disclaimer'), parts.indexOf('export const TestModeLabel'));
  assert.doesNotMatch(fn, /<nav\b|aria-label="Legal"/);
  for (const href of ['/terms', '/privacy', '/how']) assert.match(fn, new RegExp(`<Link href="${href}">`));
  assert.match(fn, /\{DISCLAIMER\}/);
  assert.match(read('app/account/page.tsx'), /<Disclaimer muted\b/);
  assert.equal(read('app/account/page.tsx').match(/<Disclaimer\b/g)?.length, 1);
  assert.doesNotMatch(read('app/tools/page.tsx'), /<Disclaimer muted/);
  assert.match(read('app/layout.tsx'), /<nav className="legal" aria-label="Legal">/); // the site footer keeps the one landmark
});
