// F-10 / F-12: the record strip's helper, one test per acceptance criterion and committee decision
// (docs/features/logs/F-10/plan.md §7, round 3 amendments).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardEvidence, evidenceRangeText } from './record-card.ts';
import { headline, type ConfidenceInput } from './trades.ts';
import { DISCLAIMER } from './share.ts';
import {
  DISCLAIMER_LINES, feedStrips, fitPx, forgetFeedStrips, IMAGE, IMAGE_COLOURS, layoutBand, lineWidth, RECORD_STRIP, recordStrip, SQUARE_CROP, STRIP_BAND,
  stripEvidence, stripFigures, stripImageLines, type ImageLine, type StripInput, type StripSurface,
} from './record-strip.ts';

const DAY = 86_400_000;
const t0 = Date.UTC(2025, 0, 1);
const now = new Date(Date.UTC(2026, 10, 1, 12));
const tr = (symbol: string, open: number, close: number, r: number): ConfidenceInput => ({
  symbol, openedAt: new Date(t0 + open * DAY), closedAt: new Date(t0 + close * DAY), returnPct: r, holdingDays: close - open,
});
// k one-trade bets that never overlap.
const record = (k: number, f: (i: number) => number) => Array.from({ length: k }, (_, i) => tr(`Q${i}`, i * 3, i * 3 + 2, f(i)));
const wobble = (m: number) => (i: number) => m + (i % 2 ? 0.004 : -0.004);
const R = {
  winning: record(40, wobble(0.009)),
  losing: record(40, wobble(-0.014)),
  under5: record(4, wobble(0.3)),
  wide6: record(6, (i) => (i % 2 ? -0.2 : 0.3)), // 6 bets, half-width far over 10 points
  narrow5: record(5, wobble(0.02)),
  flat: record(20, (i) => (i % 2 ? 0.01 : -0.01)),
};
const SURFACES: StripSurface[] = ['feed', 'page', 'figures', 'image'];
const input = (trades: ConfidenceInput[], o: Partial<StripInput> = {}): StripInput => ({
  ...stripFigures(trades, now), state: 'connected', demo: false, verified: true, handle: 'strip_test', ...o,
});
const range = (trades: ConfidenceInput[]) => evidenceRangeText(cardEvidence(trades, now))!;

test('F-10 AC1 / F-12 AC1: count, average per trade and range from the whole record, losses included', () => {
  const s = recordStrip(input(R.winning), 'feed');
  assert.equal(s.text, `40 closed trades · ${s.figures[1].text} ${range(R.winning)} · 95% range`);
  assert.match(s.figures[1].text, /^\+0\.9% per closed trade$/); // FIXES-CYCLE5 part 2 (C5-5)
  // Dropping a loss changes the average: the strip reads every trade, losses included.
  const mixed = [...R.winning.slice(0, 39), tr('LOSS', 200, 201, -0.5)];
  const without = mixed.slice(0, 39);
  assert.notEqual(recordStrip(input(mixed), 'feed').text, recordStrip(input(without), 'feed').text);
  assert.equal(stripFigures(mixed, now).avg, headline(mixed).avgReturn);
  for (const surface of ['page', 'image'] as const) {
    const p = recordStrip(input(R.winning), surface);
    assert.ok(p.text.includes(`${range(R.winning)} · 95% range · losses included`), p.text);
    assert.equal(p.link?.text, "@strip_test's record");
    assert.equal(p.link?.href, '/u/strip_test');
    assert.equal(p.disclaimer, DISCLAIMER);
  }
});

test('F-10 AC2 + committee: "Too early to tell", never an average, under 5 bets or when the range is too wide', () => {
  for (const [name, trades] of [['under5', R.under5], ['wide6', R.wide6]] as const) {
    assert.equal(cardEvidence(trades, now).tier, 'too-early', name);
    for (const surface of SURFACES) {
      const s = recordStrip(input(trades), surface);
      assert.ok(s.tooEarly);
      const figures = s.figures.filter((p) => p.role !== 'open').map((p) => p.text).join(' ');
      assert.ok(figures.includes(RECORD_STRIP.early), `${name} ${surface}`);
      assert.ok(!/%/.test(figures), `${name} ${surface}: ${figures}`);
      assert.ok(!/average/.test(s.text + s.alt), `${name} ${surface}`);
      assert.ok(!s.figures.some((p) => p.role === 'average' || p.role === 'range'));
    }
    assert.match(recordStrip(input(trades), 'image').alt, /too early to tell/);
  }
  assert.equal(recordStrip(input(R.under5), 'feed').text, '4 closed trades · Too early to tell');
  // 5 narrow bets: a range.
  const five = recordStrip(input(R.narrow5), 'feed');
  assert.ok(!five.tooEarly);
  assert.ok(five.text.includes(range(R.narrow5)));
});

