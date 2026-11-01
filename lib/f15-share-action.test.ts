// F-15 second half · share_action inputs (lib/share-actions.ts): only the three record routes, an exact handle, the
// share class from the path shape and the picture flag, a closed outcome; the trade page's one spelling
// (lib/share.ts#tradePath); siteOrigin moved to lib/site.ts with billing's outputs unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shareTarget, shareOutcome, SHARE_SURFACES, RECORD_SIGNS, SHARE_OUTCOMES } from './share-actions.ts';
import { SHARE_VIAS } from './referral.ts';
import { tradePath, shareVia } from './share.ts';
import { siteOrigin } from './site.ts';
import { siteOrigin as billingSiteOrigin } from './billing.ts';

test('F-15 share_action: the surface comes from the path shape and the picture flag; story only for a profile picture', () => {
  assert.deepEqual(shareTarget('/u/maya', false), { handle: 'maya', surface: 'card' });
  assert.deepEqual(shareTarget('/u/maya', true), { handle: 'maya', surface: 'story' });
  assert.deepEqual(shareTarget('/u/maya?via=card', false), { handle: 'maya', surface: 'card' });
  assert.deepEqual(shareTarget('/u/maya/trade/abc%2F1', false), { handle: 'maya', surface: 'trade' });
  assert.deepEqual(shareTarget('/u/maya/month/2026-10#x', false), { handle: 'maya', surface: 'month' });
  assert.equal(shareTarget('/u/maya/trade/abc', true), null); // a picture share off the profile writes nothing
  assert.equal(shareTarget('/u/maya/month/2026-10', true), null);
  for (const p of ['/u/Maya', '/u/%6Daya', '/u/maya/', '/u/a/../b', '/u/maya/../dan', '/u/maya/month/2026-13', '/u/maya/month/x',
    '/u/maya/story', '/t/AAPL', '/', '', 'u/maya', '/u/ma', '/u/' + 'a'.repeat(21), '/u/maya/trade/', null, 7]) {
    assert.equal(shareTarget(p, false), null, String(p));
  }
  for (const p of ['/u/maya', '/u/maya/trade/x', '/u/maya/month/2026-01']) assert.equal(shareTarget(p, false)!.surface, shareVia(p));
  assert.deepEqual([...SHARE_SURFACES], [...SHARE_VIAS]);
});

test('F-15 share_action: outcome is sheet or copy; anything else writes nothing; the closed lists', () => {
  assert.equal(shareOutcome('shared'), 'sheet');
  assert.equal(shareOutcome('copied'), 'copy');
  for (const v of ['dismissed', 'sheet', '', null, 1]) assert.equal(shareOutcome(v), null);
  assert.deepEqual([...SHARE_OUTCOMES], ['sheet', 'copy']);
  assert.deepEqual([...RECORD_SIGNS], ['up', 'down', 'flat', 'none']);
});

test('F-15 tradePath: one spelling from the stored sell id, used by the share link and the canonical link', () => {
  assert.equal(tradePath('maya', 'abc'), '/u/maya/trade/abc');
  assert.equal(tradePath('maya', 'a/b c'), '/u/maya/trade/a%2Fb%20c');
  const page = readFileSync(new URL('../app/u/[handle]/trade/[sellId]/page.tsx', import.meta.url), 'utf8');
  assert.equal((page.match(/tradePath\(t\.handle, decodeSellId\(/g) ?? []).length, 2); // canonical and share link
  assert.doesNotMatch(page, /const path = `\/u\/\$\{t\.handle\}\/trade\//);
});

test('F-15 siteOrigin: moved to lib/site.ts; billing re-exports it with identical outputs; the layout imports no billing', () => {
  assert.equal(billingSiteOrigin, siteOrigin);
  for (const env of [{}, { NEXT_PUBLIC_SITE_URL: 'https://app.example/' }, { VERCEL_PROJECT_PRODUCTION_URL: 'app.example' }, { VERCEL_PROJECT_PRODUCTION_URL: 'https://x.example//' }]) {
    assert.equal(billingSiteOrigin(env), siteOrigin(env));
  }
  assert.equal(siteOrigin({}), 'http://localhost:3000');
  const layout = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(layout, /lib\/billing/);
  assert.match(layout, /metadataBase: new URL\(siteOrigin\(\)\)/);
  for (const [f, re] of [['../app/u/[handle]/page.tsx', /canonical: `\/u\/\$\{user\.handle\}`/], ['../app/u/[handle]/month/[ym]/page.tsx', /canonical: `\/u\/\$\{r\.handle\}\/month\/\$\{r\.recap\.ym\}`/]] as const) {
    assert.match(readFileSync(new URL(f, import.meta.url), 'utf8'), re, f);
  }
});

test('F-15 share callers: every share control of an own record records one row, fire-and-forget; month pages pass the real owner', () => {
  const read = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');
  assert.match(read('../app/u/[handle]/share-card.tsx'), /recordShareAction\(`\/u\/\$\{handle\}`, how, picture\)/);
  assert.match(read('../app/u/[handle]/share-card.tsx'), /recordShareAction\(`\/u\/\$\{handle\}\/month\/\$\{recapYm\}`, how, false\)/);
  assert.match(read('../app/u/[handle]/share-prompt.tsx'), /recordShareAction\(`\/u\/\$\{handle\}`, how, picture\)/);
  const ts = read('../app/u/[handle]/trade/[sellId]/trade-share.tsx');
  assert.match(ts, /if \(!isOwner\) return;/);
  assert.match(ts, /if \(kind === 'trade'\) void recordTradeShared\(\)/); // trade_shared_at keeps meaning a trade share
  assert.match(ts, /kind: 'trade' \| 'month' \}/);
  assert.match(read('../app/u/[handle]/month/[ym]/page.tsx'), /<TradeShare kind="month" isOwner=\{me !== null && me\.handle === handle\}/);
  for (const f of ['../app/u/[handle]/share-card.tsx', '../app/u/[handle]/share-prompt.tsx', '../app/u/[handle]/trade/[sellId]/trade-share.tsx']) {
    assert.doesNotMatch(read(f), /await recordShareAction/, f);
  }
});
