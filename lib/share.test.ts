import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { absoluteUrl, DISCLAIMER, shareMode } from './share.ts';

test('share: a device that can share files sends the record image with the link', () => {
  assert.equal(shareMode({ canShareFiles: true, canShare: true, hasImage: true }), 'files');
});

test('share: no image, or no file sharing, falls back to the share sheet with the link', () => {
  assert.equal(shareMode({ canShareFiles: true, canShare: true, hasImage: false }), 'link');
  assert.equal(shareMode({ canShareFiles: false, canShare: true, hasImage: true }), 'link');
});

test('share: no share sheet (most desktops) copies the link in the same click', () => {
  assert.equal(shareMode({ canShareFiles: false, canShare: false, hasImage: true }), 'copy');
  assert.equal(shareMode({ canShareFiles: false, canShare: false, hasImage: false }), 'copy');
});

test('share: shared links are absolute', () => {
  assert.equal(absoluteUrl('https://example.com', '/u/maya'), 'https://example.com/u/maya');
  assert.equal(absoluteUrl('http://localhost:3000', '/u/maya/month/2026-09'), 'http://localhost:3000/u/maya/month/2026-09');
});

test('share: every image that shows performance carries the disclaimer (POLICY F3)', () => {
  for (const f of ['app/u/[handle]/opengraph-image.tsx', 'app/u/[handle]/story/route.tsx', 'app/u/[handle]/month/[ym]/opengraph-image.tsx',
    'app/u/[handle]/trade/[sellId]/opengraph-image.tsx', 'app/t/[symbol]/opengraph-image.tsx']) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    assert.match(src, /\{DISCLAIMER\}/, f);
  }
  assert.match(DISCLAIMER, /^Not investment advice\. Past performance does not guarantee future results\.$/);
});
