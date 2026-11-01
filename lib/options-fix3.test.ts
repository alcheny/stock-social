// OPTIONS fix round 3 (user test, docs/features/logs/options/screenshots/): the copy changes, pinned. The layout
// changes are checked as static markup in e2e/options.spec.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HOW, OPTIONS, allCopy } from './copy.ts';
import { cardAlt, recordCard } from './record-card.ts';

test('item 4: the label reads "Excluding options" everywhere; the chart caption suffix is " · excluding options"', () => {
  assert.equal(OPTIONS.shareLabel, 'Excluding options');
  assert.equal(OPTIONS.chartShareOnly, ' · excluding options');
  assert.ok(!allCopy().some((s) => /share trades only|^Share trades$|per (closed )?share trade/.test(s)));
  const now = new Date('2026-11-01T12:00:00Z');
  const trades = Array.from({ length: 6 }, (_, i) => ({ symbol: `S${i}`, openedAt: new Date(now.getTime() - (20 - i) * 86_400_000), closedAt: new Date(now.getTime() - (10 - i) * 86_400_000), returnPct: 0.02, holdingDays: 10 }));
  const m = recordCard({ kind: 'square', handle: 'h_x', name: null, trades, state: 'connected', demo: false, verified: true, now, link: null, options: { shareLabel: true, line: OPTIONS.gated(2, 0) } });
  assert.equal(m.headlineLabel, 'average per trade'); // the card's own words, back as they were
  assert.match(cardAlt(m), /Excluding options\./);
  const image = readFileSync(new URL('../app/u/[handle]/record-card-image.tsx', import.meta.url), 'utf8');
  assert.match(image, /pill\(OPTIONS\.shareLabel/);
});

test('item 6: the gated sentence in plain words, every count kept, and its own short link', () => {
  assert.equal(OPTIONS.gated(4, 1), "4 option trades and 1 open option imported. Options aren't published yet.");
  assert.equal(OPTIONS.gated(1, 0), "1 option trade imported. Options aren't published yet.");
  assert.equal(OPTIONS.gated(0, 3), "3 open options imported. Options aren't published yet.");
  assert.equal(OPTIONS.howLink, 'How options are counted');
});

test('item 7: /how#options clears the sticky header', () => {
  assert.match(readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8'), /#options \{ scroll-margin-top: 72px; \}/);
  assert.match(readFileSync(new URL('../app/how/page.tsx', import.meta.url), 'utf8'), /<h2 id="options">/);
});

test('item 8: an option row link\'s accessible name carries the row and says where it goes', () => {
  assert.equal(OPTIONS.rowName('XYZ', 'Put option', 'exp Dec 19, 2026', '-100.0%'), 'XYZ put option, exp Dec 19, 2026, -100.0%, stock page');
});

test('item 10: /how names the share trades held over the day of an exercise or assignment; copy-test words kept', () => {
  assert.ok(HOW.excluded.includes('Exercised or assigned options, and share trades held over the day of an exercise or assignment in that stock. These are left out of the options average, so it does not include contracts that ended in the money.'));
  for (const w of ['Options', 'short sales']) assert.match(HOW.excluded.join(' '), new RegExp(w));
});

test('item 5: the pane passes the label to its chart (the caption suffix), and the label clears the figures by 8 px', () => {
  assert.match(readFileSync(new URL('../app/pane.tsx', import.meta.url), 'utf8'), /shareOnly=\{!!options\?\.label\}/);
  assert.match(readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8'), /\.pane \.share-label \{ margin-top: 8px; \}/);
});