test('F-10 AC3: the strip\'s range is the profile\'s call (cardEvidence + evidenceRangeText) on random records', () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let n = 0; n < 200; n++) {
    const len = 1 + Math.floor(rnd() * 60);
    const trades = Array.from({ length: len }, (_, i) => {
      const open = rnd() * 400, hold = rnd() * 30;
      return tr(`S${Math.floor(rnd() * 8)}`, open, open + hold, (rnd() - 0.45) * 0.6 + (i % 7 === 0 ? -0.3 : 0));
    });
    const e = stripEvidence(trades, now), profile = cardEvidence(trades, now);
    assert.deepEqual(e, { n: profile.n, k: profile.k, tier: profile.tier, perTrade: profile.perTrade });
    const s = recordStrip(input(trades), 'page');
    const rangePart = s.figures.find((p) => p.role === 'range');
    if (profile.tier === 'too-early') assert.equal(rangePart, undefined);
    else {
      assert.equal(rangePart!.text, evidenceRangeText(profile));
      assert.ok(s.text.includes(`${evidenceRangeText(profile)} · 95% range`));
    }
  }
});

test('tone: a negative average is "down" with its sign in the text; zero has no tone; Too early has none', () => {
  const down = recordStrip(input(R.losing), 'feed').figures.find((p) => p.role === 'average')!;
  assert.equal(down.tone, 'down');
  assert.match(down.text, /^-1\.4%/);
  const up = recordStrip(input(R.winning), 'feed').figures.find((p) => p.role === 'average')!;
  assert.equal(up.tone, 'up');
  const flat = recordStrip({ ...input(R.flat), avg: 0 }, 'feed').figures.find((p) => p.role === 'average');
  if (flat) { assert.equal(flat.tone, null); assert.match(flat.text, /^0\.0%/); }
  assert.equal(recordStrip(input(R.under5), 'feed').figures.find((p) => p.role === 'early')!.tone, null);
});

test('F-12 AC2: open positions add the open count on pages and images, never on the feed, never a symbol', () => {
  const o = input(R.winning, { open: [0.12, -0.08, 0.03] });
  for (const surface of ['page', 'image'] as const) {
    const s = recordStrip(o, surface);
    assert.ok(s.text.endsWith('losses included · 3 open, unrealized'), s.text);
    assert.match(s.alt, /3 open positions, unrealized/);
  }
  assert.ok(!/open/.test(recordStrip(o, 'feed').text));
  assert.ok(!/open/.test(recordStrip(o, 'figures').text));
  for (const surface of SURFACES) assert.ok(!/Q\d/.test(recordStrip(o, surface).text + recordStrip(o, surface).alt));
});

test('committee R3-2: the month figures surface has no count part (the month line already says it)', () => {
  for (const trades of [R.winning, R.under5, R.losing]) {
    const s = recordStrip(input(trades), 'figures');
    assert.ok(!s.figures.some((p) => p.role === 'count'));
    assert.ok(!/\b\d[\d,]* closed trades?\b/.test(s.text)); // FIXES-CYCLE5 part 2: the count, not the average's label
    assert.equal(s.link, null);
    assert.equal(s.disclaimer, null);
  }
});

