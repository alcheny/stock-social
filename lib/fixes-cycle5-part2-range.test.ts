// FIXES-CYCLE5 part 2 (C5-4): a zero-width 95% range prints "Too early to tell" and carries no verdict, on every surface
// that prints a range or a verdict (legal committee 2026-11-02 §3c, C9-C13; committee round 2 items 3, 6 and 9).
// Fictional records only (POLICY P2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { earlyText, rangePair, shownEvidence, zeroWidth } from './zero-width.ts';
import { cardAlt, cardDescription, cardEvidence, recordCard, type CardKind } from './record-card.ts';
import { recordStrip, stripFigures, stripImageLines, stripTextAfterCount, type StripSurface } from './record-strip.ts';
import { paneEvidence } from './pane-evidence.ts';
import { paneModel } from './pane-model.ts';
import { confidence, evidenceLine, evidenceWeight, rangeText, type ConfidenceInput } from './trades.ts';
import { baselineKind, baselineLines, compareEvidenceText, tickerDescription, tickerSummary, type TickerRow } from './ticker.ts';
import { trustLine } from './confidence.ts';
import { monthRecap, wholeRecord } from './recap.ts';
import { tradeSharePayload } from './trade-share.ts';
import { snapshotText } from './display-log.ts';
import { optionRangeText, optionsLineText } from './options-view.ts';
import { DISCLAIMER } from './share.ts';
import { RECORD_STRIP } from './copy.ts';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 6, 1);
const NOW = new Date(T0 + 120 * DAY);
// Ten non-overlapping closes, one every 6 days, each in its own symbol: ten independent bets.
const record = (r: (i: number) => number, n = 10): ConfidenceInput[] => Array.from({ length: n }, (_, i) => ({
  symbol: `ZW${i}`, openedAt: new Date(T0 + i * 6 * DAY), closedAt: new Date(T0 + (i * 6 + 2) * DAY), returnPct: r(i), holdingDays: 2,
}));
const GAIN = record(() => 0.01);
const LOSS = record(() => -0.01);
const MIXED = record((i) => [0.01, 0.0101, 0.0099][i % 3]);
// Near the boundary: a range under 0.1 points wide whose ends still print apart.
const NEAR_GAIN = record((i) => (i % 2 ? 0.0108 : 0.0102));
const NEAR_LOSS = record((i) => (i % 2 ? -0.0108 : -0.0102));
const WIDE = record((i) => (i % 2 ? 0.012 : 0.008));
const ZERO = { GAIN, LOSS, MIXED };

const VERDICT = /Past results:|above zero|below zero|unclear/;
const KINDS: CardKind[] = ['unfurl', 'square', 'story'];
const SURFACES: StripSurface[] = ['feed', 'page', 'figures', 'image'];
const card = (trades: ConfidenceInput[], kind: CardKind) =>
  recordCard({ kind, handle: 'zw_trader', name: 'Zed Width', trades, state: 'connected', demo: false, verified: true, now: NOW, link: 'example.com/u/zw_trader' });
const strip = (trades: ConfidenceInput[], surface: StripSurface) =>
  recordStrip({ ...stripFigures(trades, NOW), state: 'connected', demo: false, verified: true, handle: 'zw_trader' }, surface);
const tickerRows = (trades: ConfidenceInput[]): TickerRow[] => trades.map((t, i) => ({ userId: i, returnPct: t.returnPct, holdingDays: t.holdingDays, openedAt: t.openedAt, closedAt: t.closedAt, verified: true }));

