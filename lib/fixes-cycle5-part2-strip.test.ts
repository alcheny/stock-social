// FIXES-CYCLE5 part 2 (C5-5): "per closed trade" on every strip (legal committee 2026-11-02 §3d C14-C16 and its
// addendum C17-C20; committee round 2 items 1 and 11). Visible: "‹figure› per closed trade" (RECORD_STRIP.perClosedShort);
// width-free text (alt, link previews): "average per closed trade". One producer: lib/record-strip.ts#stripAverage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { type ConfidenceInput } from './trades.ts';
import { RECORD_STRIP, SHARE_CARD } from './copy.ts';
import { layoutBand, recordStrip, STRIP_BAND, stripAverage, stripFigures, stripImageLines, stripTextAfterCount, type StripInput, type StripSurface } from './record-strip.ts';
import { tradeAlt, tradeDescription } from './trade-share.ts';

const DAY = 86_400_000;
const t0 = Date.UTC(2025, 0, 1);
const now = new Date(Date.UTC(2026, 10, 1, 12));
const record = (k: number, f: (i: number) => number): ConfidenceInput[] => Array.from({ length: k }, (_, i) => ({
  symbol: `Q${i}`, openedAt: new Date(t0 + i * 3 * DAY), closedAt: new Date(t0 + (i * 3 + 2) * DAY), returnPct: f(i), holdingDays: 2,
}));
const wobble = (m: number) => (i: number) => m + (i % 2 ? 0.004 : -0.004);
const R = { winning: record(40, wobble(0.009)), losing: record(40, wobble(-0.014)), under5: record(4, wobble(0.3)) };
const SURFACES: StripSurface[] = ['feed', 'page', 'figures', 'image'];
const input = (trades: ConfidenceInput[], o: Partial<StripInput> = {}): StripInput => ({ ...stripFigures(trades, now), state: 'connected', demo: false, verified: true, handle: 'strip_p2', ...o });

test('C14/C18/C19: every strip prints "‹figure› per closed trade"; the alt says "average per closed trade"; never "average per trade"', () => {
  for (const [k, trades] of Object.entries(R)) {
    for (const surface of SURFACES) {
      const s = recordStrip(input(trades), surface);
      const avg = s.figures.find((p) => p.role === 'average');
      assert.doesNotMatch(s.text, /average per trade/, `${k} ${surface}`);
      assert.doesNotMatch(s.alt, /average per trade/, `${k} ${surface}`);
      if (!avg) continue;
      // C19: exactly the signed figure, then the words (pct()'s "Flat"/"≈" forms allowed).
      assert.match(avg.text, /^(?:[+−-]?[\d.,]+%|≈-?[\d.,]+%|0\.0%) per closed trade$/, `${k} ${surface}: ${avg.text}`);
      assert.match(s.text, /per closed trade/);
      assert.match(s.alt, /average per closed trade [+−-]?\d/, `${k} ${surface}: ${s.alt}`);
    }
  }
  assert.equal(RECORD_STRIP.perClosedShort, 'per closed trade');
  assert.equal(SHARE_CARD.perClosedTrade, 'average per closed trade');
  assert.equal(stripAverage(0.009, 'short'), '+0.9% per closed trade');
  assert.equal(stripAverage(-0.014, 'alt'), 'average per closed trade -1.4%');
  assert.equal(stripAverage(-0.014, 'preview'), '-1.4% average per closed trade');
});

test('C17: the short form prints only after the count and before the range (or "Too early to tell"), on HTML strips and images', () => {
  for (const [k, trades] of Object.entries(R)) {
    for (const surface of ['feed', 'page', 'image'] as const) {
      const s = recordStrip(input(trades), surface);
      const roles = s.figures.map((p) => p.role);
      const a = roles.indexOf('average');
      if (a < 0) { assert.ok(roles.includes('early'), `${k} ${surface}`); continue; }
      assert.ok(roles.indexOf('count') >= 0 && roles.indexOf('count') < a, `${k} ${surface}: count first`);
      assert.equal(roles[a + 1], 'range', `${k} ${surface}: the range right after`);
      if (surface === 'image') {
        const L = stripImageLines(s, { handle: 'strip_p2', newRecord: false, hero: [] }).map((l) => l.role);
        assert.ok(L.indexOf('count') < L.indexOf('average') && L.indexOf('average') < L.indexOf('range'), L.join(','));
      }
    }
  }
});

test('C18: the link preview built from a strip keeps the full words; the trade alt does too', () => {
  const s = recordStrip(input(R.winning), 'page');
  assert.match(stripTextAfterCount(s), /^\+0\.9% average per closed trade \(\+\d\.\d% to \+\d\.\d%\) · 95% range · losses included$/);
  const view = { symbol: 'Q1', returnPct: 0.02, holdingDays: 2, closedAt: new Date(t0).toISOString(), thesis: null, handle: 'strip_p2', newRecord: false,
    state: 'connected', demo: false, verified: true, record: { trades: 40 } } as unknown as Parameters<typeof tradeAlt>[0];
  assert.match(tradeAlt(view, s), /average per closed trade \+0\.9%/);
  assert.doesNotMatch(tradeAlt(view, s), /average per trade/);
  const d = tradeDescription(view, s);
  assert.match(d, /average per closed trade/);
  assert.doesNotMatch(d, /average per trade/);
});

test('C15/C20: wording only: with open positions the strip adds no unrealized value; the text differs from the old wording by the label alone', () => {
  for (const surface of SURFACES) {
    const s = recordStrip(input(R.winning, { open: [0.12, -0.3] }), surface);
    assert.doesNotMatch(s.text, /unrealized [+−-]?\d|[+−-]12\.0%|-30\.0%/);
    const old = s.text.replace(` ${RECORD_STRIP.perClosedShort}`, ` ${SHARE_CARD.perTrade}`);
    assert.equal(old.replace(' average per trade', ` ${RECORD_STRIP.perClosedShort}`), s.text);
  }
});

test('D1: worst-case averages keep the average line at the 35 px record size, inside the 582 px band', () => {
  for (const r of [-1, -0.99999, 123.45, -0.9999999]) {
    const trades = record(40, (i) => r + (i % 2 ? 1e-6 : -1e-6));
    const s = recordStrip(input(trades), 'image');
    const lines = stripImageLines(s, { handle: 'strip_p2', newRecord: false, hero: [] });
    const avg = lines.find((l) => l.role === 'average');
    if (!avg) continue; // a zero-width record prints "Too early to tell" (lib/zero-width.ts)
    assert.equal(avg.size, STRIP_BAND.recordPx, avg.text);
    assert.deepEqual(layoutBand(lines).tooWide.filter((t) => t === avg.text), [], avg.text);
  }
  for (const avg of [-1, 123.45, -0.99999]) {
    const text = stripAverage(avg, 'short');
    assert.ok(text.length * STRIP_BAND.recordPx * STRIP_BAND.glyph <= STRIP_BAND.width, `${text} fits at 35 px`);
  }
});

test('one producer: record-strip.ts builds both forms from the two constants; no strip surface spells "per closed trade" itself', () => {
  const src = readFileSync(new URL('./record-strip.ts', import.meta.url), 'utf8');
  assert.match(src, /export const stripAverage = /);
  assert.equal(src.match(/RECORD_STRIP\.perClosedShort/g)!.length >= 1, true);
  assert.doesNotMatch(src.replace(/\/\/.*$/gm, ''), /'per closed trade'|'average per closed trade'/);
  // C16: the /t baselines are out of scope and keep their words.
  assert.match(readFileSync(new URL('./copy.ts', import.meta.url), 'utf8'), /95% range of the average per trade/);
});
