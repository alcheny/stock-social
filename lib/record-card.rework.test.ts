// F-4 rework: one test per decision dated 2026-10-31 and 2026-11-01 in docs/features/F-4-share-card.md, plus F-6's
// share-card part (docs/features/F-6-open-positions.md) and the orchestrator's review findings. Plan and committee
// record: docs/features/logs/F-4/committee-2026-11-01.md.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CARD_LAYOUT, cardAlt, cardDescription, cardEvidence, cardLink, cardOpen, cardSeries, recordCard, type CardInput, type CardKind, type CardModel,
} from './record-card.ts';
import { confidence, evidenceLine, evidenceWeight, headline, pct, type ConfidenceInput } from './trades.ts';
import { spanUnit, TRUST_BANNED, trustSign } from './confidence.ts';
import { DISCLAIMER } from './share.ts';
import type { RecordState } from './copy.ts';

const DAY = 86_400_000;
const t0 = Date.UTC(2025, 0, 1);
const now = new Date(Date.UTC(2026, 10, 1, 12));
const tr = (symbol: string, open: number, close: number, r: number): ConfidenceInput => ({
  symbol, openedAt: new Date(t0 + open * DAY), closedAt: new Date(t0 + close * DAY), returnPct: r, holdingDays: close - open,
});
const KINDS: CardKind[] = ['unfurl', 'square', 'story'];
const base = { handle: 'rework_test', name: 'Rework Trader', state: 'connected' as RecordState, demo: false, verified: true, now, link: null };
const card = (trades: ConfidenceInput[], o: Partial<CardInput> = {}) => recordCard({ ...base, kind: 'unfurl', trades, verified: trades.length > 0, ...o });
// Records per evidence tier and sign (one-trade bets, spaced so holds never overlap).
const record = (k: number, spanDays: number, f: (i: number) => number) =>
  Array.from({ length: k }, (_, i) => tr(`Q${i}`, (i / Math.max(k - 1, 1)) * (spanDays - 1), (i / Math.max(k - 1, 1)) * (spanDays - 1) + 1, f(i)));
const wobble = (m: number) => (i: number) => m + (i % 2 ? 0.004 : -0.004);
const R = {
  winning: record(12, 115, wobble(0.03)),
  under5: record(4, 30, wobble(0.02)),
  wide: record(12, 120, (i) => (i % 2 ? -0.22 : 0.28)),
  modUp: record(45, 200, wobble(0.01)),
  modDown: record(45, 200, wobble(-0.01)),
  modFlat: record(45, 200, (i) => (i % 2 ? 0.03 : -0.03)),
  strongUp: record(140, 800, wobble(0.01)),
  strongDown: record(140, 800, wobble(-0.01)),
  strongFlat: record(140, 800, (i) => (i % 2 ? 0.03 : -0.03)),
  volatile: Array.from({ length: 120 }, (_, i) => tr(`V${i}`, i * 4, i * 4 + 2, Math.expm1(i % 2 ? -0.5 : 0.5))),
};
const OPEN = { mixed: [0.121, 0.034, -0.08], losing: [-0.08, -0.215, -0.031], winning: [0.02, 0.15, 0.4] };

test('F-4 2026-10-31 (range): "likely between" is the 95% range around the headline\'s own average; the headline is inside', () => {
  for (const [name, r] of Object.entries(R)) {
    const m = card(r);
    if (!m.range) { assert.equal(name, 'under5'); continue; }
    const [lo, hi] = m.range.match(/-?\+?\d+\.\d%/g)!.map((s) => Number(s.replace('%', '')));
    const h = Number(m.headline!.replace('%', ''));
    assert.ok(lo <= h && h <= hi, `${name}: ${m.headline} ${m.range}`);
  }
  // The orchestrator's case: before, "+12.8% average per trade, likely between -8.7% and +9.5%".
  const v = card(R.volatile);
  assert.equal(v.headline, '+12.8%');
  assert.notEqual(v.range, 'likely between -8.7% and +9.5%');
});

