// F-10 AC12 / F-12 AC9: one strip, never a second; F-12 AC5/AC6 and the #44 AC: no win rate on images, no verdict on
// months, no completeness words (plan §7 guards, scoped by committee round 3, R3-3). Source scans of the strip surfaces.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { RECORD_STRIP, SHARE_CARD, WHOLE_RECORD } from './copy.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
// Comments say why; the guards read code and copy only.
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1').replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '');

const TRADE = 'app/u/[handle]/trade/[sellId]';
const MONTH = 'app/u/[handle]/month/[ym]';
const HTML_SURFACES = ['app/ui.tsx', 'app/feed-rows.tsx', `${TRADE}/page.tsx`, `${MONTH}/page.tsx`];
const IMAGE_SURFACES = [`${TRADE}/opengraph-image.tsx`, `${MONTH}/opengraph-image.tsx`];
const STOCK_IMAGE = 'app/t/[symbol]/opengraph-image.tsx';
const STRIP_WORDS = ['average per trade', RECORD_STRIP.perClosedShort /* FIXES-CYCLE5 part 2 (round 2 item 11) */, RECORD_STRIP.early, RECORD_STRIP.rangeLabel, 'losses included'];

function tsx(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((n) => {
    const p = join(dir, n);
    return statSync(join(ROOT, p)).isDirectory() ? tsx(p) : /\.tsx?$/.test(n) ? [p] : [];
  });
}

test('F-10 AC12 / F-12 AC9: every strip surface uses the shared strip and holds no copy of its wording', () => {
  for (const f of HTML_SURFACES) {
    const s = code(read(f));
    assert.ok(/\bRecordStrip\b|\brecordStrip\b/.test(s), `${f} does not use the shared strip`);
  }
  for (const f of IMAGE_SURFACES) {
    const s = code(read(f));
    assert.ok(/\bRecordStripImage\b/.test(s) && /\brecordStrip\b/.test(s), `${f} does not draw the shared strip`);
  }
  for (const f of [...HTML_SURFACES, ...IMAGE_SURFACES]) {
    const s = code(read(f));
    for (const w of STRIP_WORDS) assert.ok(!s.includes(w), `${f} spells "${w}" itself`);
  }
});

test('F-12 AC9: no second strip component, and the strip\'s hooks appear nowhere else in app/', () => {
  for (const f of tsx('app')) {
    if (f === 'app/record-strip.tsx') continue;
    const s = code(read(f));
    // Any component named like a record strip (app/t/page.tsx's watch-list "Strip" is another thing and keeps its name).
    assert.ok(!/(function|const|class)\s+\w*Record\w*Strip\w*/.test(s), `${f} defines a second record strip component`);
    assert.ok(!/data-strip|record-strip(?!\.tsx|\.ts)|"record-strip|'record-strip/.test(s.replace(/from\s+['"][^'"]+['"]/g, '')), `${f} uses the strip's hooks`);
  }
  assert.match(read('app/record-strip.tsx'), /export function RecordStrip\b/);
});

test('F-12 AC5: no win rate on the trade, month or stock image, nor on the trade and month pages', () => {
  for (const f of [...IMAGE_SURFACES, STOCK_IMAGE, `${TRADE}/page.tsx`, `${MONTH}/page.tsx`]) {
    const s = code(read(f));
    assert.ok(!/win rate|winRate|winRateText/.test(s), `${f} prints a win rate`);
  }
});

test('F-12 AC6: the month page carries no "Past results" verdict and no evidence line', () => {
  const s = code(read(`${MONTH}/page.tsx`));
  assert.ok(!/Past results|evidenceLine|\.evidence\b/.test(s), 'month page still prints a verdict');
});

test('committee (stock image): no pooled average, range or verdict; the alt claims no figures', () => {
  const s = code(read(STOCK_IMAGE));
  assert.ok(!/avgReturn|rangeText|evidenceLine|perTrade|average/.test(s), 'stock image prints a pooled figure');
  const alt = /export const alt = '([^']*)'/.exec(s)?.[1];
  assert.ok(alt && !/\d|verified/i.test(alt), `stock alt: ${alt}`);
});

test('#44 AC / F3a: no completeness words on the strip surfaces or in the strip\'s copy', () => {
  const BANNED = /full record|whole record|full-record|every trade/i;
  for (const f of [...HTML_SURFACES.slice(2), ...IMAGE_SURFACES, STOCK_IMAGE]) {
    const s = code(read(f)).replace(/id="whole-record"|aria-labelledby="whole-record"|['"]whole-record['"]/g, '');
    assert.ok(!BANNED.test(s), `${f}: ${BANNED.exec(s)?.[0]}`);
  }
  const values: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'string') values.push(v);
    else if (typeof v === 'function') values.push(String((v as (...a: unknown[]) => unknown)('x', 2, 1)));
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  [RECORD_STRIP, WHOLE_RECORD, SHARE_CARD].forEach(walk);
  for (const v of values) assert.ok(!BANNED.test(v), v);
});

test('the guards scan real files (paths still exist)', () => {
  for (const f of [...HTML_SURFACES, ...IMAGE_SURFACES, STOCK_IMAGE, 'app/record-strip.tsx']) assert.ok(statSync(join(ROOT, f)).isFile(), relative(ROOT, join(ROOT, f)));
});
