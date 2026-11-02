// F-34 AC2 (plan §8): image snapshots of every link preview with the fictional −15% fixture: the unfurl, the square card,
// the trade and the month image, drawn through next/og exactly as the routes draw them (the fixes-cycle4-part2.image
// pattern: bundled font, deterministic PNG, sha256). The `|none` keys are the same fixture with no open positions and were
// written from main's code before F-34 (byte-identical to main); only the `|open` keys changed with F-34. Structural half:
// with open positions only the open rows and the §3 steps differ. Regenerate only for a deliberate image change:
// UPDATE_SNAPSHOT=1 node --test lib/f34-open-line.image.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { recordCard } from './record-card.ts';
import { recordStrip } from './record-strip.ts';
import { tradeBand, tradeSharePayload, tradeStripInput } from './trade-share.ts';
import { monthBand } from './month-card.ts';
import { monthRecap, wholeRecord, recordStripInput, monthStripInput } from './recap.ts';
import { DISCLAIMER } from './share.ts';
import type { ConfidenceInput } from './trades.ts';

const ROOT = new URL('..', import.meta.url);
const require = createRequire(import.meta.url);
const swc = require('next/dist/build/swc') as { loadBindings: () => Promise<unknown>; transformSync: (src: string, o: object) => { code: string } };
await swc.loadBindings();
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === 'next/link') return { url: `data:text/javascript,${encodeURIComponent('export default function Link() { return null; }')}`, shortCircuit: true };
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
const { RecordStripImage } = await import(pathToFileURL(new URL('app/record-strip.tsx', ROOT).pathname).href) as typeof import('../app/record-strip.tsx');
const { disclaimerAtFoot } = await import('./stock-image.ts');

const NOW = new Date('2026-10-20T12:00:00Z');
const AS_OF = new Date('2026-09-30T15:00:00Z');
const FIX = [-0.15, 0.04, 0.012];
const DAY = 86_400_000, t0 = Date.UTC(2025, 0, 1);
const trades: (ConfidenceInput & { sellId: string })[] = [
  ...Array.from({ length: 40 }, (_, i) => ({ sellId: `s${i}`, symbol: `Q${i}`, openedAt: new Date(t0 + i * 3 * DAY), closedAt: new Date(t0 + (i * 3 + 2) * DAY), returnPct: i % 2 ? 0.013 : 0.005, holdingDays: 2 })),
  ...Array.from({ length: 8 }, (_, i) => ({ sellId: `t${i}`, symbol: `R${i}`, openedAt: new Date(Date.UTC(2026, 8, 2 + i)), closedAt: new Date(Date.UTC(2026, 8, 10 + i)), returnPct: -0.05, holdingDays: 8 })),
];
const withOpen = (open: boolean) => (open ? { open: FIX, openAsOf: AS_OF } : {});
const card = (kind: 'unfurl' | 'square', open: boolean) => recordCard({ kind, handle: 'f34_fixture', name: 'F34 Fixture', trades, state: 'connected', demo: false, verified: true, now: NOW, link: kind === 'unfurl' ? null : 'example.test/u/f34_fixture', ...withOpen(open) });
const tradeLines = (open: boolean) => {
  const pick = trades[trades.length - 1];
  const p = tradeSharePayload({ symbol: pick.symbol, returnPct: pick.returnPct, holdingDays: pick.holdingDays, closedAt: pick.closedAt, thesis: null, thesisStatus: null, demo: false, allTrades: trades }, NOW);
  const t = { ...p, handle: 'f34_fixture', displayName: 'F34 Fixture', state: 'connected' as const, verified: true, ...withOpen(open) };
  return tradeBand(t, recordStrip(tradeStripInput(t), 'image')).lines;
};
const monthLines = (open: boolean) => {
  const r = { handle: 'f34_fixture', displayName: 'F34 Fixture', demo: false, verified: true, state: 'connected' as const, recap: monthRecap(trades, '2026-09', NOW)!, record: wholeRecord(trades, NOW), months: 3, ...withOpen(open) };
  return monthBand(r, recordStrip(recordStripInput(r), 'image'), recordStrip(monthStripInput(r), 'figures')).lines;
};
const SIZE = { unfurl: [1200, 630], square: [1080, 1080] } as const;
const png = async (el: unknown, w: number, h: number) => Buffer.from(await new ImageResponse(el, { width: w, height: h }).arrayBuffer());
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const FILE = new URL('./snapshots/f34-open-line.json', import.meta.url);

async function draw(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const open of [false, true]) {
    const k = open ? 'open' : 'none';
    for (const kind of ['unfurl', 'square'] as const) out[`${kind}|${k}`] = sha(await png(createElement(RecordCardImage, { m: card(kind, open), disclaimer: DISCLAIMER }), ...SIZE[kind]));
    out[`trade|${k}`] = sha(await png(createElement(RecordStripImage, { lines: disclaimerAtFoot(tradeLines(open)), disclaimer: DISCLAIMER }), 1200, 630));
    out[`month|${k}`] = sha(await png(createElement(RecordStripImage, { lines: disclaimerAtFoot(monthLines(open)), disclaimer: DISCLAIMER }), 1200, 630));
  }
  return out;
}

test('F-34 AC2: the unfurl, square, trade and month images match their snapshots (deterministic; |none is main\'s)', async () => {
  const got = await draw();
  if (process.env.UPDATE_SNAPSHOT === '1') writeFileSync(FILE, JSON.stringify(got, null, 1) + '\n');
  assert.ok(existsSync(FILE), 'snapshot committed');
  assert.deepEqual(await draw(), got, 'a second draw is byte-identical');
  assert.deepEqual(got, JSON.parse(readFileSync(FILE, 'utf8')));
});

test('F-34 AC2 structural: with open positions only the open rows and the §3 steps differ', () => {
  for (const [name, f] of [['trade', tradeLines], ['month', monthLines]] as const) {
    const none = f(false), open = f(true);
    assert.ok(!none.some((l) => l.role.startsWith('open')), name);
    assert.ok(open.some((l) => l.role.startsWith('open')), name);
    // Every line of today's band is still drawn, in the same order, with the same words ("losses included" may join the
    // count row, §3 step 5); only sizes and the open rows differ.
    const words = (ls: typeof none) => ls.filter((l) => !l.role.startsWith('open')).map((l) => l.text).join(' · ');
    const kept = none.filter((l) => l.role !== 'monthOf').map((l) => l.text);
    let at = 0;
    const w = words(open);
    for (const t of kept) { const i = w.indexOf(t, at); assert.ok(i >= 0, `${name}: "${t}" kept in order`); at = i + t.length; }
  }
  assert.deepEqual(Object.keys(card('unfurl', false)), Object.keys(card('unfurl', true)));
});