test('F-4 2026-10-31 (trust table): every row from real records; gains and losses in the same words; never a count alone', () => {
  const T = (r: ConfidenceInput[]) => card(r).trust;
  assert.equal(T(R.under5), 'Based on 4 trades. Too few trades to say much yet.');
  assert.equal(T(R.wide), 'Based on 12 trades. The range is still too wide to say much.');
  assert.equal(T(R.winning), 'Based on 12 separate bets over 115 days. Still early, and results could go either way.');
  assert.equal(T(R.modUp), 'Based on 45 bets over 6 months. A fair sample, with a clear pattern of gains.');
  assert.equal(T(R.modDown), 'Based on 45 bets over 6 months. A fair sample, with a clear pattern of losses.');
  assert.equal(T(R.modFlat), 'Based on 45 bets over 6 months. A fair sample, with no clear pattern yet.');
  assert.equal(T(R.strongUp), 'Based on 140 bets over 2 years. A long record, with consistent gains.');
  assert.equal(T(R.strongDown), 'Based on 140 bets over 2 years. A long record, with consistent losses.');
  assert.equal(T(R.strongFlat), 'Based on 140 bets over 2 years. A long record, with no clear pattern.');
  // Q-S (committee 2026-11-01): the sign is the printed range's. The volatile record's range is wholly above 0, so its
  // line says so (it no longer says "no clear pattern" beside a range wholly above 0); its mirror says losses.
  const v = card(R.volatile), vm = card(R.volatile.map((t) => ({ ...t, returnPct: -t.returnPct })));
  assert.match(v.range!, /^likely between \+/);
  assert.equal(v.trust, 'Based on 120 bets over 1 year. A long record, with consistent gains.');
  assert.equal(vm.trust, 'Based on 120 bets over 1 year. A long record, with consistent losses.');
  // "Too wide" comes from the printed range's half-width, never from the count: 12 bets are not too early when tight.
  assert.equal(cardEvidence(R.winning, now).tier, 'thin');
  assert.equal(cardEvidence(R.wide, now).tier, 'too-early');
  const banned = new RegExp(`\\b(${TRUST_BANNED.map((t) => t.replace(/[- ]/g, '[- ]?')).join('|')})s?\\b`, 'i');
  for (const r of Object.values(R)) assert.doesNotMatch(card(r).trust!, banned);
});

test('F-4 2026-10-31 (link preview): every element kept, chart about 24%; square and story keep 30% in every state', () => {
  const area = (m: CardModel) => (m.chart!.w * m.chart!.h) / (CARD_LAYOUT[m.kind].width * CARD_LAYOUT[m.kind].height);
  const states: [string, Partial<CardInput>][] = [['base', {}], ['open', { open: OPEN.mixed }], ['failed', { state: 'failed' }], ['failed+open', { state: 'failed', open: OPEN.mixed }]];
  for (const [name, o] of states) {
    const u = card(R.modUp, o);
    // Every element is present on the preview, whatever the state.
    for (const k of ['name', 'label', 'headline', 'headlineLabel', 'range', 'countValue', 'countNote', 'periodLength', 'periodSince', 'caption', 'evidence', 'trust', 'disclaimer'] as const)
      assert.ok(u[k], `${name}: ${k}`);
    const a = area(u);
    if (name === 'failed+open') assert.ok(a >= 0.21, `${name} ${a.toFixed(3)}`); // the one state with two extra rows
    else assert.ok(a >= 0.24, `${name} ${a.toFixed(3)}`);
    for (const kind of ['square', 'story'] as const) assert.ok(area(card(R.modUp, { ...o, kind })) >= 0.30, `${kind} ${name}`);
  }
});

test('F-4 2026-11-01 (chart): the running sum of per-trade returns in order, ending at count × average; the F-5 seam', () => {
  for (const r of Object.values(R)) {
    const pts = cardSeries(r, 10_000);
    assert.equal(pts[0].value, 0);
    assert.ok(Math.abs(pts.at(-1)!.value - r.length * headline(r).avgReturn) < 1e-9);
    for (let i = 1; i < pts.length; i++) assert.ok(pts[i].at >= pts[i - 1].at, 'in close order');
  }
  // Ties in close time are broken deterministically (entry, then symbol), whatever order the rows arrive in.
  const tie = [tr('B', 0, 5, 0.1), tr('A', 0, 5, -0.2), tr('C', 1, 5, 0.05)];
  assert.deepEqual(cardSeries(tie).map((p) => p.value), cardSeries([...tie].reverse()).map((p) => p.value));
  assert.equal(card(R.winning).caption, 'Sum of trade returns, in order · position size not shown');
  assert.throws(() => cardSeries(R.winning, 240, 'account'), /F-5/);
  // The line takes the headline's tone: it can never be green beside a red average.
  assert.equal(card(R.modDown).headlineTone, 'down');
  assert.equal(card(R.modDown).chart!.down, true);
});

