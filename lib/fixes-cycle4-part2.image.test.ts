// FIXES-CYCLE4-PART2 (F4-15, C4-16; orchestrator review 2): an image snapshot of the share-card unfurl for a fictional
// demo options record with a display name and a short handle, the shape of the seeded demo options trader. The card is
// drawn through next/og exactly as app/u/[handle]/opengraph-image.tsx draws it (the bundled font, so the PNG is
// deterministic), from a fixed model (fixed trades and clock). The structural half checks what the snapshot stands for:
// the head row keeps the badge beside the full handle, "Excluding options" sits in the chart column, the chart gave up
// one pill row. Regenerate the hash only for a deliberate card change:
// UPDATE_SNAPSHOT=1 node --test lib/fixes-cycle4-part2.image.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { CARD_LAYOUT, recordCard } from './record-card.ts';
import { HEAD_PILL_ROW, unfurlHeadRows } from './card-head.ts';
import { DISCLAIMER } from './share.ts';
import { OPTIONS } from './copy.ts';

const ROOT = new URL('..', import.meta.url);
const require = createRequire(import.meta.url);
const swc = require('next/dist/build/swc') as { loadBindings: () => Promise<unknown>; transformSync: (src: string, o: object) => { code: string } };
await swc.loadBindings();
registerHooks({
  resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) return next(new URL(spec.slice(2), ROOT).href, ctx);
    return next(spec, ctx);
  },
  load(url, ctx, next) {
    if (!url.endsWith('.tsx')) return next(url, ctx);
    const file = new URL(url);
    const { code } = swc.transformSync(readFileSync(file, 'utf8'), {
      filename: file.pathname, jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } }, target: 'es2022' }, module: { type: 'es6' },
    });
    return { format: 'module', source: code, shortCircuit: true };
  },
});
const { createElement } = await import('react');
const { ImageResponse } = await import('next/dist/compiled/@vercel/og/index.node.js' as string) as { ImageResponse: new (el: unknown, o: object) => Response };
const { RecordCardImage } = await import(pathToFileURL(new URL('app/u/[handle]/record-card-image.tsx', ROOT).pathname).href) as typeof import('../app/u/[handle]/record-card-image.tsx');

const NOW = new Date('2026-11-01T12:00:00Z');
const DAY = 86_400_000;
const trades = Array.from({ length: 30 }, (_, i) => {
  const closedAt = new Date(NOW.getTime() - (60 - 2 * i) * DAY);
  return { symbol: `ZQ${i}`, openedAt: new Date(closedAt.getTime() - 2 * DAY), closedAt, returnPct: [0.04, -0.03, 0.02, -0.05, 0.06, 0.01][i % 6], holdingDays: 2 };
});
const model = recordCard({
  kind: 'unfurl', handle: 'demo_options', name: 'Demo Trader', trades, state: 'connected', demo: true, verified: false, now: NOW, link: null,
  options: { shareLabel: true, line: OPTIONS.gated(4, 1) },
});
const FILE = new URL('./snapshots/f4-15-unfurl-demo-options.sha256', import.meta.url);

test('F4-15: the demo options unfurl: badge beside the full handle, "Excluding options" in the chart column, the chart one pill row shorter', () => {
  const rows = unfurlHeadRows(model, model.chart!.w);
  assert.deepEqual(rows, { head: ['badge'], column: [['options']], second: [] });
  const L = CARD_LAYOUT.unfurl;
  assert.ok(model.chart!.h <= L.chart.h - L.noteCut - HEAD_PILL_ROW, 'the chart gave up the options line\'s row and one pill row');
});

test('F4-15: the demo options unfurl matches its image snapshot (1200×630 PNG, deterministic)', async () => {
  const png = Buffer.from(await new ImageResponse(createElement(RecordCardImage, { m: model, disclaimer: DISCLAIMER }), { width: 1200, height: 630 }).arrayBuffer());
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
  const hash = createHash('sha256').update(png).digest('hex');
  if (process.env.UPDATE_SNAPSHOT === '1') writeFileSync(FILE, `${hash}\n`);
  assert.ok(existsSync(FILE), 'snapshot committed');
  // A second draw is byte-identical, so the hash is a fair snapshot.
  const again = Buffer.from(await new ImageResponse(createElement(RecordCardImage, { m: model, disclaimer: DISCLAIMER }), { width: 1200, height: 630 }).arrayBuffer());
  assert.equal(createHash('sha256').update(again).digest('hex'), hash);
  assert.equal(hash, readFileSync(FILE, 'utf8').trim());
});
