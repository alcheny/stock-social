// A11Y-FIXES (approval council "Fixes to build now", group 3): #5 what is public, #8 completeness claims, #10 the demo
// profile line, #20 page titles, #21 the 404 page, #22 ticker thesis links, #23 flat returns. Pure checks; the
// rendered pages are covered in e2e.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { tone, toneClass } from './open-split.ts';
import { DEMO_PROFILE, NOT_FOUND, PUBLIC_SCOPE, RECORD_STRIP, SIGN_WORD, signWord, TITLES } from './copy.ts';
import { pct } from './trades.ts';
import { selectTheses } from './ticker.ts';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// #23: the grid around every rounding edge of pct()'s one decimal.
const GRID = [0, -0, 0.0004, -0.0004, 0.00049, -0.00049, 0.0005, -0.0005, 0.00051, -0.00051, 0.001, -0.001, 0.25, -0.25, 1, -0.999, 3.2];

test('#23: tone is flat exactly when pct prints 0.0%, up when it prints "+", down otherwise', () => {
  for (const x of GRID) {
    const shown = pct(x), t = tone(x);
    if (shown === '0.0%') assert.equal(t, 'flat', `${x} → ${shown}`);
    else if (shown.startsWith('+')) assert.equal(t, 'up', `${x} → ${shown}`);
    else assert.equal(t, 'down', `${x} → ${shown}`);
  }
});

test('#23: toneClass paints up and down, and nothing for flat (it inherits the text colour)', () => {
  for (const x of GRID) assert.equal(toneClass(x), tone(x) === 'flat' ? undefined : tone(x), String(x));
  assert.equal(toneClass(0), undefined);
  assert.equal(toneClass(0.0004), undefined);
  assert.equal(toneClass(-0.0004), undefined);
  assert.equal(toneClass(0.12), 'up');
  assert.equal(toneClass(-0.12), 'down');
});

test('#23: signWord says Gain, Loss or Flat (F-19 toneWord), matching the printed sign', () => {
  assert.deepEqual(SIGN_WORD, { up: 'Gain', down: 'Loss', flat: 'Flat' });
  for (const x of GRID) assert.equal(signWord(x), SIGN_WORD[tone(x)], String(x));
  assert.equal(signWord(0), 'Flat');
  assert.equal(signWord(-0.0004), 'Flat');
  assert.equal(signWord(0.0005), 'Gain');
  assert.equal(signWord(-0.0005), 'Loss');
});

test('#23: no call site paints by a raw comparison any more', () => {
  const sites = ['app/u/[handle]/page.tsx', 'app/pane.tsx', 'app/ui.tsx', 'app/u/[handle]/similar-section.tsx', 'app/me/likes/page.tsx', 'lib/record-tools.ts',
    'app/u/[handle]/chart.tsx', 'app/u/[handle]/trade/[sellId]/page.tsx', 'app/u/[handle]/month/[ym]/page.tsx', 'app/u/[handle]/new-trades-prompt.tsx',
    'app/t/[symbol]/page.tsx', 'app/t/[symbol]/Theses.tsx'];
  for (const f of sites) {
    const src = read(f);
    assert.doesNotMatch(src, /> 0 \? 'up' : 'down'/, f);
    assert.doesNotMatch(src, />= 0 \? 'up' : 'down'/, f);
    assert.doesNotMatch(src, /< 0 \? 'Loss ' : 'Gain '/, f);
  }
  assert.doesNotMatch(read('app/ui.tsx'), /const up = t\.return_pct > 0/);
});

test('#5 (committee B1): the join call to action, verbatim, with no "only percentages"', () => {
  assert.equal(PUBLIC_SCOPE.joinLead, 'Verify your own record.');
  assert.equal(PUBLIC_SCOPE.join, 'Read-only broker connection. Public trades show percentages, never quantities, prices or balances. 18+.');
  const src = read('app/u/[handle]/join-cta.tsx');
  assert.match(src, /PUBLIC_SCOPE\.joinLead/);
  assert.match(src, /PUBLIC_SCOPE\.join\b/);
  assert.doesNotMatch(src, /only percentages/i);
});

test('#5 (committee B2): the share prompt names everything a signed-out profile shows, as "your closed trades"', () => {
  const s = PUBLIC_SCOPE.share;
  assert.ok(s.startsWith('Public: '), s);
  for (const word of ['handle', 'name', 'your closed trades', 'symbol', 'dates', 'percent return', 'losses included', 'open positions', 'thesis']) {
    assert.ok(s.includes(word), `${word} missing from: ${s}`);
  }
  assert.doesNotMatch(s, /each closed trade|only/i);
  assert.match(s, /Never quantities, prices, fees or balances\./);
  assert.match(read('app/u/[handle]/share-prompt.tsx'), /PUBLIC_SCOPE\.share/);
});

