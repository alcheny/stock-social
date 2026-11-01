// F-15 · Share and copy-link append the right `?via=` class (lib/share.ts#shareVia, #withVia; app/share-button.tsx).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shareVia, withVia } from './share.ts';
import { SHARE_VIAS, viewVia } from './referral.ts';

test('F-15 shareVia: profile → card, trade → trade, month → month, story only with the story picture', () => {
  assert.equal(shareVia('/u/maya'), 'card');
  assert.equal(shareVia('/u/maya', '/u/maya/story?format=square'), 'story');
  assert.equal(shareVia('/u/maya', '/u/maya/opengraph-image'), 'card');
  assert.equal(shareVia('/u/maya/trade/abc%2F1'), 'trade');
  assert.equal(shareVia('/u/maya/trade/abc', '/u/maya/story'), 'trade');
  assert.equal(shareVia('/u/maya/month/2026-10'), 'month');
  for (const p of ['/u/a', '/u/a/trade/x', '/u/a/month/2026-01']) assert.ok((SHARE_VIAS as readonly string[]).includes(shareVia(p)));
});

test('F-15 withVia: sets via, replaces an old one, keeps other params and the fragment', () => {
  assert.equal(withVia('/u/maya', 'card'), '/u/maya?via=card');
  assert.equal(withVia('/u/maya?via=nav', 'card'), '/u/maya?via=card');
  assert.equal(withVia('/u/maya/month/2026-10?x=1#top', 'month'), '/u/maya/month/2026-10?x=1&via=month#top');
  assert.equal(withVia('/u/maya/trade/a%2Fb', 'trade'), '/u/maya/trade/a%2Fb?via=trade');
  assert.equal(viewVia(new URL(withVia('/u/maya', 'story'), 'http://x.invalid').searchParams.get('via')), 'story');
});

test('F-15 ShareButton: the shared and copied link is tagged at click time; story only in the picture path; one tap', () => {
  const src = readFileSync(new URL('../app/share-button.tsx', import.meta.url), 'utf8');
  assert.match(src, /shareVia\(url, mode === 'files' \? image : undefined\)/);
  assert.match(src, /navigator\.share\(mode === 'files' \? \{ title, url: shared/);
  assert.match(src, /copy\(shared\)/);
  assert.match(src, /aria-live="polite"[^>]*>\{state === 'copied' \? 'Link copied' : ''\}/);
  assert.equal((src.match(/<button/g) ?? []).length, 1); // still one control, one tap
});
