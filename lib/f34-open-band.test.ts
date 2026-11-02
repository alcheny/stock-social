// F-34 plan §3a (BL4, EN1, BL-R2-2, EN-R2-1, EN-R2-2): the 192-state fit matrix, run through the real trade and month
// bands (lib/trade-share.ts#tradeBand, lib/month-card.ts#monthBand over lib/record-strip.ts#stripImageLines, with the
// real tradeHero and monthHero). Template: docs/features/logs/F-34/fit/f34-fit-matrix.ts.txt. Every state fits with the
// disclaimer at 28 px or more, the open values never smaller than the record rows, "losses included" at least 26 px and
// 4.5:1 inside the band, every open fact and the as-of present, "record frozen" in every frozen state, and the
// "Disconnected ‹date›" row kept outside the 14 named step-11 states (all month images).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordStrip, STRIP_BAND, IMAGE_COLOURS, type ImageLine } from './record-strip.ts';
import { tradeBand, tradeHero, tradeSharePayload, tradeStripInput } from './trade-share.ts';
import { monthBand, monthHero } from './month-card.ts';
import { monthRecap, wholeRecord } from './recap.ts';
import { contrast } from './colour-math.ts';
import { IMAGE_PALETTE } from './palette.ts';
import { openFacts } from './open-split.ts';
import { openLine } from './copy.ts';

const NOW = new Date(Date.UTC(2026, 9, 20, 12)), DAY = 864e5, t0 = Date.UTC(2025, 0, 1);
const AS_OF = new Date(Date.UTC(2026, 8, 30, 15));
let seq = 0;
const tr = (o: number, c: number, r: number) => ({ sellId: `s${seq++}`, symbol: `Q${seq}`, openedAt: new Date(t0 + o * DAY), closedAt: new Date(t0 + c * DAY), returnPct: r, holdingDays: c - o, verified: true });
const all = [...Array.from({ length: 40 }, (_, i) => tr(i * 3, i * 3 + 2, i % 2 ? 0.013 : 0.005)), ...Array.from({ length: 8 }, (_, i) => tr(600 + i, 608 + i, -0.05))];
const FROZEN = 'Disconnected Sep 30, 2026 · record frozen';
const W = STRIP_BAND.width;
const pcts = (n: number, long: boolean) => {
  const low = long ? -0.9998 : -0.15, high = long ? 10.887 : 0.04;
  if (n === 1) return [low];
  if (n === 3) return [low, high, 0.012];
  return [low, high, 0.02, 0.01, -0.01, -0.01, -0.01, -0.01, -0.01, -0.01, -0.01, 0];
};

// The 14 states that reach step 11 (plan §3a): only the failed-note rows and/or the "Disconnected ‹date›" row give way.
const STEP11 = new Set(['h=10', 'h=20'].flatMap((h) => [
  `month ${h} connected opts=Y frozen=Y n=12 long=Y`,
  `month ${h} failed opts=n frozen=Y n=12 long=Y`,
  `month ${h} failed opts=Y frozen=n n=12 long=Y`,
  `month ${h} failed opts=Y frozen=Y n=3 long=n`,
  `month ${h} failed opts=Y frozen=Y n=3 long=Y`,
  `month ${h} failed opts=Y frozen=Y n=12 long=n`,
  `month ${h} failed opts=Y frozen=Y n=12 long=Y`,
]));