// Every text a zero-width record produces, labelled by surface.
function outputs(trades: ConfidenceInput[]): [string, string][] {
  const out: [string, string][] = [];
  for (const kind of KINDS) {
    const m = card(trades, kind);
    out.push([`card ${kind} trust`, m.trust ?? ''], [`card ${kind} alt`, cardAlt(m)]);
    if (kind === 'unfurl') out.push(['card description', cardDescription(m) ?? '']);
  }
  for (const s of SURFACES) {
    const st = strip(trades, s);
    out.push([`strip ${s} text`, st.text], [`strip ${s} alt`, st.alt]);
    if (s === 'image') out.push(['strip image lines', stripImageLines(st, { handle: 'zw_trader', newRecord: false, hero: [] }).map((l) => l.text).join(' | ')]);
    if (s === 'page') out.push(['strip preview', stripTextAfterCount(st)]);
  }
  const pane = paneModel(trades.map((t, i) => ({ id: String(i), symbol: t.symbol, returnPct: t.returnPct, holdingDays: t.holdingDays, closedAt: t.closedAt, openedAt: t.openedAt, thesis: null, verified: true })), 'connected', NOW);
  out.push(['pane rangeLine', paneEvidence(trades, NOW).rangeLine ?? ''], ['pane JSON', JSON.stringify(pane)]);
  out.push(['profile evidence', evidenceLine(cardEvidence(trades, NOW))], ['confidence evidence', evidenceLine(confidence(trades, NOW))]);
  const ts = tickerSummary(tickerRows(trades), NOW);
  out.push(['compare evidence', compareEvidenceText(ts.conf!)], ['ticker description', tickerDescription('ZWGN', ts)]);
  const bl = baselineLines('ZWGN', ts, { n: ts.n, conf: ts.conf });
  out.push(['baseline', `${bl.this} ${bl.others}`]);
  const rt = trades.map((t, i) => ({ ...t, sellId: `zw-${i}` }));
  out.push(['month recap', JSON.stringify(monthRecap(rt, '2026-07', NOW))], ['whole record', JSON.stringify(wholeRecord(rt, NOW))]);
  out.push(['trade share payload', JSON.stringify(tradeSharePayload({ symbol: 'ZW0', returnPct: 0.01, holdingDays: 2, closedAt: trades[0].closedAt, thesis: null, thesisStatus: null, demo: false, allTrades: trades }, NOW))]);
  out.push(['display log', JSON.stringify(snapshotText(trades, [], NOW))]);
  return out;
}

test('C9: zero-width is decided at printed precision (+1.0%, -1.0%, and 1.00/1.01/0.99% all print one value); a range a digit apart is not', () => {
  for (const [k, t] of Object.entries(ZERO)) {
    const c = cardEvidence(t, NOW);
    assert.equal(c.zeroWidth, true, k);
    assert.equal(c.perTrade, null, k);
    assert.ok(zeroWidth(confidence(t, NOW).perTrade), k);
  }
  for (const [k, t] of Object.entries({ NEAR_GAIN, NEAR_LOSS })) {
    const c = cardEvidence(t, NOW);
    assert.equal(c.zeroWidth, undefined, k);
    assert.match(rangePair(c.perTrade)!, /^\(-?\+?1\.0% to -?\+?1\.1%\)$|^\(-1\.1% to -1\.0%\)$/, k);
  }
  // The surface's own digits decide: at two decimals the 1.00/1.01/0.99 record is no longer zero-width.
  const iv = { low: 0.0099, high: 0.0101 };
  assert.equal(zeroWidth(iv), true);
  assert.equal(zeroWidth(iv, 2), false);
  assert.equal(zeroWidth(null), false);
  assert.equal(earlyText(3), 'Too early to tell (3 of 5 bets)');
  assert.equal(earlyText(10), 'Too early to tell');
  // Idempotent, and a non-zero-width record comes back as the same object.
  const once = shownEvidence(confidence(GAIN, NOW));
  assert.deepEqual(shownEvidence(once), once);
  const wide = confidence(WIDE, NOW);
  assert.equal(shownEvidence(wide), wide);
});

