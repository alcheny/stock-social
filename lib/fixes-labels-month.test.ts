// Fixes-labels plan AC15 (D-24): a month shows numbers and a range only, never a verdict; "One of N months on record".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthRecap, monthsOnRecord, type RecapTrade } from './recap.ts';
import { MIN_BETS } from './confidence.ts';
import { recordStrip } from './record-strip.ts';

const NOW = new Date(Date.UTC(2026, 10, 1));
const DAY = 86_400_000;
const mk = (id: string, closed: string, r = 0.02, hold = 2): RecapTrade => {
  const c = new Date(closed);
  return { sellId: id, symbol: `S${id}`, openedAt: new Date(c.getTime() - hold * DAY), closedAt: c, returnPct: r, holdingDays: hold };
};
const sept = (n: number) => Array.from({ length: n }, (_, i) => mk(`t${i}`, new Date(Date.UTC(2026, 8, 1 + i * 2)).toISOString(), i % 3 ? 0.03 : -0.02));

// Code review: the month page's one month line is F-12's figures strip (monthStripInput), so AC15 is held there.
test('AC15: monthRecap carries the bets behind the month; the month line (F-12 figures) is a range or Too early, never a verdict', () => {
  const line = (m: NonNullable<ReturnType<typeof monthRecap>>) => recordStrip({ ...m.figures, state: 'connected', demo: false, verified: true, handle: 'x' }, 'figures').text;
  const few = monthRecap(sept(3), '2026-09', NOW)!;
  assert.equal(few.figures.evidence.k, 3);
  assert.ok(few.figures.evidence.k < MIN_BETS);
  assert.match(line(few), /Too early/);
  const many = monthRecap(sept(8), '2026-09', NOW)!;
  assert.equal(many.figures.evidence.k, 8);
  assert.match(line(many), /\([+−-]?\d+\.\d% to [+−-]?\d+\.\d%\)/);
  for (const m of [few, many]) assert.doesNotMatch(line(m), /Past results|above zero|below zero|unclear|Evidence/);
});

test('AC15: monthsOnRecord counts distinct UTC months; edges at UTC midnight', () => {
  assert.equal(monthsOnRecord([]), 0);
  assert.equal(monthsOnRecord(sept(5)), 1);
  assert.equal(monthsOnRecord([mk('a', '2026-08-31T23:59:59Z'), mk('b', '2026-09-01T00:00:00Z'), mk('c', '2026-09-30T12:00:00Z'), mk('d', '2025-09-10T00:00:00Z')]), 3);
});

// Merged with F-12 (main #54): the month image draws lib/record-strip.ts's band (monthBand); monthCard is the adapter F-12
// kept for its tests. The adapter carries the band's three disclaimer rows (lib/record-strip.ts DISCLAIMER_LINES) and the
// frozen line moved to the band, so the frozen budget and the ≥ 28 px rows are checked on the band below.
test('AC15/AC16: the month card: record line the size of the month line, "One of N months", the F3 rows at ≥ 28 px, and room for every optional line', async () => {
  const { monthCard, monthCardFits, MONTH_CARD } = await import('./month-card.ts');
  const { DISCLAIMER } = await import('./share.ts');
  const base = (o: { state: 'importing' | 'connected' | 'failed' | 'none'; demo: boolean; monthSoFar: boolean; months?: number }) => ({
    handle: 'a-long-handle-name-xx', displayName: 'A rather long display name', demo: o.demo, verified: !o.demo, state: o.state, months: o.months,
    recap: { label: 'September 2026', monthSoFar: o.monthSoFar, count: 12, showHeadline: true, winRate: 0.58, avgReturn: -0.123, best: { symbol: 'ABCDE', returnPct: 1.234 }, worst: { symbol: 'VWXYZ', returnPct: -0.876 } },
    record: { trades: 120, winRate: 0.55, avgReturn: 0.012, evidence: 'Too early to tell (8 of 10 bets)', range: '-3.0% to +5.0%', newRecord: true },
  });
  for (const state of ['importing', 'connected', 'failed', 'none'] as const) for (const demo of [true, false]) for (const monthSoFar of [true, false]) {
    const c = monthCard(base({ state, demo, monthSoFar, months: 14 }));
    const fit = monthCardFits(c);
    assert.ok(fit.height <= fit.room, `${state} ${demo} ${monthSoFar}: ${fit.height} > ${fit.room}`);
    assert.ok(MONTH_CARD.height === 630);
    assert.deepEqual(fit.tooWide, []);
    assert.equal(c.disclaimer.text, DISCLAIMER);
    assert.ok((c.disclaimer.lines?.length ?? 0) >= 2);
    for (const row of c.disclaimer.lines!) assert.ok(row.length * c.disclaimer.size * MONTH_CARD.glyph <= MONTH_CARD.width - 2 * MONTH_CARD.padding, row);
    assert.equal(c.disclaimer.lines!.join(' '), DISCLAIMER);
    assert.ok(c.disclaimer.size >= 28);
    const month = c.top.find((l) => l.role === 'month')!, record = c.bottom.find((l) => l.role === 'record');
    if (record) assert.equal(record.size, month.size);
    assert.equal(c.top.find((l) => l.role === 'of')?.text, 'One of 14 months on record');
    assert.ok(c.top.find((l) => l.role === 'label')!.size <= 64);
    for (const l of [...c.top, ...c.bottom]) assert.doesNotMatch(l.text, /\bago\b/);
  }
  assert.equal(monthCard(base({ state: 'connected', demo: false, monthSoFar: false, months: 1 })).top.find((l) => l.role === 'of')?.text, 'The only month on record');
  assert.equal(monthCard(base({ state: 'connected', demo: false, monthSoFar: false })).top.some((l) => l.role === 'of'), false);
});

