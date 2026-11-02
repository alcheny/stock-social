// A11Y-FIXES (approval council "Fixes to build now", group 3): #5 what is public, #8 completeness claims, #10 the demo
// profile line, #20 page titles, #21 the 404 page, #22 ticker thesis links, #23 flat returns. Pure checks; the
// rendered pages are covered in e2e.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { tone, toneClass } from './open-split.ts';
import { DEMO_PROFILE, PUBLIC_SHORT, RECORD_STRIP, SIGN_WORD, signWord } from './copy.ts';
import { PUBLIC_FIELDS } from './privacy-fields.ts';
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

// #5, #20 and #21 shipped in fix cycle 2 (#59) too; these check the outcome on the merged sources, not one wording.
test('#5 (committee B1): the join call to action never calls a subset "only percentages"', () => {
  for (const t of [read('app/u/[handle]/join-cta.tsx'), PUBLIC_SHORT.join]) assert.doesNotMatch(t, /only percentages/i);
});

test('#5 (committee B2): the share prompt names everything a signed-out profile shows, never "each closed trade"', () => {
  const s = PUBLIC_SHORT.sharePrompt(PUBLIC_FIELDS.map((f) => f.words));
  for (const word of ['handle', 'name', 'reasons you publish', 'symbols', 'dates', 'percent returns', 'Losses are included', 'open positions']) {
    assert.ok(s.includes(word), `${word} missing from: ${s}`);
  }
  assert.doesNotMatch(s, /each closed trade/i);
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

const ROUTES = ['app/login/page.tsx', 'app/login/sent/page.tsx', 'app/login/dev/page.tsx', 'app/connect/page.tsx', 'app/connect/consent/page.tsx',
  'app/connect/continue/page.tsx', 'app/connect/result/page.tsx', 'app/terms/page.tsx', 'app/privacy/page.tsx', 'app/not-found.tsx'];

test('#20: every route that inherited "Stock Social" sets its own title, "‹Page› · Stock Social", all distinct', () => {
  const titles = ROUTES.map((file) => {
    const t = read(file).match(/export const metadata: Metadata = \{ title: '([^']+)'/)?.[1];
    assert.ok(t, `${file} sets a literal title`);
    assert.match(t, /^\S.* · Stock Social$/, file);
    return t;
  });
  assert.equal(new Set(titles).size, titles.length, titles.join(' | '));
});

test('#21: a root 404 page with a main landmark and one h1; an invalid ticker symbol is a real 404', () => {
  assert.ok(existsSync(new URL('../app/not-found.tsx', import.meta.url)));
  const src = read('app/not-found.tsx');
  assert.match(src, /<main className="page">/);
  assert.equal(src.match(/<h1\b/g)?.length, 1);
  assert.match(src, /title: 'Page not found · Stock Social'/);
  assert.match(read('app/t/[symbol]/page.tsx'), /if \(!symbol\) notFound\(\);/);
});

// F-25: the stable key is now the trade_key (it survives rebuildTrades too), and the link is built by tradePageHref.
test('#22: ticker thesis rows carry sell_id and link to the trade page, which survives rebuildTrades', () => {
  const key = 'b'.repeat(64);
  const r = selectTheses([{ id: 7, tradeKey: key, handle: 'h', thesis: 'why', thesisStatus: 'published', returnPct: 0.05, holdingDays: 3, closedAt: new Date(0), verified: true }]);
  assert.equal(r.items[0].tradeKey, key);
  const src = read('app/t/[symbol]/Theses.tsx');
  assert.match(src, /href=\{tradePageHref\(\{ handle: r\.handle, tradeKey: r\.tradeKey! \}\)\}/);
  assert.doesNotMatch(src, /#trade-/);
});
