// F-2 PR-1: pages of 30, each a slice of one list ranked at a fixed time (asOf) and seeded by its UTC day.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CURSOR_MAX_AGE_MS, CURSOR_MAX_BYTES, decodeCursor, encodeCursor, firstPage, pageOf, PAGE_SIZE, readCursor, utcDay } from './pager.ts';

const NOW = Date.parse('2026-10-23T15:00:00.123Z');
const LIMIT = 200;

test('pages hold 30 cards', () => assert.equal(PAGE_SIZE, 30));

test('page 1 freezes the clock at now and takes its day from it', () => {
  assert.deepEqual(firstPage(NOW), { day: '2026-10-23', asOf: NOW, offset: 0 });
  assert.equal(utcDay(Date.parse('2026-10-23T23:59:59.999Z')), '2026-10-23');
  assert.equal(utcDay(Date.parse('2026-10-24T00:00:00.000Z')), '2026-10-24');
});

test('a cursor round-trips, is base64url and at most 200 bytes', () => {
  for (const offset of [30, 60, 90, 180]) {
    const c = { day: '2026-10-23', asOf: NOW - 3_600_000, offset };
    const s = encodeCursor(c);
    assert.match(s, /^[A-Za-z0-9_-]+$/);
    assert.ok(Buffer.byteLength(s) <= CURSOR_MAX_BYTES, `${s.length} bytes`);
    assert.deepEqual(decodeCursor(s, NOW, LIMIT), c);
  }
});

test('a bad or tampered cursor reads as page 1, never a throw', () => {
  const ok = { day: '2026-10-23', asOf: NOW - 60_000, offset: 30 };
  const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const good = encodeCursor(ok);
  const bad: unknown[] = [
    undefined, '', '%%%', 'not-base64!', good + '!', good.slice(0, -2), good.replace(/.$/, (ch) => (ch === 'A' ? 'B' : 'A')),
    'x'.repeat(CURSOR_MAX_BYTES + 1), 42, { d: 1 },
    enc(null), enc([]), enc('s'), enc({}),
    enc({ d: '2026-10-23', a: NOW - 60_000 }), // no offset
    enc({ d: '2026-10-23', a: NOW - 60_000, o: 31 }), // not a page boundary
    enc({ d: '2026-10-23', a: NOW - 60_000, o: 0 }), // page 1 needs no cursor
    enc({ d: '2026-10-23', a: NOW - 60_000, o: -30 }),
    enc({ d: '2026-10-23', a: NOW - 60_000, o: LIMIT + 30 }), // past the candidate cap
    enc({ d: '2026-10-23', a: NOW - 60_000, o: '30' }),
    enc({ d: '2026-10-23', a: NOW - 60_000, o: 30.5 }),
    enc({ d: '2026-10-22', a: NOW - 60_000, o: 30 }), // day does not match asOf
    enc({ d: '2026-10-23', a: NOW + 120_000, o: 30 }), // the future
    enc({ d: utcDay(NOW - CURSOR_MAX_AGE_MS - 1000), a: NOW - CURSOR_MAX_AGE_MS - 1000, o: 30 }), // too old
    enc({ d: '2026-10-23', a: 'yesterday', o: 30 }),
    enc({ d: '2026-10-23', a: NOW - 60_000, o: 30, x: 1 }), // unknown key
    enc({ d: '2026-10-23', a: NOW - 60_000.5, o: 30 }),
  ];
  for (const b of bad) {
    assert.equal(decodeCursor(b, NOW, LIMIT), null, `decode ${JSON.stringify(b)?.slice(0, 60)}`);
    assert.deepEqual(readCursor(b, NOW, LIMIT), firstPage(NOW), `read ${JSON.stringify(b)?.slice(0, 60)}`);
  }
  assert.deepEqual(readCursor(good, NOW, LIMIT), ok);
  assert.deepEqual(readCursor([good, 'x'], NOW, LIMIT), ok, 'a repeated param uses the first');
  assert.deepEqual(readCursor(['x', good], NOW, LIMIT), firstPage(NOW));
  assert.equal(decodeCursor([good], NOW, LIMIT), null, 'decode takes one string');
});

test('pages 1 to 3 concatenated equal the list; next is null at the end', () => {
  const list = Array.from({ length: 75 }, (_, i) => i);
  let c = firstPage(NOW);
  const got: number[] = [];
  const nexts: (number | null)[] = [];
  for (let p = 0; p < 3; p++) {
    const page = pageOf(list, c);
    got.push(...page.items);
    nexts.push(page.next?.offset ?? null);
    if (!page.next) break;
    assert.equal(page.next.asOf, c.asOf);
    assert.equal(page.next.day, c.day);
    c = decodeCursor(encodeCursor(page.next), NOW, LIMIT)!;
  }
  assert.deepEqual(got, list);
  assert.deepEqual(nexts, [30, 60, null]);
  assert.equal(pageOf(Array.from({ length: 60 }, (_, i) => i), { ...firstPage(NOW), offset: 30 }).next, null, 'exactly two pages: no empty third');
  assert.deepEqual(pageOf([1, 2], { ...firstPage(NOW), offset: 30 }).items, [], 'a list that shrank past the offset: an empty page');
});