test('F-4 2026-11-01 (preview text): matches the card (average with range, period, evidence), never a win rate', () => {
  for (const r of [R.winning, R.modDown, R.under5, R.wide]) {
    const m = card(r);
    const d = cardDescription(m)!;
    assert.doesNotMatch(d, /win rate/i);
    for (const part of [m.headline!, m.headlineLabel!, m.periodSince!, m.periodLength!, m.evidence!]) assert.ok(d.includes(part), `${d} lacks ${part}`);
    if (m.range) assert.ok(d.includes(m.range));
  }
  assert.equal(cardDescription(card(R.modUp)), `${pct(headline(R.modUp).avgReturn)} average per trade, ${card(R.modUp).range} · Record since Jan 2025 · 6 months · Evidence: moderate`);
  assert.equal(cardDescription(card([])), null);
  assert.equal(cardDescription(card([], { open: OPEN.mixed })), 'Still open: 3 positions · 2 up, 1 down · lowest -8.0%, highest +12.1%');
  // The page's description is built from this (e2e/share-card.spec.ts checks the served text and its disclaimer).
});

test('F-4 2026-11-01 (ranking floor): records show a range from 5 bets but rank from 10', () => {
  for (const k of [5, 7, 9]) {
    const r = record(k, 60, wobble(0.03));
    assert.ok(card(r).range, `${k} bets: a range`);
    assert.equal(evidenceWeight(confidence(r, now)), 0, `${k} bets: no ranking weight`);
  }
  assert.ok(evidenceWeight(confidence(record(10, 60, wobble(0.03)), now)) > 0);
});

test('F-4 2026-11-01 (font): the cards keep the renderer\'s built-in font; no font file is loaded', () => {
  for (const f of ['../app/u/[handle]/opengraph-image.tsx', '../app/u/[handle]/story/route.tsx', '../app/u/[handle]/record-card-image.tsx']) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /fonts\s*:|\.(ttf|otf|woff2?)\b|readFile/, f);
  }
});

test('F-4 2026-11-01 (record length): first trade to last close, the profile\'s number; an idle record does not grow', () => {
  for (const r of Object.values(R)) {
    const c = confidence(r, now);
    const m = card(r);
    const later = card(r, { now: new Date(now.getTime() + 30 * DAY) });
    assert.equal(later.period, m.period, 'a month later, the same length');
    if (c.tier === 'thin') {
      // The profile's evidence line prints Math.round(spanDays) days; the card prints the same number.
      const days = Number(evidenceLine(c).match(/, (\d+) days?\)/)![1]);
      assert.equal(m.periodLength, `${days} days`);
      assert.match(m.trust!, new RegExp(` over ${days} days\\.`));
    }
  }
  // The demo record (scripts/seed.ts: 30 trades, an entry every 2 days from about 60 days ago, the last close an hour
  // ago): the card and the profile both read 60 days, where the built card counted 64 to today.
  let seed = 42;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
  const at = Date.UTC(2026, 10, 1, 12);
  const maya = Array.from({ length: 30 }, (_, i) => {
    const open = at - (60 - i * 2) * DAY - rand() * DAY;
    const close = Math.min(at - 3_600_000, open + (0.2 + rand() * 9) * DAY);
    rand(); const r = 0.012 + (rand() - 0.5) * 2 * 0.06; rand();
    return { symbol: ['NVDA', 'AMD', 'AVGO', 'TSM', 'MU'][i % 5], openedAt: new Date(open), closedAt: new Date(close), returnPct: r, holdingDays: (close - open) / DAY };
  });
  const m = card(maya, { now: new Date(at + 4 * DAY), demo: true, state: 'none', verified: false });
  assert.equal(m.periodLength, '60 days');
  assert.match(evidenceLine(confidence(maya, new Date(at))), /, 60 days\)$/);
});

test('F-4 2026-11-01 (unit): the period and the trust line use one unit per tier', () => {
  const unitOf = (s: string) => (/day/.test(s) ? 'days' : /year/.test(s) ? 'years' : 'months');
  for (const r of Object.values(R)) {
    const m = card(r);
    const tier = cardEvidence(r, now).tier;
    assert.equal(unitOf(m.periodLength!), spanUnit(tier), `${m.periodLength} for ${tier}`);
    const inTrust = m.trust!.match(/ over (.+?)\. /)?.[1];
    if (inTrust) assert.equal(inTrust, m.periodLength);
  }
});