type Band = ReturnType<typeof tradeBand>;
function bandFor(kind: 'trade' | 'month', handle: string, state: 'connected' | 'failed', opts: boolean, frozen: string | null, open: number[]): Band {
  if (kind === 'trade') {
    const pick = all[all.length - 1];
    const p = tradeSharePayload({ symbol: 'ABCDEFGHIJ', returnPct: -0.987, holdingDays: 0.2, closedAt: pick.closedAt, thesis: 'A thesis that runs well past the width of the band', thesisStatus: 'published', demo: false, allTrades: all }, NOW);
    const t = { ...p, handle, displayName: 'A', state, verified: true, excludingOptions: opts, open, openAsOf: AS_OF };
    return tradeBand(t, recordStrip(tradeStripInput(t), 'image'), frozen);
  }
  const m = monthRecap(all, '2026-09', NOW)!, w = wholeRecord(all, NOW);
  const who = { state, demo: false, verified: true, handle };
  const whole = recordStrip({ ...w.strip, ...who, excludingOptions: opts, open, openAsOf: AS_OF }, 'image');
  const month = recordStrip({ ...m.figures!, ...who, monthExcludingOptions: opts }, 'figures');
  return monthBand({ handle, recap: m, record: { newRecord: false }, months: 22 }, whole, month, frozen);
}

const results: { key: string; band: Band; frozen: boolean; n: number; long: boolean }[] = [];
for (const kind of ['trade', 'month'] as const)
for (const handle of ['f12_trader', 'abcdefghijklmnopqrst'])
for (const state of ['connected', 'failed'] as const)
for (const opts of [false, true])
for (const frozen of [null, FROZEN])
for (const n of [1, 3, 12])
for (const long of [false, true]) {
  const key = `${kind} h=${handle.length} ${state} opts=${opts ? 'Y' : 'n'} frozen=${frozen ? 'Y' : 'n'} n=${n} long=${long ? 'Y' : 'n'}`;
  results.push({ key, band: bandFor(kind, handle, state, opts, frozen, pcts(n, long)), frozen: !!frozen, n, long });
}

const REC = ['count', 'average', 'range', 'early'];
const wide = (l: ImageLine) => l.text.length * l.size * STRIP_BAND.glyph > W;

test('F-34 §3a: 192 states, every one fits the band with the disclaimer at 28 px or more', () => {
  assert.equal(results.length, 192);
  const bad = results.filter((r) => !r.band.fits || r.band.tooWide.length || r.band.lines.some(wide)).map((r) => r.key);
  assert.deepEqual(bad, []);
  for (const r of results) {
    const disc = r.band.lines.filter((l) => l.role.startsWith('disclaimer'));
    assert.equal(disc.length, 3, r.key);
    assert.ok(disc.every((l) => l.size >= 28), `${r.key}: disclaimer ${disc[0].size}`);
    assert.ok(r.band.lines.every((l) => (l.y ?? 0) >= STRIP_BAND.top && (l.y ?? 0) + l.size * STRIP_BAND.lineHeight <= STRIP_BAND.bottom + 0.01), `${r.key}: inside y`);
  }
});

test('F-34 §3a: the open values are never smaller than the record rows (o ≥ r), the record rows step 30/28/26 px', () => {
  for (const r of results) {
    const open = r.band.lines.filter((l) => l.role.startsWith('open'));
    const rec = r.band.lines.filter((l) => REC.includes(l.role));
    assert.ok(open.length >= 1, r.key);
    const o = Math.min(...open.map((l) => l.size));
    assert.ok([30, 28, 26].includes(o), `${r.key}: open ${o}`);
    assert.ok(rec.every((l) => l.size <= o && l.size >= 26), `${r.key}: record rows ${rec.map((l) => l.size)} vs open ${o}`);
    assert.equal(open[0].weight, 700, r.key);
    assert.ok(open.every((l) => l.block === 'open'), r.key);
    assert.deepEqual(r.band.step && [r.band.step.o >= r.band.step.r], [true], r.key);
  }
});

test('F-34 §3a BL4: "losses included" is at least 26 px, at least 4.5:1, inside x 309–891 in every state', () => {
  for (const r of results) {
    const l = r.band.lines.find((x) => x.text.includes('losses included'));
    assert.ok(l, r.key);
    assert.ok(l.size >= 26 && !wide(l), `${r.key}: ${l.size}`);
    assert.ok(contrast(IMAGE_COLOURS[l.tone], IMAGE_PALETTE.stripBg) >= 4.5, r.key);
    const o = Math.min(...r.band.lines.filter((x) => x.role.startsWith('open')).map((x) => x.size));
    if (l.role === 'losses') assert.ok(l.size <= o && l.size >= 26, r.key);
  }
});

