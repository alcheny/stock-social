// A11Y-FIXES (approval council fixes #8 and #11, committee demand B3): product copy carries no completeness claim and
// none of POLICY F1a's banned words. Scans string literals (tagged `sql` templates skipped) and JSX text in app/** and
// lib/** (tests excluded), never comments or identifiers. Matches use word boundaries. An allow-list entry passes
// whether its text is present or absent, so another session's PR never turns this test red when it lands its rewrite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jsxText, lex } from './source-lex.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

export const BANNED: readonly RegExp[] = [
  /\bevery trade\b/i, /\ball of their trades\b/i, /\bfull record\b/i, /\bwhole record\b/i, /\bevery record\b/i,
  /\bonly percentages\b/i, /\bsignal\b/i, /\bpick\b/i,
];

// file (relative, posix) + a substring of the flagged text + who owns the rewrite.
const ALLOW: readonly { file: string; text: string; why: string }[] = [
  { file: 'app/u/[handle]/trade/[sellId]/page.tsx', text: 'Their whole record', why: 'F-4 #35 owns the record block (committee Q1)' },
  { file: 'app/u/[handle]/month/[ym]/page.tsx', text: 'Their whole record', why: 'F-4 #35 owns the record block (committee Q1)' },
  { file: 'lib/month-card.ts', text: 'Whole record:', why: 'F-4 #35 owns the month image' },
  { file: 'app/u/[handle]/chart.tsx', text: 'if every trade were the same size', why: 'CH-1 equal-weight caption: a hypothetical, not a completeness claim' },
  { file: 'lib/copy.ts', text: 'If every trade were the same size', why: 'CH-1 equal-weight caption (share card): a hypothetical' },
  { file: 'lib/copy.ts', text: 'Only percentages are stored and shown', why: '/how math line; asserted by lib/copy.test.ts and e2e/connect.spec.ts; follow-up for its owner' },
  { file: 'lib/confidence.ts', text: 'signal', why: 'TRUST_BANNED, a list of banned words' },
  { file: 'lib/ticker.ts', text: 'Pick two different stocks', why: 'committee Q4: only COMPARE_COPY.pick changes here; the labels session owns the rest' },
];

function files(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) files(p, out);
    else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const decode = (s: string) => s.replace(/&apos;|&rsquo;/g, '\'').replace(/&ldquo;|&rdquo;/g, '"').replace(/\s+/g, ' ');

export function hits(rel: string, src: string): string[] {
  const { literals, code } = lex(src);
  const pieces = [...literals, ...(rel.endsWith('.tsx') ? jsxText(code) : [])];
  const out: string[] = [];
  for (const p of pieces) {
    const text = decode(p.text);
    for (const re of BANNED) {
      if (!re.test(text)) continue;
      if (ALLOW.some((a) => a.file === rel && text.includes(a.text))) continue;
      const line = src.slice(0, p.at).split('\n').length;
      out.push(`${rel}:${line} ${re} in "${text.trim().slice(0, 120)}"`);
    }
  }
  return out;
}

test('A11Y-FIXES copy guard: no completeness claims or banned words in product copy (word boundaries)', () => {
  const all: string[] = [];
  for (const dir of ['app', 'lib']) for (const f of files(join(ROOT, dir))) {
    const rel = relative(ROOT, f).split('\\').join('/');
    all.push(...hits(rel, readFileSync(f, 'utf8')));
  }
  assert.deepEqual(all, []);
});

test('A11Y-FIXES copy guard: the scanner sees literals and JSX text, never comments, identifiers or sql', () => {
  const src = [
    "// every trade in a comment",
    "const pick = (a: Pick<X, 'k'>) => a; signal.abort();",
    "const q = sql`select 1 as pick`;",
    "const a = 'Pick two stocks';",
    "const b = `see the ${x} full record`;",
    "const r = /every record/;",
    "export const C = () => <p>Read-only. <b>x</b> @{h}&apos;s whole record</p>;",
  ].join('\n');
  const h = hits('x.tsx', src);
  assert.equal(h.length, 3, h.join('\n'));
  assert.ok(h.some((s) => s.startsWith('x.tsx:4 ') && s.includes('pick')), h.join('\n'));
  assert.ok(h.some((s) => s.startsWith('x.tsx:5 ') && s.includes('full record')), h.join('\n'));
  assert.ok(h.some((s) => s.startsWith('x.tsx:7 ') && s.includes('whole record')), h.join('\n'));
  assert.deepEqual(hits('x.tsx', 'const s = "every trader";'), []);
  assert.deepEqual(hits('x.tsx', 'const s = "picks and signals";'), []);
});

test('A11Y-FIXES copy guard: an allow-listed entry passes whether present or absent', () => {
  for (const a of ALLOW) {
    assert.deepEqual(hits(a.file, `const s = ${JSON.stringify(a.text)};`), [], a.file);
    assert.deepEqual(hits(a.file, 'const s = "nothing here";'), []);
    assert.ok(a.why.length > 0);
  }
});
