// FIXES-CYCLE5 part 2 (C5-34): the owner's preview is the picture the Share button attaches. One path
// (lib/share-image.ts#shareImagePath), one preview component (app/u/[handle]/share-preview.tsx). Source checks; the
// browser half is e2e/fixes-cycle5-part2.spec.ts and the query count lib/fixes-cycle5-part2-share.db.test.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { shareImagePath } from './share-image.ts';
import { shareVia } from './share.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (f: string) => readFileSync(`${ROOT}${f}`, 'utf8');
const walk = (d: string): string[] => readdirSync(`${ROOT}${d}`, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]));
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1').replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '');

test('shareImagePath is the square story picture, byte-identical to the earlier literal, so the share still counts as a story', () => {
  assert.equal(shareImagePath('maya'), '/u/maya/story?format=square');
  assert.equal(shareVia('/u/maya', shareImagePath('maya')), 'story');
});

test('both owner boxes take the button image and the preview src from shareImagePath, twice each, and spell no image path', () => {
  for (const f of ['app/u/[handle]/share-card.tsx', 'app/u/[handle]/share-prompt.tsx']) {
    const s = code(read(f));
    assert.doesNotMatch(s, /story\?format=|opengraph-image/, f);
    assert.equal(s.match(/shareImagePath\(handle\)/g)?.length, 2, f);
    assert.match(s, /image=\{shareImagePath\(handle\)\}/, f);
    assert.match(s, /<SharePreview src=\{shareImagePath\(handle\)\}/, f);
  }
  assert.match(code(read('app/u/[handle]/share-card.tsx')), /<SharePreview [^>]*\blazy \/>/);
  assert.match(code(read('app/u/[handle]/share-prompt.tsx')), /<SharePreview [^>]*lazy=\{false\} \/>/);
});

test('share-preview.tsx holds the only img.preview in app/, with width, height, async decoding and the fallback line', () => {
  const owners = walk('app').filter((f) => /\.tsx$/.test(f) && /<img [^>]*className="preview"/.test(code(read(f))));
  assert.deepEqual(owners, ['app/u/[handle]/share-preview.tsx']);
  const s = code(read('app/u/[handle]/share-preview.tsx'));
  assert.match(s, /width=\{1080\} height=\{1080\}/);
  assert.match(s, /loading=\{lazy \? 'lazy' : 'eager'\}/);
  assert.match(s, /decoding="async"/);
  assert.doesNotMatch(s, /tabIndex/);
  assert.match(s, /Preview unavailable\. Your link still works\./);
});

test('the profile builds the owner card once, as the square picture, for whichever owner box shows', () => {
  const s = code(read('app/u/[handle]/page.tsx'));
  assert.match(s, /const promptCard = isMe && !claimed && shareable && \(sharePromptShowing \|\| trades\.length > 0\) \? await loadRecordCard\(user\.handle, 'square'\) : null;/);
  assert.match(s, /<ShareCard [^>]*previewAlt=\{promptCard \? `Preview of your share card\. \$\{cardAlt\(promptCard\)\}` : ''\}/);
  // The option headline is a per-request read, so the square card beside the unfurl card reads nothing twice.
  assert.match(read('app/u/[handle]/load.ts'), /options: perRequest\(\(userId: number\) => optionHeadline\(\[userId\]\)\)/);
  assert.match(read('app/u/[handle]/record-card-data.ts'), /r\.options\(id\)/);
  assert.match(read('app/globals.css'), /\.share-prompt \.preview \{[^}]*max-width: 343px;[^}]*aspect-ratio: 1 \/ 1;/);
});
