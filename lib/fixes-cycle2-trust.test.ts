// Approval council cycle 2, trust rows: source-level checks for fixes #4, #5, #8, #11, #24 and #27 (behaviour is in the
// e2e specs and lib/visible-users.db.test.ts, lib/stock-labels.test.ts, lib/referral-nav.test.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACCOUNT_CLAIMED_BODY, ACCOUNT_CLAIMED_TITLE } from './claims.ts';
import { COMPARE_COPY } from './ticker.ts';
import { PUBLIC_SHORT } from './copy.ts';
import { PUBLIC_FIELDS } from './privacy-fields.ts';
import { STOCK_LABELS } from './stock-labels.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = (f: string) => readFileSync(`${root}${f}`, 'utf8');
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

test('fix #4: every closed_trades / open_positions read on stock surfaces and the sitemap uses the visible-user predicate', () => {
  const files = [...walk(`${root}app/t`).filter((f) => /\.tsx?$/.test(f)), `${root}app/sitemap.ts`];
  let reads = 0;
  for (const f of files) {
    const s = readFileSync(f, 'utf8');
    // Each sql`...` statement on its own.
    for (const m of s.matchAll(/sql`([^`]*)`/g)) {
      const q = m[1];
      if (!/\bfrom (closed_trades|open_positions)\b/.test(q)) continue;
      reads++;
      assert.match(q, /\$\{visibleUser(Ids\(\)|\('[a-z]+'\))\}/, `${f}: ${q.trim().slice(0, 80)}…`);
    }
  }
  assert.ok(reads >= 9, `found ${reads} reads`);
});

test('fix #5: no surface says only percentages are public; the share prompt names every public field', () => {
  assert.doesNotMatch(src('app/u/[handle]/join-cta.tsx'), /only percentages|percentages only/i);
  assert.doesNotMatch(PUBLIC_SHORT.join, /only percentages|percentages only|public:/i);
  assert.match(src('app/u/[handle]/join-cta.tsx'), /PUBLIC_SHORT\.join/);
  const line = PUBLIC_SHORT.sharePrompt(PUBLIC_FIELDS.map((f) => f.words));
  for (const f of PUBLIC_FIELDS) assert.ok(line.includes(f.words), f.words);
  for (const w of ['handle', 'display name', 'reasons']) assert.ok(line.includes(w), w);
  assert.match(src('app/u/[handle]/share-prompt.tsx'), /PUBLIC_SHORT\.sharePrompt\(PUBLIC_FIELDS/);
  assert.doesNotMatch(STOCK_LABELS.explainer, /percentages only/i);
});

test('fix #8: no completeness claims in the stock index or the account-claimed copy', () => {
  const claim = /\bevery (record|stock|trade)\b|\bthe only\b|\bwhole record\b|\bfull record\b/i;
  assert.doesNotMatch(`${ACCOUNT_CLAIMED_TITLE} ${ACCOUNT_CLAIMED_BODY}`, claim);
  assert.doesNotMatch(src('app/t/page.tsx').replace(/\/\/.*$/gm, ''), claim);
  assert.doesNotMatch(src('app/t/page.tsx'), /Browse every/);
});

test('fix #11: no "pick" or "signal" in the copy of these surfaces (POLICY F1a)', () => {
  for (const v of Object.values(COMPARE_COPY)) {
    const s = typeof v === 'function' ? (v as (...a: unknown[]) => string)('A', 'B', 'C') : v;
    assert.doesNotMatch(String(s), /\b(pick|signal)/i, String(s));
  }
  for (const f of ['app/t/[symbol]/HoldTime.tsx', 'app/me/record/page.tsx', 'app/t/compare/page.tsx']) {
    const copy = [...src(f).matchAll(/'([^'\n]*)'|`([^`\n]*)`|>([^<>{}\n]+)</g)].map((m) => m[1] ?? m[2] ?? m[3]).join('\n');
    assert.doesNotMatch(copy, /\b(pick|signal)/i, f);
  }
});

test('fix #24: the compare evidence line says "too early" once', () => {
  const s = src('app/t/compare/page.tsx');
  assert.doesNotMatch(s, /COMPARE_COPY\.tooEarly/);
  assert.match(s, /<p style=\{\{ margin: 0 \}\}>\{evidenceLine\(c\)\}<\/p>/);
});

test('fix #27: share_image_saved_at is labelled for what the Share my record button records', () => {
  const schema = src('db/schema.sql');
  const comment = schema.split('\n').filter((l, i, a) => a[i + 1]?.includes("'share_image_saved_at'") || a[i + 2]?.includes("'share_image_saved_at'")).join(' ');
  assert.match(comment, /Share my record/);
  assert.doesNotMatch(comment, /on the owner's first click of a Save image link/);
  assert.match(src('app/actions.ts'), /first completed share of the record from the profile's "Share my record" button/);
});

test('fix #19: a flat figure is uncolored on the stock pages, compare, likes and /me/record', async () => {
  const { tone } = await import('./open-split.ts');
  // toneClass (app/open-rows.tsx) is tone() with 'flat' as no class: check the rule it reads.
  assert.equal(tone(0), 'flat');
  assert.equal(tone(-0.0004), 'flat'); // prints "0.0%": never painted as a loss
  assert.equal(tone(0.0004), 'flat');
  assert.equal(tone(-0.0006), 'down');
  assert.equal(tone(0.0006), 'up');
  assert.match(src('app/open-rows.tsx'), /export const toneClass = \(x: number\) => \{ const t = tone\(x\); return t === 'flat' \? undefined : t; \};/);
  for (const f of ['app/t/[symbol]/page.tsx', 'app/t/[symbol]/Theses.tsx', 'app/t/compare/page.tsx', 'app/me/likes/page.tsx']) {
    assert.doesNotMatch(src(f), /> 0 \? 'up' : 'down'/, f);
    assert.match(src(f), /toneClass\(/, f);
  }
  assert.match(src('app/me/record/page.tsx'), /const sign = toneClass;/);
});