test('F-6 on the card: realized and unrealized apart, in words, percent only, at every size', () => {
  for (const kind of KINDS) {
    const m = card(R.winning, { kind, open: OPEN.mixed });
    assert.equal(m.headlineLabel, 'average per closed trade');
    assert.equal(m.open!.full, 'Still open: 3 positions · 2 up, 1 down · lowest -8.0%, highest +12.1%');
    assert.equal(m.open!.short, '3 open, unrealized · 2 up, 1 down · lowest -8.0%, highest +12.1%'); // the preview says "unrealized" too
    assert.equal(m.open!.note, 'unrealized, not sold yet');
    const alt = cardAlt(m);
    for (const s of [m.open!.split, m.open!.spread, 'Still open, unrealized as of the last sync: 3 positions']) assert.ok(alt.includes(s), `${kind}: ${s}`);
    assert.doesNotMatch(m.open!.full + m.open!.short, /likely/); // never read as the average's range
  }
  // No open positions: exactly today's card.
  const { open: _o, ...plain } = card(R.winning);
  const { open: _p, ...none } = card(R.winning, { open: [] });
  assert.deepEqual(none, plain);
  assert.equal(card(R.winning, { open: [] }).open, null);
  assert.equal(card(R.winning).headlineLabel, 'average per trade');
});

test('F-6 on the card: all winning, all losing, mixed, flat, one position; losses as prominent as gains', () => {
  assert.equal(cardOpen(OPEN.winning)!.full, 'Still open: 3 positions · 3 up, 0 down · lowest +2.0%, highest +40.0%');
  const l = cardOpen(OPEN.losing)!;
  assert.equal(l.full, 'Still open: 3 positions · 0 up, 3 down · lowest -21.5%, highest -3.1%');
  assert.deepEqual([l.lowTone, l.highTone], ['down', 'down']);
  // One position: no up/down count, just its percent (UX test 2026-11-01).
  assert.equal(cardOpen([0.0004])!.full, 'Still open: 1 position · at 0.0%');
  assert.equal(cardOpen([0.0004])!.short, '1 open, unrealized · at 0.0%');
  assert.equal(cardOpen([-0.08])!.spread, 'at -8.0%');
  assert.equal(cardOpen([0.0004, -0.0003])!.full, 'Still open: 2 positions · 0 up, 0 down, 2 flat · at 0.0%');
  assert.equal(cardOpen([0.05, 0.0501])!.spread, 'at +5.0%'); // printed alike: one figure
  assert.equal(cardOpen([]), null);
  assert.equal(cardOpen([Number.NaN]), null);
  // The same fields and sizes whether the open positions gain or lose (the image draws both from the same row).
  assert.deepEqual(Object.keys(cardOpen(OPEN.losing)!), Object.keys(cardOpen(OPEN.winning)!));
});

test('F-6 on the card: an empty record with open positions still shows them; never while importing or with no broker', () => {
  for (const kind of KINDS) {
    const m = card([], { kind, open: OPEN.mixed });
    assert.equal(m.body, 'No closed trades yet');
    assert.equal(m.open!.count, 3);
    assert.equal(m.headline, null);
    assert.equal(m.chart, null);
    assert.equal(m.disclaimer, DISCLAIMER);
    assert.ok(m.label);
    assert.match(cardAlt(m), /Still open, unrealized as of the last sync: 3 positions, 2 up, 1 down/);
  }
  assert.equal(card(R.winning, { state: 'importing', open: OPEN.mixed }).open, null);
  assert.equal(card(R.winning, { state: 'none', open: OPEN.mixed }).open, null);
  assert.ok(card(R.winning, { state: 'failed', open: OPEN.mixed }).open);
});

test('F-6 on the card: no symbols, accounts, amounts or quantities anywhere the card speaks', () => {
  const m = card(R.winning, { open: OPEN.mixed });
  const text = [cardAlt(m), cardDescription(m), JSON.stringify(m)].join(' ');
  for (const s of new Set(R.winning.map((t) => t.symbol))) assert.ok(!new RegExp(`\\b${s}\\b`).test(text), s);
  assert.doesNotMatch(text, /\$|\bunits?\b|\bshares?\b|\bprice|\bamount|\baccount\b/i);
});

test('orchestrator review: the printed link survives an origin with no scheme', () => {
  assert.equal(cardLink({ NEXT_PUBLIC_SITE_URL: 'example.com' }, 'h'), 'example.com/u/h');
  assert.equal(cardLink({ NEXT_PUBLIC_SITE_URL: 'example.com/' }, 'h'), 'example.com/u/h');
  assert.equal(cardLink({ NEXT_PUBLIC_SITE_URL: ' https://example.com ' }, 'h'), 'example.com/u/h');
  assert.equal(cardLink({ NEXT_PUBLIC_SITE_URL: 'http://localhost:3000' }, 'h'), 'localhost:3000/u/h');
  assert.equal(cardLink({ NEXT_PUBLIC_SITE_URL: 'exa mple' }, 'h'), null);
  assert.doesNotThrow(() => recordCard({ ...base, kind: 'square', trades: R.winning, link: cardLink({ NEXT_PUBLIC_SITE_URL: 'exa mple' }, 'h') }));
});

