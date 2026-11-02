// F-23 · the wire rounding helpers (lib/public-wire.ts): a public return carries the printed precision and no more, and
// prints, tones and Flat labels exactly as the stored value does.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pct, tone } from './format.ts';
import { isoDay, numericDay, wireDay, wireHold, wirePct, wireRate } from './public-wire.ts';

const same = (v: number, r: number) => {
  for (const d of [0, 1]) {
    assert.equal(pct(r, d), pct(v, d), `pct(${v}, ${d})`);
    assert.equal(tone(r, d), tone(v, d), `tone(${v}, ${d})`);
  }
};
// Decimal places of the JSON text of a number (fraction form: 0.123 has 3).
const places = (r: number) => (JSON.stringify(r).split('.')[1] ?? '').replace(/e.*/, '').length;

test('an odd return goes out at 1 decimal of a percent, as a short literal', () => {
  assert.equal(wirePct(0.123456789), 0.123);
  assert.equal(JSON.stringify(wirePct(0.123456789)), '0.123');
  assert.equal(wirePct(-0.0567891), -0.057);
  assert.equal(wirePct(1.23412), 1.234);
  assert.equal(wirePct(1.23456), 1.2346); // 123.456% prints "+123.5%" and "+123%": 123.46% prints both
  assert.equal(wirePct(1.03526), 1.0354); // 1.035 * 100 is 103.49999999999999 in floats: the stand-in 0.04 further out
  assert.equal(wirePct(0), 0);
  assert.equal(Object.is(wirePct(-0.0000001), -0), false); // never -0
  assert.equal(wirePct(-0.0000001), 0);
});

test('a value on a 0-decimal boundary keeps both prints (aria name and visible text) with one more digit, not the stored float', () => {
  for (const v of [0.0049996, -0.0049996, 0.0149999, 0.0249, -0.0149999]) {
    const r = wirePct(v);
    same(v, r);
    assert.ok(places(r) <= 4, `${v} → ${r}`);
  }
  assert.equal(wirePct(0.0049996), 0.0046); // chosen from the prints ("+0.5%", "+0%"), not from the stored digits
  assert.equal(wirePct(0.0045001), 0.0046);
});

test('near -100% the extra digits pct() prints go out, and no more', () => {
  for (const v of [-0.99984, -0.999951234, -0.9999, -0.99949, -0.9995001, -1, -0.99999999]) {
    const r = wirePct(v);
    same(v, r);
    assert.ok(places(r) <= 7 || r === -0.99999999, `${v} → ${r}`); // the one "≈-100%" stand-in
  }
  assert.equal(wirePct(-0.99984321), -0.9998);
});

test('a sweep of 20,000 returns: every wire value prints and tones as stored, at most 4 decimals off the -100% edge', () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  for (let i = 0; i < 20_000; i++) {
    const v = i % 2 ? (rnd() - 0.5) * 0.2 : (rnd() * 3 - 0.99);
    const r = wirePct(v);
    same(v, r);
    assert.ok(places(r) <= 4, `${v} → ${r}`);
    // A 4th decimal only as the boundary stand-in (n.x6%), never the stored digits.
    if (places(r) === 4) assert.match(JSON.stringify(r), /[64]$/, `${v} → ${r}`);
  }
});

test('hold days go out at one decimal, printing the same text; a win rate as its printed whole percent', () => {
  assert.equal(wireHold(2.3456), 2.3);
  assert.equal(wireHold(2.05).toFixed(1), (2.05).toFixed(1));
  assert.equal(wireHold(0.0416666), 0);
  assert.equal(wireRate(7 / 12), 0.58);
  assert.equal(((wireRate(7 / 12)) * 100).toFixed(0), ((7 / 12) * 100).toFixed(0));
  assert.equal(wireRate(1), 1);
});

test('a 14:31:07 close goes out as its UTC day and prints that day in every zone', () => {
  const at = new Date('2026-10-30T14:31:07.123Z');
  const n = wireDay(at);
  assert.equal(String(n).length, 5);
  assert.equal(n, wireDay(new Date('2026-10-30T00:00:00Z')));
  assert.equal(n, wireDay(new Date('2026-10-30T23:59:59.999Z')));
  assert.equal(isoDay(at), '2026-10-30');
  assert.equal(numericDay(at), '10/30/2026');
  assert.equal(numericDay(new Date('2026-10-30T23:59:59Z')), '10/30/2026'); // UTC, whatever the process zone
  assert.equal(numericDay(n * 86_400_000 + 1), '10/30/2026');
});

test('wire rounding is idempotent over 100,000 values, and Flat and the near-total-loss stand-in keep their tone', () => {
  let seed = 11;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  for (let i = 0; i < 100_000; i++) {
    const v = i % 3 === 0 ? (rnd() - 0.5) * 0.02 : i % 3 === 1 ? rnd() * 5 - 1 : -1 + rnd() * 1e-3;
    const r = wirePct(v);
    assert.equal(wirePct(r), r, `${v} → ${r}`);
    same(v, r);
  }
  for (const v of [0, 0.0000049, -0.0000049, 0.00049, -0.00049]) { assert.equal(tone(wirePct(v)), 'flat'); assert.equal(pct(wirePct(v)), '0.0%'); }
  assert.equal(pct(wirePct(-0.999999999)), '≈-100.0%');
  assert.equal(tone(wirePct(-0.999999999)), 'down');
});

test('wire rounding is monotone, so wired min and max bound the wired points', () => {
  let prev = -Infinity, prevV = -Infinity;
  for (let v = -1.0001; v < 2; v += 0.0000137) {
    const r = wirePct(v);
    assert.ok(r >= prev, `${prevV} → ${prev} but ${v} → ${r}`);
    prev = r; prevV = v;
  }
});

test('code review 3: near -100% the wire value carries at most one digit past what pct() prints', () => {
  let seed = 3;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  for (let i = 0; i < 200_000; i++) {
    const v = -1 + rnd() * 2e-4;
    const r = wirePct(v);
    same(v, r);
    const printed = (pct(v, 1).split('.')[1] ?? '').replace('%', '').length; // decimals of the percent shown
    const sent = Math.max(0, places(r) - 2); // decimals of the percent sent
    assert.ok(sent <= printed + 1 || r === -0.99999999, `${v} → ${r} (shown ${pct(v, 1)})`);
  }
  assert.equal(pct(wirePct(-0.999995000230581), 1), pct(-0.999995000230581, 1));
  assert.ok(places(wirePct(-0.999995000230581)) <= 8);
});