test('C11/C12: every surface prints "Too early to tell" for a zero-width record, no verdict, never an empty range', () => {
  for (const [k, t] of Object.entries(ZERO)) {
    for (const [where, text] of outputs(t)) {
      assert.doesNotMatch(text, VERDICT, `${k} ${where}: ${text}`);
      assert.doesNotMatch(text, /\(\s*\)|\bto \)|of 5 bets|\(\+?-?1\.0% to \+?-?1\.0%\)/, `${k} ${where}: ${text}`);
      assert.doesNotMatch(text, /(^|[^)\d%]) · 95% range/, `${k} ${where}: a range label with no range: ${text}`);
      // The baseline prints counts only on both sides when either has no range (D-07): no range slot to fill.
      if (!/JSON|payload|recap|whole record|display log|image lines|baseline/.test(where)) assert.match(text, /Too early to tell|too early/i, `${k} ${where}: ${text}`);
    }
    // The JSON payloads carry no range and no verdict the screen does not print.
    for (const [where, text] of outputs(t).filter(([w]) => /JSON|payload|recap|whole record|display log/.test(w))) {
      assert.doesNotMatch(text, /"edge":"(positive|negative|unclear)"/, where);
      assert.match(text, /Too early to tell|"range":null|"perTrade":null|"rangeLine":"Too early to tell"/, where);
    }
    assert.match(outputs(t).find(([w]) => w === 'strip image lines')![1], /Too early to tell/);
    assert.equal(paneEvidence(t, NOW).rangeLine, RECORD_STRIP.early, k);
    assert.equal(evidenceLine(confidence(t, NOW)), 'Too early to tell (10 bets)', k);
    assert.equal(trustLine(cardEvidence(t, NOW)), 'Based on 10 trades. Too early to tell.', k);
    assert.equal(rangeText(confidence(t, NOW)), null, k);
    // The disclaimer is unchanged where it was printed.
    assert.ok(cardAlt(card(t, 'square')).endsWith(DISCLAIMER), k);
  }
});

test('round 2 item 6: the zero-width card says "too early" exactly once (its trust line), with no duplicate evidence word', () => {
  for (const [k, t] of Object.entries(ZERO)) {
    for (const kind of KINDS) {
      const m = card(t, kind);
      assert.equal(m.range, null);
      assert.equal(m.evidence, null);
      const visible = [m.label, m.headline, m.headlineLabel, m.range, m.count, m.period, m.evidence, m.trust, m.caption, m.disclaimer].filter(Boolean).join(' ');
      assert.equal(visible.match(/too early/gi)?.length, 1, `${k} ${kind}: ${visible}`);
    }
    assert.doesNotMatch(cardAlt(card(t, 'unfurl')), /null|undefined/);
    assert.match(cardDescription(card(t, 'unfurl'))!, / · Too early to tell$/);
  }
});

test('C10: losses read like gains: the +1% and -1% records give string-identical outputs once the sign is masked; near-boundary too', () => {
  const mask = (s: string) => s.replace(/[+−-](?=\d)/g, '±').replace(/\b(gain|loss)\b/g, 'G').replace(/\b(up|down)\b/g, 'U').replace(/ZWGN|ZWLS/g, 'Z').replace(/\d+% win rate/g, 'W win rate');
  const a = outputs(GAIN).map(([w, t]) => [w, mask(t)]);
  const b = outputs(LOSS).map(([w, t]) => [w, mask(t)]);
  for (let i = 0; i < a.length; i++) if (!/JSON|payload|recap|whole record|display log/.test(a[i][0])) assert.equal(a[i][1], b[i][1], a[i][0]);
  assert.equal(mask(evidenceLine(cardEvidence(NEAR_GAIN, NOW))).replace(/above|below/, 'X'), mask(evidenceLine(cardEvidence(NEAR_LOSS, NOW))).replace(/above|below/, 'X'));
  assert.equal(mask(rangePair(cardEvidence(NEAR_GAIN, NOW).perTrade)!).length, mask(rangePair(cardEvidence(NEAR_LOSS, NOW).perTrade)!).length);
});

test('round 2 item 3: baselineKind reads the shown evidence (a zero-width side is too_few_trades, never shown); the options line goes through the rule', () => {
  const zs = tickerSummary(tickerRows(GAIN), NOW);
  assert.equal(baselineKind(zs, { n: 10 }), 'too_few_trades');
  assert.equal(baselineKind(zs, { n: 10 }, { conf: zs.conf }), 'too_few_trades');
  const ws = tickerSummary(tickerRows(WIDE), NOW);
  assert.equal(baselineKind(ws, { n: 10 }), 'shown');
  assert.equal(baselineLines('ZWGN', zs, { n: 10, conf: ws.conf }).ranged, false);
  // Options: a zero-width range reads "Too early to tell"; a real range and "no range" are as before.
  const opt = (range: { low: number; high: number } | null) => ({ n: 12, winRate: 1, avg: 0.01, range, bets: 12 });
  assert.equal(optionRangeText(opt({ low: 0.0099, high: 0.0101 })), RECORD_STRIP.early);
  assert.match(optionsLineText(opt({ low: 0.0099, high: 0.0101 })), /\+1\.0% avg · Too early to tell$/);
  assert.match(optionsLineText(opt({ low: 0.005, high: 0.015 })), /\+1\.0% avg \(\+0\.5% to \+1\.5%\)$/);
  assert.match(optionsLineText(opt(null)), /\+1\.0% avg$/);
});