test('F-34 §3a: every open part and the as-of with its year are on the open rows', () => {
  for (const r of results) {
    const line = openLine(openFacts(pcts(r.n, r.long)), AS_OF)!;
    const rows = r.band.lines.filter((l) => l.role.startsWith('open')).map((l) => l.text).join(' / ');
    assert.ok(rows.includes(line.image.title), `${r.key}: ${rows}`);
    for (const p of line.parts.slice(1)) assert.ok(rows.includes(p.value === null ? p.label : `${p.label} ${p.value} ${p.word}`), `${r.key}: ${p.label} in ${rows}`);
    assert.ok(rows.includes('as of Sep 30, 2026'), r.key);
  }
});

test('F-34 §3a BL-R2-2: "record frozen" is kept in all 96 frozen states', () => {
  const frozen = results.filter((r) => r.frozen);
  assert.equal(frozen.length, 96);
  assert.deepEqual(frozen.filter((r) => !r.band.lines.some((l) => l.text.includes('record frozen'))).map((r) => r.key), []);
});

test('F-34 §3a EN-R2-1: step 11 runs in exactly the 14 named month states; elsewhere "Disconnected ‹date›" and the failed note stay', () => {
  const last = results.filter((r) => r.band.step?.last).map((r) => r.key).sort();
  assert.deepEqual(last, [...STEP11].sort());
  for (const r of results) {
    const text = r.band.lines.map((l) => l.text).join(' / ');
    if (r.frozen && !STEP11.has(r.key)) assert.ok(text.includes('Disconnected Sep 30, 2026'), `${r.key}: Disconnected kept`);
    if (r.key.includes(' failed ') && !STEP11.has(r.key)) assert.ok(r.band.lines.some((l) => l.role.startsWith('note')), `${r.key}: failed note kept`);
    if (r.key.includes(' failed ')) assert.ok(r.band.lines.some((l) => l.role === 'label' && l.text.startsWith('Import did not finish')), `${r.key}: label kept`);
  }
  for (const k of STEP11) assert.ok(k.startsWith('month '), k);
});

test('F-34 §3a: the real monthHero and tradeHero are what the bands draw', () => {
  const m = monthRecap(all, '2026-09', NOW)!;
  const month = recordStrip({ ...m.figures!, state: 'connected', demo: false, verified: true, handle: 'f12_trader' }, 'figures');
  const hero = monthHero({ handle: 'f12_trader', recap: m, record: { newRecord: false } }, month, 52, 30);
  assert.equal(hero[0].role, 'month');
  const r = results.find((x) => x.key === 'month h=10 connected opts=n frozen=n n=1 long=n')!;
  assert.ok(r.band.lines.some((l) => l.role === 'month' && l.text === hero[0].text));
  const t = results.find((x) => x.key === 'trade h=10 connected opts=n frozen=n n=1 long=n')!;
  assert.ok(t.band.lines.some((l) => l.role === 'symbol' && l.text === tradeHero({ symbol: 'ABCDEFGHIJ', returnPct: -0.987, holdingDays: 0.2, closedAt: all[47].closedAt.toISOString(), thesis: null })[0].text));
});

test('F-34 §3: images with no open positions keep today\'s band (no step, the record rows at 35 px)', () => {
  const r = bandFor('trade', 'f12_trader', 'connected', false, null, []);
  assert.equal(r.step, undefined);
  assert.ok(r.lines.filter((l) => l.role === 'count' || l.role === 'average').every((l) => l.size === 35));
  assert.ok(!r.lines.some((l) => l.role.startsWith('open')));
});