test('QA 2026-11-01: the range never goes below -100%; the chart starts at the first entry, not on a vertical stroke', () => {
  const crash = [tr('A', 0, 1, 5), tr('B', 2, 3, -0.99), tr('C', 4, 5, -0.99), tr('D', 6, 7, -0.99), tr('E', 8, 9, -0.99), tr('F', 10, 11, 3)];
  const m = card(crash);
  assert.equal(m.headline, '+67.3%');
  assert.match(m.range!, /^likely between -100\.0% and \+/);
  const pts = cardSeries(R.winning);
  assert.equal(pts[0].at, Math.min(...R.winning.map((t) => t.openedAt.getTime())));
  assert.ok(pts[1].at > pts[0].at);
});

test('user test 2026-11-01: the profile shows the card\'s evidence (range, tier, verdict), so a shared link lands on one answer', () => {
  for (const r of [...Object.values(R), record(62, 200, (i) => (i % 3 ? 0.25 : -0.3))]) {
    const e = cardEvidence(r, now);
    const m = card(r);
    // The profile prints `(${low} to ${high})` from e.perTrade and evidenceLine(e): the card's numbers and tier.
    if (m.range) assert.equal(m.range, `likely between ${pct(e.perTrade!.low)} and ${pct(e.perTrade!.high)}`);
    assert.equal(m.evidence, `Evidence: ${e.tier === 'too-early' ? 'too early' : e.tier}`);
    const line = evidenceLine(e);
    if (e.tier === 'too-early') assert.match(line, /^Too early to tell/);
    else assert.match(line, new RegExp(`Evidence: ${e.tier} \\(`));
    // The verdict follows the printed range: never "above zero" beside a range that reaches 0.
    if (e.edge === 'positive') assert.ok(Number(pct(e.perTrade!.low).replace('%', '')) > 0);
    if (e.edge === 'negative') assert.ok(Number(pct(e.perTrade!.high).replace('%', '')) < 0);
  }
  // A low end that prints +0.0% is not "wholly above 0".
  assert.equal(trustSign({ perTrade: { low: 0.0004, mid: 0.01, high: 0.02 } }), 'unclear');
  assert.equal(trustSign({ perTrade: { low: -0.02, mid: -0.01, high: -0.0004 } }), 'unclear');
  assert.equal(trustSign({ perTrade: { low: 0.0006, mid: 0.01, high: 0.02 } }), 'positive');
});

// The seeded demo record, when a database with the seed is present: card and profile read the same length.
const hasDb = !!process.env.DATABASE_URL;
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });
test('F-4 2026-11-01 (record length): the seeded demo record reads the same days on the card and the profile', { skip: !hasDb && 'no DATABASE_URL' }, async (t) => {
  const { sql } = await import('./db.ts');
  const rows = await sql`select symbol, return_pct, holding_days, opened_at, closed_at from closed_trades
    where user_id = (select id from users where handle = 'momentum_maya')`;
  if (!rows.length) { t.skip('demo seed not loaded'); return; }
  const trades = rows.map((r) => ({ symbol: r.symbol as string, openedAt: r.opened_at as Date, closedAt: r.closed_at as Date, returnPct: Number(r.return_pct), holdingDays: Number(r.holding_days) }));
  const days = Number(evidenceLine(confidence(trades, new Date())).match(/, (\d+) days?\)/)![1]);
  assert.equal(card(trades, { now: new Date(), demo: true, state: 'none', verified: false }).periodLength, `${days} days`);
});

test('code review 2026-11-01: "too wide" reads the unclamped range, so the -100% stop never makes a wide record look narrow', () => {
  // About -95% a trade with a half-width of ~12 points: clamped at -100% it would print ~8.5 points wide.
  const r = record(31, 200, (i) => (i % 2 ? -0.83 : -0.99) + (i % 3 ? 0.04 : -0.04));
  const e = cardEvidence(r, now);
  assert.ok(e.perTrade!.low >= -1);
  const unclampedHalf = e.perTrade!.high - headline(r).avgReturn; // the high end is never clamped
  assert.equal(e.tier === 'too-early', unclampedHalf > 0.10, `half ${unclampedHalf.toFixed(3)} tier ${e.tier}`);
});
