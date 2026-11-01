// Approval council cycle 2, trust rows (BUILD NOW set after the orchestrator's re-scope): source-level checks for
// fixes #4, #5, #8, #11, #19, #21, #27 and #30 (behaviour: lib/visible-users.db.test.ts, lib/referral-nav.test.ts and
// e2e/fixes-cycle2-trust.spec.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACCOUNT_CLAIMED_BODY, ACCOUNT_CLAIMED_TITLE } from './claims.ts';
import { COMPARE_COPY } from './ticker.ts';
import { PUBLIC_SHORT } from './copy.ts';
import { PUBLIC_FIELDS } from './privacy-fields.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = (f: string) => readFileSync(`${root}${f}`, 'utf8');
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

// ponytail: these stock files still read closed_trades / open_positions with their own `deleted_at is null` or none —
// fix: the follow-up after claude/fix-truthful-labels merges moves them onto lib/visible-users.ts and empties this list.
const PENDING_VISIBLE = ['app/t/compare/page.tsx', 'app/t/[symbol]/opengraph-image.tsx', 'app/t/open-positions.ts'];

test('fix #4: every closed_trades / open_positions read on the stock pages, index and sitemap uses the visible-user predicate', () => {
  // lib/sitemaps.ts: the sitemaps' reads (known limits PR #52 moved them out of app/sitemap.ts to page past 5,000 symbols).
  const files = [...walk(`${root}app/t`).filter((f) => /\.tsx?$/.test(f)), `${root}app/sitemap.ts`, `${root}lib/sitemaps.ts`]
    .filter((f) => !PENDING_VISIBLE.includes(relative(root, f)));
  let reads = 0;
  for (const f of files) {
    for (const m of readFileSync(f, 'utf8').matchAll(/sql`([^`]*)`/g)) {
      const q = m[1];
      if (!/\bfrom (closed_trades|open_positions)\b/.test(q)) continue;
      reads++;
      // One use per statement: the overlap query's outer rows come from its filtered subquery.
      assert.match(q, /\$\{visibleUser(Ids\(\)|\('[a-z]+'\))\}/, `${relative(root, f)}: ${q.trim().slice(0, 80)}…`);
    }
  }
  assert.ok(reads >= 7, `found ${reads} reads`);
  // A pending file that adopts the predicate must leave the list (so the list never hides a regression).
  for (const f of PENDING_VISIBLE) assert.doesNotMatch(readFileSync(`${root}${f}`, 'utf8'), /visibleUser/, `${f} uses the predicate: remove it from PENDING_VISIBLE`);
});

test('fix #5: no surface says only percentages are public; the share prompt names every public field', () => {
  assert.doesNotMatch(src('app/u/[handle]/join-cta.tsx'), /only percentages|percentages only/i);
  assert.doesNotMatch(PUBLIC_SHORT.join, /only percentages|percentages only|public:/i);
  assert.match(src('app/u/[handle]/join-cta.tsx'), /PUBLIC_SHORT\.join/);
  const line = PUBLIC_SHORT.sharePrompt(PUBLIC_FIELDS.map((f) => f.words));
  for (const f of PUBLIC_FIELDS) assert.ok(line.includes(f.words), f.words);
  for (const w of ['handle', 'display name', 'reasons']) assert.ok(line.includes(w), w);
  assert.doesNotMatch(line, /only percentages|percentages only/i);
  assert.match(line, /, and your current open positions with unrealized percent\. Losses are included\./); // user test: reads as one list
  assert.doesNotMatch(line, /;/);
  assert.match(src('app/u/[handle]/share-prompt.tsx'), /PUBLIC_SHORT\.sharePrompt\(PUBLIC_FIELDS/);
});

test('fix #8: no completeness claim in the account-claimed copy', () => {
  assert.doesNotMatch(`${ACCOUNT_CLAIMED_TITLE} ${ACCOUNT_CLAIMED_BODY}`, /\bevery (record|stock|trade)\b|\bthe only\b|\bwhole record\b|\bfull record\b/i);
});

test('fix #11: no "pick" or "signal" in compare copy or /me/record (POLICY F1a)', () => {
  for (const v of Object.values(COMPARE_COPY)) {
    const s = typeof v === 'function' ? (v as (...a: unknown[]) => string)('A', 'B', 'C') : v;
    assert.doesNotMatch(String(s), /\b(pick|signal)/i, String(s));
  }
  const copy = [...src('app/me/record/page.tsx').matchAll(/'([^'\n]*)'|`([^`\n]*)`|>([^<>{}\n]+)</g)].map((m) => m[1] ?? m[2] ?? m[3]).join('\n');
  assert.doesNotMatch(copy, /\b(pick|signal)/i);
});

test('fix #19: a flat figure is uncolored on /me/likes and /me/record', async () => {
  const { tone } = await import('./format.ts');
  // toneClass (app/open-rows.tsx) is tone() with 'flat' as no class: check the rule it reads.
  assert.equal(tone(0), 'flat');
  assert.equal(tone(-0.0004), 'flat'); // prints "0.0%": never painted as a loss
  assert.equal(tone(0.0004), 'flat');
  assert.equal(tone(-0.0006), 'down');
  assert.equal(tone(0.0006), 'up');
  // Wherever F-19 moves tone(), toneClass stays tone() with 'flat' mapped to no class (app/open-rows.tsx is JSX, so it
  // can't be imported here).
  assert.match(src('app/open-rows.tsx'), /export const toneClass = [^\n]*tone\(x\)[^\n]*'flat' \? undefined/);
  assert.doesNotMatch(src('app/me/likes/page.tsx'), /> 0 \? 'up' : 'down'/);
  assert.match(src('app/me/likes/page.tsx'), /className=\{toneClass\(r\.returnPct\)\}/);
  assert.match(src('app/me/record/page.tsx'), /const sign = toneClass;/);
  assert.doesNotMatch(src('app/me/record/page.tsx'), /: 'up'\}|: 'down'\}/); // average win/loss too
});

