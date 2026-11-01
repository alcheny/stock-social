// OPTIONS AC 24 (docs/features/logs/options/plan.md D5): the record card carries the "share trade" headline label and
// the loader's line (the gated count line, or the options line once open) in the model, the picture and the alt text;
// with no options the card is unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardAlt, recordCard, type CardKind } from './record-card.ts';
import { OPTIONS } from './copy.ts';

const DAY = 86_400_000;
const now = new Date('2026-11-01T12:00:00Z');
const trades = Array.from({ length: 8 }, (_, i) => ({ symbol: `S${i}`, openedAt: new Date(now.getTime() - (40 - i) * DAY), closedAt: new Date(now.getTime() - (30 - i) * DAY), returnPct: i % 2 ? 0.05 : -0.02, holdingDays: 10 }));
const base = { handle: 'opt_card', name: 'Opt Card', trades, state: 'connected' as const, demo: false, verified: true, now, link: null };
const gated = OPTIONS.gated(4, 1);

test('AC24: the card reads "per share trade" and carries the count line when the trader has option closes; unchanged without', () => {
  for (const kind of ['unfurl', 'square', 'story'] as CardKind[]) {
    const plain = recordCard({ ...base, kind });
    assert.equal('optionsLine' in plain, false);
    assert.equal(plain.headlineLabel, 'average per trade');
    const m = recordCard({ ...base, kind, options: { shareLabel: true, line: gated } });
    assert.equal(m.headlineLabel, 'average per share trade');
    assert.equal(m.optionsLine, gated);
    assert.ok(cardAlt(m).includes(gated));
    assert.match(cardAlt(m), /The average per share trade is/);
    assert.doesNotMatch(cardAlt(m), /Call option|Put option|exp |123\.45/);
    // The unfurl gives the chart's row to the line; the square and story keep theirs.
    if (kind === 'unfurl') assert.ok(m.chart!.h < plain.chart!.h);
    else assert.equal(m.chart!.h, plain.chart!.h);
    // With open positions the label is the closed form.
    assert.equal(recordCard({ ...base, kind, open: [0.1], options: { shareLabel: true, line: gated } }).headlineLabel, 'average per closed share trade');
  }
  // Open options only (no closes): no label, the line still shows.
  const o = recordCard({ ...base, kind: 'square', options: { shareLabel: false, line: OPTIONS.gated(0, 1) } });
  assert.equal(o.headlineLabel, 'average per trade');
  assert.equal(o.optionsLine, OPTIONS.gated(0, 1));
  // Importing: no line (nothing partial is presented).
  assert.equal(recordCard({ ...base, kind: 'square', state: 'importing', options: { shareLabel: true, line: gated } }).optionsLine, null);
});
