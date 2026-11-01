// Fixes-labels plan AC16 (D-09 on images): the trade and stock share images, as drawn, fit the 630 px card with every
// optional line, and the F3 line wraps to two rows of at least 35 px (DS-19), each within the 1072 px inner width.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wrapLines, DISCLAIMER_LINES, DISCLAIMER_SIZE, IMAGE, INNER_H, INNER_W, lineHeights, STOCK_IMAGE, stockImageLines, textWidth, TRADE_IMAGE, tradeImageLines } from './image-fit.ts';
import { DISCLAIMER } from './share.ts';

test('the F3 line wraps into two rows of the whole text, each ≥ 28 px and within the inner width', () => {
  assert.equal(DISCLAIMER_LINES.length, 2);
  assert.equal(DISCLAIMER_LINES.join(' '), DISCLAIMER);
  assert.ok(DISCLAIMER_SIZE >= 35); // DS-19
  for (const l of DISCLAIMER_LINES) assert.ok(textWidth(l, DISCLAIMER_SIZE) <= INNER_W, `${l}: ${textWidth(l, DISCLAIMER_SIZE)}`);
  // The whole line on one row would not fit: the box wraps (never clips).
  assert.ok(textWidth(DISCLAIMER, DISCLAIMER_SIZE) > INNER_W);
  assert.equal(IMAGE.width - 2 * IMAGE.padding, INNER_W);
  assert.equal(IMAGE.height - 2 * IMAGE.padding, INNER_H);
});

test('trade image: the worst case (record, note, new-record and a frozen line, thesis given way) fits the inner height', () => {
  assert.equal(TRADE_IMAGE.ret, 136);
  const worst = tradeImageLines({ stats: true, note: true, newRecord: true, frozen: true });
  const h = lineHeights(worst);
  assert.ok(h <= INNER_H, `${h} > ${INNER_H}`);
  assert.equal(worst.filter((l) => l.role === 'disclaimer').length, 2);
  for (const l of worst.filter((x) => x.role === 'disclaimer')) assert.ok(l.size >= 35);
  // Fewer lines never take more room.
  assert.ok(lineHeights(tradeImageLines({ stats: false, note: false, newRecord: false, frozen: false })) < h);
});

test('stock image: symbol at 96 px, and the whole card with the two-line F3 line fits', () => {
  assert.equal(STOCK_IMAGE.symbol, 96);
  const h = lineHeights(stockImageLines());
  assert.ok(h <= INNER_H, `${h} > ${INNER_H}`);
  assert.equal(stockImageLines().filter((l) => l.role === 'disclaimer').length, 2);
});

test('lineHeights sums size × line height (1.2 unless set), plus fixed gaps', () => {
  assert.equal(lineHeights([{ role: 'x', size: 10 }, { role: 'y', size: 100, lineHeight: 1 }, { role: 'rule', size: 0, fixed: 18 }]), 12 + 100 + 18);
  assert.equal(textWidth('abcd', 10), 24);
  assert.deepEqual(wrapLines('aa bb cc', 10, 20), ['aa', 'bb', 'cc']);
  assert.deepEqual(wrapLines('aa bb cc', 10, 40), ['aa bb', 'cc']);
});
