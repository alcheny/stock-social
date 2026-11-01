// OPTIONS fix round 4 (legal round 3 demand 5, AC 24): the F-10/F-12 record strip is a headline surface. It carries
// "Excluding options" whenever the trader has option closes or exclusions, on the feed card, the trade and month pages
// and their images, and never an option figure; with no options it is exactly as before.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { layoutBand, recordStrip, stripFigures, stripImageLines, type StripInput, type StripSurface } from './record-strip.ts';
import { OPTIONS } from './copy.ts';
import { tradeHero } from './trade-share.ts';

const DAY = 86_400_000;
const now = new Date('2026-11-01T12:00:00Z');
const trades = Array.from({ length: 12 }, (_, i) => ({ symbol: `S${i % 7}`, openedAt: new Date(now.getTime() - (90 - i * 6) * DAY), closedAt: new Date(now.getTime() - (88 - i * 6) * DAY), returnPct: [0.12, -0.08, 0.03, -0.2][i % 4], holdingDays: 2 }));
const base: StripInput = { ...stripFigures(trades, now), state: 'connected', demo: false, verified: true, handle: 'opt_strip', open: [0.1, -0.05] };
const SURFACES: StripSurface[] = ['feed', 'page', 'image', 'figures'];

test('the strip says "Excluding options" on the feed card, page and image surfaces when the trader has option closes; never on the month\'s own figures', () => {
  for (const surface of SURFACES) {
    const s = recordStrip({ ...base, excludingOptions: true }, surface);
    const parts = s.figures.filter((p) => p.role === 'options');
    if (surface === 'figures') { assert.equal(parts.length, 0); continue; }
    assert.deepEqual(parts.map((p) => p.text), [OPTIONS.shareLabel], surface);
    assert.ok(s.text.endsWith(` · ${OPTIONS.shareLabel}`), surface);
    assert.match(s.alt, /Excluding options\./, surface);
    // No option figure: the qualifier is the only addition.
    assert.equal(s.text, `${recordStrip(base, surface).text} · ${OPTIONS.shareLabel}`);
  }
  // While importing nothing but the importing line is shown, options or not.
  assert.equal(recordStrip({ ...base, state: 'importing', excludingOptions: true }, 'page').figures.length, 0);
});

test('with no option counts every strip is exactly as before', () => {
  for (const surface of SURFACES) {
    assert.deepEqual(recordStrip({ ...base, excludingOptions: false }, surface), recordStrip(base, surface));
    assert.deepEqual(recordStrip({ ...base, excludingOptions: undefined }, surface), recordStrip(base, surface));
  }
});

test('the image draws "Excluding options" on its own line inside the band, and the worst case still fits (thesis, failed note, open positions)', () => {
  // The trade image's own hero lines, with a 280-character thesis (the first line to give way).
  const hero = tradeHero({ symbol: 'ABCDE', returnPct: 1.234, holdingDays: 12, closedAt: '2026-10-03T15:00:00Z', thesis: 'x '.repeat(140).trim() } as never);
  for (const state of ['connected', 'failed'] as const) {
    const lines = stripImageLines(recordStrip({ ...base, state, excludingOptions: true }, 'image'), { handle: 'opt_strip', newRecord: false, hero });
    const laid = layoutBand(lines);
    assert.equal(laid.fits, true, state);
    assert.deepEqual(laid.tooWide, [], state);
    // Its own line when it fits; else on the count line (the failed import's two note lines take the room). Never dropped.
    const own = laid.lines.find((l) => l.role === 'options'), count = laid.lines.find((l) => l.role === 'count')!;
    if (state === 'connected') assert.equal(own?.text, OPTIONS.shareLabel);
    else { assert.equal(own, undefined); assert.match(count.text, / · Excluding options$/); assert.ok(count.size >= 26); }
    // The disclaimer stays the band's last lines.
    assert.deepEqual(laid.lines.slice(-3).map((l) => l.role), ['disclaimer0', 'disclaimer1', 'disclaimer2']);
  }
});

test('every strip surface reads the qualifier through the one reader (gated per trader), passing no gate argument', () => {
  const read = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');
  for (const f of ['./trade-share-load.ts', './recap-load.ts']) assert.match(read(f), /paneView\(\(await optionHeadline\(\[Number\([^)]*\)\]\)\)\.get\(/, f);
  assert.match(read('../app/feed-rows.tsx'), /excludingOptions: page\.options\?\.get\(t\.user_id\)\?\.label/);
  assert.match(read('./trade-share.ts'), /excludingOptions: t\.excludingOptions/);
  assert.match(read('./recap.ts'), /excludingOptions: r\.excludingOptions/);
});