test('#8: no completeness claim in the image alts, the recap description, the back links or the claim note', () => {
  // Since F-10/F-12 (#54) the alts and descriptions are built in lib/trade-share.ts and lib/recap.ts and the back links use
  // RECORD_STRIP.link; none of their string literals or the pages' may claim completeness.
  const CLAIM = /['"`][^'"`\n]*\b(full record|whole record|every trade|all (of )?(their|your) trades)\b[^'"`\n]*['"`]/i;
  assert.doesNotMatch(RECORD_STRIP.link('h'), /\b(full|whole|every|complete|all)\b/i);
  for (const f of ['app/u/[handle]/trade/[sellId]/opengraph-image.tsx', 'app/u/[handle]/month/[ym]/opengraph-image.tsx',
    'app/u/[handle]/trade/[sellId]/page.tsx', 'lib/trade-share.ts', 'lib/recap.ts', 'lib/claims.ts']) {
    const src = read(f).split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    assert.doesNotMatch(src, CLAIM, f);
  }
  for (const f of ['app/u/[handle]/trade/[sellId]/page.tsx', 'app/u/[handle]/month/[ym]/page.tsx']) assert.match(read(f), /RECORD_STRIP\.link\(/, f);
  assert.doesNotMatch(read('lib/claims.ts'), /keeps every record verified/);
});

test('#10: the demo profile line never implies connected accounts', () => {
  assert.equal(DEMO_PROFILE.line, 'Demo data, not a real broker record.');
  assert.equal(DEMO_PROFILE.connectedOnly, 'Only trades from connected accounts are shown.');
  assert.doesNotMatch(DEMO_PROFILE.line, /connected|verified/i);
  const src = read('app/u/[handle]/page.tsx');
  assert.doesNotMatch(src, /'Demo data'/);
  assert.doesNotMatch(src, /\. Only trades from connected accounts are shown\./);
});

const ROUTES: [string, keyof typeof TITLES][] = [
  ['app/login/page.tsx', 'login'], ['app/login/sent/page.tsx', 'loginSent'], ['app/login/dev/page.tsx', 'loginDev'],
  ['app/connect/page.tsx', 'connect'], ['app/connect/consent/page.tsx', 'consent'], ['app/connect/continue/page.tsx', 'continue'],
  ['app/connect/result/page.tsx', 'result'], ['app/terms/page.tsx', 'terms'], ['app/privacy/page.tsx', 'privacy'], ['app/not-found.tsx', 'notFound'],
];

test('#20: every route that inherited "Stock Social" sets its own title, "‹Page› · Stock Social", all distinct', () => {
  const titles = Object.values(TITLES);
  assert.equal(new Set(titles).size, titles.length);
  for (const t of titles) {
    assert.match(t, /^\S.* · Stock Social$/, t);
    assert.notEqual(t, 'Stock Social');
  }
  for (const [file, key] of ROUTES) {
    const src = read(file);
    assert.match(src, new RegExp(`export const metadata: Metadata = \\{ title: TITLES\\.${key}\\b`), file);
  }
  // The titles the other routes already set stay distinct from these.
  for (const t of ['How records are calculated · Stock Social', 'Settings · Stock Social', 'My record · Stock Social']) assert.ok(!(titles as string[]).includes(t), t);
});

test('#21: a root 404 page with a main landmark, one h1 and links to Feed, Trades by stock and How', () => {
  assert.ok(existsSync(new URL('../app/not-found.tsx', import.meta.url)));
  const src = read('app/not-found.tsx');
  assert.match(src, /<main className="page">/);
  assert.equal(src.match(/<h1\b/g)?.length, 1);
  assert.equal(NOT_FOUND.heading, 'Page not found');
  assert.deepEqual(NOT_FOUND.links.map((l) => [l.href, l.label]), [['/', 'Feed'], ['/t', 'Trades by stock'], ['/how', 'How records are calculated']]);
  assert.equal(TITLES.notFound, 'Page not found · Stock Social');
  // An invalid ticker symbol is a real 404, not a 200 page.
  assert.match(read('app/t/[symbol]/page.tsx'), /if \(!symbol\) notFound\(\);/);
});

test('#22: ticker thesis rows carry sell_id and link to the trade page, which survives rebuildTrades', () => {
  const r = selectTheses([{ id: 7, sellId: 'sell-a/1', handle: 'h', thesis: 'why', thesisStatus: 'published', returnPct: 0.05, holdingDays: 3, closedAt: new Date(0), verified: true }]);
  assert.equal(r.items[0].sellId, 'sell-a/1');
  const src = read('app/t/[symbol]/Theses.tsx');
  assert.match(src, /href=\{`\/u\/\$\{r\.handle\}\/trade\/\$\{encodeURIComponent\(r\.sellId\)\}`\}/);
  assert.doesNotMatch(src, /#trade-/);
});