test('F-10 AC11 / F-12 AC10: demo says "Demo" and never "verified"; verified pages say so, the feed strip never does', () => {
  for (const surface of SURFACES) {
    const s = recordStrip(input(R.winning, { demo: true, verified: false }), surface);
    const all = `${s.label?.text ?? ''} ${s.text} ${s.alt}`;
    assert.ok(!/verified/i.test(all), `${surface}: ${all}`);
    if (surface === 'page' || surface === 'image') { assert.equal(s.label?.text, 'Demo data'); assert.match(s.alt, /^Demo data\./); }
  }
  assert.equal(recordStrip(input(R.winning), 'page').label?.text, 'Verified from broker');
  assert.equal(recordStrip(input(R.winning), 'feed').label, null);
  assert.ok(!/verified/i.test(recordStrip(input(R.winning), 'feed').text));
});

test('record state: a failed import keeps its figures with the incomplete line; while importing, no figure at all', () => {
  const failed = recordStrip(input(R.winning, { state: 'failed', verified: true }), 'page');
  assert.equal(failed.label?.text, 'Import did not finish');
  assert.equal(failed.label?.tone, 'warn');
  assert.match(failed.note!, /may be incomplete/);
  assert.ok(failed.figures.length > 0);
  const importing = recordStrip(input(R.winning, { state: 'importing', verified: false }), 'page');
  assert.ok(importing.importing);
  assert.deepEqual(importing.figures, []);
  assert.ok(!/%|losses included/.test(importing.text + importing.alt));
  assert.equal(recordStrip(input(R.winning, { state: 'importing' }), 'feed').importing, null);
});

test('business lead (alt): facts in words, no middle dot or parentheses; the visible strip keeps the profile\'s string', () => {
  const s = recordStrip(input(R.winning, { open: [0.1] }), 'image');
  const [low, high] = range(R.winning).slice(1, -1).split(' to ');
  assert.equal(s.alt, `Verified from broker. 40 closed trades, average per closed trade +0.9%, 95% range ${low} to ${high}. Losses included. 1 open position, unrealized. ${DISCLAIMER}`);
  assert.ok(!/[·()]/.test(s.alt));
  for (const trades of Object.values(R)) assert.ok(!/[·()]/.test(recordStrip(input(trades), 'image').alt));
});

test('no win rate and no completeness words anywhere the strip speaks', () => {
  for (const trades of Object.values(R)) for (const surface of SURFACES) for (const state of ['connected', 'failed', 'importing', 'none'] as const) {
    const s = recordStrip(input(trades, { state, open: [0.1, -0.2] }), surface);
    const all = [s.label?.text, s.note, s.importing, s.text, s.alt, s.link?.text, s.disclaimer].join(' ');
    assert.ok(!/win rate|full record|whole record|full-record|every trade/i.test(all), all);
  }
});

// ---- feed memo (committee R3-1) ----
test('committee R3-1: the feed memo returns exactly a fresh computation, and a rebuild (new newest id) recomputes', () => {
  forgetFeedStrips();
  const rows = R.winning.map((t, i) => ({ ...t, id: String(100 + i) }));
  const first = feedStrips(new Map([[1, rows]]), now).get(1)!;
  assert.deepEqual(first, stripFigures(R.winning, now));
  const hit = feedStrips(new Map([[1, rows]]), now).get(1)!;
  assert.equal(hit, first); // the same object: a hit
  // A rebuild renumbers the rows (new ids) with one more loss: a miss, and the new figures.
  const rebuilt = [...R.winning, tr('LOSS', 300, 301, -0.4)].map((t, i) => ({ ...t, id: String(500 + i) }));
  const after = feedStrips(new Map([[1, rebuilt]]), now).get(1)!;
  assert.notEqual(after, first);
  assert.deepEqual(after, stripFigures(rebuilt.map(({ id: _id, ...t }) => t), now));
});

// ---- images ----
const hero: ImageLine[] = [
  { role: 'symbol', text: 'ABCDEFGH +1234.5%', size: fitPx('ABCDEFGH +1234.5%', 80), tone: 'text', weight: 800 },
  { role: 'held', text: 'held 365 days · closed Dec 31, 2026', size: 26, tone: 'muted', weight: 400 },
  { role: 'thesis', text: '“A long thesis that may give way”', size: 26, tone: 'text', weight: 400, optional: true },
];