test('fix #1 spillover on /me/record: a record with demo data is not called verified', () => {
  const s = src('app/me/record/page.tsx');
  assert.doesNotMatch(s, /your verified closed trades/);
  assert.match(s, /\{demo \? ' \(including demo data\)' : ''\}/);
});

test('fix #21: every page exports its own title, and no two static titles repeat', () => {
  const pages = walk(`${root}app`).filter((f) => f.endsWith('/page.tsx'));
  assert.ok(pages.length > 20);
  const titles = new Map<string, string>();
  for (const f of pages) {
    const s = readFileSync(f, 'utf8');
    const r = relative(root, f);
    assert.match(s, /export (const metadata|async function generateMetadata|function generateMetadata)/, `${r} has no metadata`);
    const t = /export const metadata[^=]*=\s*\{\s*title:\s*('[^']+'|`[^`]+`)/.exec(s)?.[1];
    if (t) { assert.ok(!titles.has(t), `${r} repeats the title of ${titles.get(t)}`); titles.set(t, r); }
  }
  assert.match(src('app/not-found.tsx'), /title: 'Page not found · Stock Social'/);
});

test('fix #27: share_image_saved_at is labelled for what the Share my record button records', () => {
  const lines = src('db/schema.sql').split('\n');
  const at = lines.findIndex((l) => l.includes("'share_image_saved_at'"));
  const comment = lines.slice(Math.max(0, at - 3), at).join(' ');
  assert.match(comment, /Share my record/);
  assert.doesNotMatch(comment, /on the owner's first click of a Save image link/);
  assert.match(src('app/actions.ts'), /first completed share of the record from the profile's "Share my record" button/);
});

test('fix #30: no dead .badge-embed CSS (the embed panel was removed)', () => {
  assert.doesNotMatch(src('app/globals.css'), /badge-embed/);
});