test('AC16 (with F-12): the month and trade images, as drawn (the band), keep the F3 rows at ≥ 28 px with "One of N months" and a frozen line; a failed import\'s month at the F-12 floor at least', async () => {
  const { monthBand } = await import('./month-card.ts');
  const { recordStripInput, monthStripInput, wholeRecord } = await import('./recap.ts');
  const { recordStrip, STRIP_BAND, lineWidth, DISCLAIMER_LINES } = await import('./record-strip.ts');
  const { tradeBand, tradeSharePayload, tradeStripInput } = await import('./trade-share.ts');
  const { DISCLAIMER } = await import('./share.ts');
  const frozen = 'Disconnected Oct 3, 2026 · record frozen';
  const past = (k: number, f: (i: number) => number) => Array.from({ length: k }, (_, i) => mk(`p${i}`, new Date(Date.UTC(2025, 0, 1 + i * 3)).toISOString(), f(i)));
  const all = [...past(40, (i) => (i % 2 ? 0.013 : 0.005)), ...sept(8)];
  for (const state of ['importing', 'connected', 'failed', 'none'] as const) for (const demo of [false, true]) {
    const r = { handle: 'abcdefghijklmnopqrst', displayName: 'A', demo, verified: !demo, state, recap: monthRecap(all, '2026-09', NOW)!, record: wholeRecord(all, NOW), open: [0.1, 0.2], months: 14 };
    const band = monthBand(r, recordStrip(recordStripInput(r), 'image'), recordStrip(monthStripInput(r), 'figures'), demo ? null : frozen);
    assert.ok(band.fits, `${state} ${demo}: fits`);
    const rows = band.lines.filter((l) => l.role.startsWith('disclaimer'));
    assert.deepEqual(rows.map((l) => l.text), [...DISCLAIMER_LINES]);
    assert.equal(rows.map((l) => l.text).join(' '), DISCLAIMER);
    for (const l of rows) assert.ok(l.size >= (state === 'failed' && !demo ? STRIP_BAND.minPx : 28) && lineWidth(l) <= STRIP_BAND.width, `${state} ${demo} ${l.size}`);
    // Beside a failed import's two note lines the band has no room for it (the page keeps the status line).
    // The frozen line, whole (split over two lines at its " · " when it is wider than the band at the floor size).
    const frozenText = (ls: typeof band.lines) => ls.filter((l) => l.role.startsWith('frozen')).map((l) => l.text).join(' · ');
    if (!demo && state !== 'failed') assert.equal(frozenText(band.lines), frozen, `${state}: frozen`);
    for (const l of band.lines.filter((x) => x.role.startsWith('frozen'))) assert.ok(lineWidth(l) <= STRIP_BAND.width, `${state}: frozen fits the width`);
    // "One of N months" is optional: it gives way to a frozen line and to a disclaimer under 28 px.
    if (state === 'connected' || state === 'none') {
      const plain = monthBand(r, recordStrip(recordStripInput(r), 'image'), recordStrip(monthStripInput(r), 'figures'), null);
      assert.ok(plain.lines.some((l) => l.role === 'monthOf' && l.text === 'One of 14 months on record'), `${state} ${demo}: of`);
      for (const l of plain.lines.filter((x) => x.role.startsWith('disclaimer'))) assert.ok(l.size >= 28, `${state} ${demo} plain ${l.size}`);
    }
    for (const l of band.lines) assert.doesNotMatch(l.text, /\bago\b/);
    const pick = all[all.length - 1];
    const p = tradeSharePayload({ symbol: 'ABCDEFGHIJ', returnPct: -0.987, holdingDays: 0.2, closedAt: pick.closedAt, thesis: 'A thesis that runs well past the width of one line of the band, so it is clipped', thesisStatus: 'published', demo, allTrades: all }, NOW);
    const t = { ...p, handle: 'abcdefghijklmnopqrst', displayName: 'A', state, verified: !demo, open: [0.1] };
    const tb = tradeBand(t, recordStrip(tradeStripInput(t), "image"), demo ? null : frozen);
    assert.ok(tb.fits, `trade ${state} ${demo}: fits`);
    for (const l of tb.lines.filter((x) => x.role.startsWith('disclaimer'))) assert.ok(l.size >= 28, `trade ${state} ${demo} ${l.size}`);
    if (!demo && state !== 'failed') assert.equal(frozenText(tb.lines), frozen, `trade ${state}: frozen`);
    assert.deepEqual(tb.tooWide, [], `trade ${state} ${demo}: nothing too wide`);
    assert.match(tb.lines.filter((l) => l.role.startsWith('held')).map((l) => l.text).join(' '), /closed [A-Z][a-z]{2} \d{1,2}, \d{4}$/);
  }
});