test('F-12 AC3 (model): every band line inside the safe area at the legibility floor, worst cases included', () => {
  const worst = [
    input(R.winning, { state: 'failed', open: [0.1, 0.2], handle: 'abcdefghijklmnopqrst' }),
    { ...input(R.winning, { open: [1] }), evidence: { n: 1234, k: 900, tier: 'thin' as const, perTrade: { low: -1, mid: 0.1, high: 1.234 } }, avg: -1.234 },
    { ...input(R.winning), evidence: { n: 9999, k: 900, tier: 'thin' as const, perTrade: { low: -1, mid: 0.1, high: 12.345 } }, avg: 12.345 },
    input(R.under5, { demo: true, verified: false }),
    input(R.winning, { state: 'importing' }),
  ];
  for (const i of worst) {
    const s = recordStrip(i, 'image');
    const { lines, fits, tooWide } = layoutBand(stripImageLines(s, { handle: i.handle, newRecord: true, hero }));
    assert.ok(fits, `fits: ${s.text}`);
    assert.deepEqual(tooWide, []);
    for (const l of lines) {
      assert.ok(l.y! >= STRIP_BAND.top && l.y! + l.size * STRIP_BAND.lineHeight <= STRIP_BAND.bottom, `${l.role} y`);
      assert.ok(STRIP_BAND.x >= SQUARE_CROP.x0 && STRIP_BAND.x + STRIP_BAND.width <= SQUARE_CROP.x1);
      assert.ok(lineWidth(l) <= STRIP_BAND.width, `${l.role}: ${l.text}`);
      assert.ok(l.size >= STRIP_BAND.minPx, `${l.role} ${l.size}`);
      assert.ok(!l.text.includes('…'));
      if (['count', 'average', 'early'].includes(l.role)) assert.equal(l.size, STRIP_BAND.recordPx, l.role);
      if (l.role === 'range') assert.ok(l.size >= STRIP_BAND.rangeMinPx, `range ${l.size}: ${l.text}`);
    }
    // "losses included" and the disclaimer always survive.
    const roles = lines.map((l) => l.role);
    assert.ok(roles.includes('disclaimer2'));
    if (!s.importing) assert.ok(lines.some((l) => l.text.startsWith('losses included')));
  }
  assert.equal(DISCLAIMER_LINES.join(' '), DISCLAIMER);
});

test('F-12 AC3 (model): the range keeps the profile\'s "· 95% range" when it fits at ≥ 30 px, else drops only the dot', () => {
  const at = (low: number, high: number) => {
    const s = recordStrip({ ...input(R.winning), evidence: { n: 50, k: 50, tier: 'thin', perTrade: { low, mid: 0, high } } }, 'image');
    return stripImageLines(s, { handle: 'h', newRecord: false, hero: [] }).find((l) => l.role === 'range')!;
  };
  assert.equal(at(-0.001, 0.021).text, '(-0.1% to +2.1%) · 95% range');
  assert.ok(at(-0.001, 0.021).size >= 30);
  const wide = at(-1, 1.234);
  assert.equal(wide.text, '(-100.0% to +123.4%) · 95% range'); // 32 chars: 30 px
  assert.ok(wide.size >= 30);
  const wider = at(-1, 12.345);
  assert.equal(wider.text, '(-100.0% to +1234.5%) 95% range'); // the dot gives way first
  assert.ok(wider.size >= 30);
});

test('F-12 AC3: every image colour has at least 4.5:1 contrast on the image background', () => {
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  for (const [name, c] of Object.entries(IMAGE_COLOURS)) {
    const x = lum(c), y = lum(IMAGE.bg);
    assert.ok((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) >= 4.5, name);
  }
});

test('F-12 AC3: the thesis is the one line that gives way; the record lines never do', () => {
  const s = recordStrip(input(R.winning, { state: 'failed', open: [0.1] }), 'image');
  const big = [...hero, { role: 'thesis2', text: 'more', size: 26, tone: 'text' as const, weight: 400 as const, optional: true }];
  const { lines, fits } = layoutBand(stripImageLines(s, { handle: 'abcdefghijklmnopqrst', newRecord: true, hero: big }));
  assert.ok(fits);
  for (const r of ['count', 'average', 'range', 'losses', 'disclaimer0', 'disclaimer1', 'disclaimer2']) assert.ok(lines.some((l) => l.role === r), r);
});