test('C13: ranking is untouched: evidence weights are those confidence() gives, and the ranking files are unchanged', () => {
  assert.equal(evidenceWeight(confidence(GAIN, NOW)).toFixed(3), evidenceWeight({ ...confidence(GAIN, NOW) }).toFixed(3));
  assert.ok(evidenceWeight(confidence(GAIN, NOW)) > 0, 'a zero-width record still weighs what it weighed');
  assert.ok(Math.abs(evidenceWeight(confidence(GAIN, NOW)) - evidenceWeight(confidence(LOSS, NOW))) < 0.01);
  const ranking = /export (const evidenceWeight|function confidenceFromSums|function rankTraders)/;
  const trades = readFileSync(new URL('./trades.ts', import.meta.url), 'utf8');
  assert.match(trades, ranking);
  for (const f of ['./feed.ts', './discovery/weights.ts']) assert.doesNotMatch(readFileSync(new URL(f, import.meta.url), 'utf8'), /zero-width|shownEvidence/, f);
  // The diff against part 1 (the branch part 2 stacks on, which carries F5-5's cache change to lib/feed.ts) leaves the
  // ranking code byte-unchanged; skipped outside a git checkout that has part 1's branch.
  const cwd = new URL('..', import.meta.url).pathname;
  for (const base of ['origin/claude/fixes-cycle5', 'claude/fixes-cycle5']) {
    try {
      execFileSync('git', ['rev-parse', '--verify', '--quiet', base], { cwd, stdio: 'ignore' });
    } catch { continue; }
    const diff = execFileSync('git', ['diff', `${base}...HEAD`, '--', 'lib/feed.ts', 'lib/discovery'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    assert.equal(diff, '', `part 2 changes ranking code against ${base}`);
    break;
  }
});

test('a record with a real range prints exactly as before (range, verdict and labels)', () => {
  const c = cardEvidence(WIDE, NOW);
  assert.equal(c.zeroWidth, undefined);
  assert.match(evidenceLine(c), /^Past results: above zero · Evidence: thin \(10 bets, \d+ days\)$/);
  assert.match(rangeText(confidence(WIDE, NOW))!, /^\(\+\d\.\d% to \+\d\.\d%\)$/);
  const m = card(WIDE, 'unfurl');
  assert.equal(m.evidence, 'Evidence: thin');
  assert.match(m.range!, /^likely between \+\d\.\d% and \+\d\.\d%$/);
  assert.match(paneEvidence(WIDE, NOW).rangeLine!, /^\(\+\d\.\d% to \+\d\.\d%\) · 95% range$/);
});

// Round 2 item 3: every range printer goes through the one rule. A source scan: each pct(low)/pct(high) pair in lib/ and
// app/ sits in a file that guards it with lib/zero-width.ts (or reads cardEvidence, which applies it).
test('round 2 item 3: every range-printing pct(low)/pct(high) pair is guarded by the zero-width rule', () => {
  const root = new URL('..', import.meta.url).pathname;
  const walk = (d: string): string[] => readdirSync(`${root}${d}`, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]));
  const files = [...walk('lib'), ...walk('app')].filter((f) => /\.tsx?$/.test(f) && !/\.test\.ts$/.test(f));
  const pair = /pct\([\w.!?]*\.low\b[^)]*\)[^;\n]{0,40}pct\([\w.!?]*\.high\b/;
  const hits: string[] = [];
  for (const f of files) {
    const s = readFileSync(`${root}${f}`, 'utf8');
    if (!pair.test(s)) continue;
    hits.push(f);
    assert.match(s, /zero-width\.ts|cardEvidence\(|\bzeroWidth\(/, `${f} prints a range without the zero-width rule`);
  }
  assert.ok(hits.includes('lib/zero-width.ts') && hits.includes('lib/record-card.ts'), hits.join(', '));
});
