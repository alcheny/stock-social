// OPTIONS fix round 4 (legal round 3 demand 5, AC 24): the F-10/F-12 record strip is a headline surface. It carries
// "Excluding options" whenever the trader has option closes or exclusions, on the feed card, the trade and month pages
// and their images, and never an option figure; with no options it is exactly as before.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { after, before } from 'node:test';
import { readFileSync } from 'node:fs';
import { layoutBand, recordStrip, stripFigures, stripImageLines, type StripInput, type StripSurface } from './record-strip.ts';
import { OPTIONS } from './copy.ts';
import { tradeHero } from './trade-share.ts';

const DAY = 86_400_000;
const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });
const now = new Date('2026-11-01T12:00:00Z');
const trades = Array.from({ length: 12 }, (_, i) => ({ symbol: `S${i % 7}`, openedAt: new Date(now.getTime() - (90 - i * 6) * DAY), closedAt: new Date(now.getTime() - (88 - i * 6) * DAY), returnPct: [0.12, -0.08, 0.03, -0.2][i % 4], holdingDays: 2 }));
const base: StripInput = { ...stripFigures(trades, now), state: 'connected', demo: false, verified: true, handle: 'opt_strip', open: [0.1, -0.05] };
const SURFACES: StripSurface[] = ['feed', 'page', 'image', 'figures'];

test('the strip says "Excluding options" on the feed card, page and image surfaces when the trader has option closes; never on the month\'s own figures', () => {
  for (const surface of SURFACES) {
    const s = recordStrip({ ...base, excludingOptions: true }, surface);
    const parts = s.figures.filter((p) => p.role === 'options');
    if (surface === 'figures') { assert.equal(parts.length, 0); continue; }
    assert.deepEqual(parts.map((p) => p.text), [OPTIONS.shareLabel], surface);
    assert.ok(s.text.endsWith(` · ${OPTIONS.shareLabel}`), surface);
    assert.match(s.alt, /, excluding options\./, surface);
    // No option figure: the qualifier is the only addition.
    assert.equal(s.text, `${recordStrip(base, surface).text} · ${OPTIONS.shareLabel}`);
  }
  // While importing nothing but the importing line is shown, options or not.
  assert.equal(recordStrip({ ...base, state: 'importing', excludingOptions: true }, 'page').figures.length, 0);
});

test('with no option counts every strip is exactly as before', () => {
  for (const surface of SURFACES) {
    assert.deepEqual(recordStrip({ ...base, excludingOptions: false }, surface), recordStrip(base, surface));
    assert.deepEqual(recordStrip({ ...base, excludingOptions: undefined }, surface), recordStrip(base, surface));
  }
});

test('the image draws "Excluding options" on its own line inside the band, and the worst case still fits (thesis, failed note, open positions)', () => {
  // The trade image's own hero lines, with a 280-character thesis (the first line to give way).
  const hero = tradeHero({ symbol: 'ABCDE', returnPct: 1.234, holdingDays: 12, closedAt: '2026-10-03T15:00:00Z', thesis: 'x '.repeat(140).trim() } as never);
  for (const state of ['connected', 'failed'] as const) {
    const lines = stripImageLines(recordStrip({ ...base, state, excludingOptions: true }, 'image'), { handle: 'opt_strip', newRecord: false, hero });
    const laid = layoutBand(lines);
    assert.equal(laid.fits, true, state);
    assert.deepEqual(laid.tooWide, [], state);
    // Its own line when it fits; else on the count line (the failed import's two note lines take the room). Never dropped.
    const own = laid.lines.find((l) => l.role === 'options'), count = laid.lines.find((l) => l.role === 'count')!;
    if (state === 'connected') assert.equal(own?.text, OPTIONS.shareLabel);
    // Merge with #60: the failed note's layout now leaves room, so either placement is valid; it is never dropped.
    else if (own) assert.equal(own.text, OPTIONS.shareLabel);
    else { assert.match(count.text, / · Excluding options$/); assert.ok(count.size >= 26); }
    // The disclaimer stays the band's last lines.
    assert.deepEqual(laid.lines.slice(-3).map((l) => l.role), ['disclaimer0', 'disclaimer1', 'disclaimer2']);
  }
});

dbTest('every strip surface reads the qualifier through the one reader (gated per trader): the feed page, the trade page and the month page, for a trader with options and not for one without', async () => {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const { insertActivities } = await import('./sync.ts');
  const { insertOptionActivities, rebuildRecord } = await import('./options-sync.ts');
  const { loadFeedPage } = await import('./feed.ts');
  const { loadTradeShare } = await import('./trade-share-load.ts');
  const { loadRecap } = await import('./recap-load.ts');
  const { tradeStripInput } = await import('./trade-share.ts');
  const { recordStripInput } = await import('./recap.ts');
  const tag = `q${Math.random().toString(36).slice(2, 9)}`;
  const t = Date.now();
  const ids: number[] = [];
  // Five closes within the last day each (feed-eligible), a connected record; one trader also has an option close.
  const mk = async (n: string, options: boolean) => {
    const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}${n}` });
    ids.push(u.id);
    await sql`update users set created_at = now() - interval '60 days' where id = ${u.id}`; // past the feed's new-account wait
    const acc = `${tag}${n}-a`;
    await sql`insert into connections (attempt_id, user_id, state, consent_at, importing_at, connected_at, accounts)
      select signup_attempt_id, id, 'connected', now(), now(), now(), ${sql.json([{ id: acc, isPaper: false }])} from users where id = ${u.id}`;
    await insertActivities(u.id, 'snaptrade', Array.from({ length: 5 }, (_, i) => [
      { externalId: `${tag}${n}-b${i}`, accountId: acc, symbol: `S${i}`, side: 'BUY' as const, units: 1, price: 10, fee: 0, executedAt: new Date(t - (6 + i) * 3_600_000), verified: true, raw: {} },
      { externalId: `${tag}${n}-s${i}`, accountId: acc, symbol: `S${i}`, side: 'SELL' as const, units: 1, price: 10 + i, fee: 0, executedAt: new Date(t - (1 + i) * 3_600_000), verified: true, raw: {} },
    ]).flat());
    if (options) await insertOptionActivities(u.id, 'snaptrade', [{ externalId: `${tag}${n}-o`, accountId: acc, kind: 'SELL', openClose: 'SELL_TO_CLOSE', underlying: 'XYZ', underlyingType: 'cs',
      right: 'CALL', expiry: '2026-12-19', strikeMilli: 1000, multiplier: 100, occTicker: 'XYZ   261219C00001000', units: 1, price: 1, fee: 0, amount: null, currency: 'USD', executedAt: new Date(t - 3 * DAY), verified: true, raw: {} }]);
    await rebuildRecord(u.id);
    return { id: u.id, handle: u.handle, sellId: `${tag}${n}-s0`, ym: new Date(t - 3_600_000).toISOString().slice(0, 7) };
  };
  try {
    const w = await mk('w', true), n = await mk('n', false);
    const page = await loadFeedPage(undefined, { ids: [w.id, n.id], now: Date.now() }); // after the rows were stored (late rows wait)
    assert.ok(page.cards.some((c) => c.user_id === w.id) && page.cards.some((c) => c.user_id === n.id), 'both traders have feed cards');
    assert.deepEqual([page.options?.get(w.id)?.label, page.options?.get(n.id)?.label], [true, false]);
    assert.ok(page.strips?.get(w.id));
    for (const [who, want] of [[w, true], [n, false]] as const) {
      const tv = (await loadTradeShare(who.handle, who.sellId))!;
      assert.equal(!!tv.excludingOptions, want);
      assert.equal(recordStrip(tradeStripInput(tv), 'page').figures.some((p) => p.role === 'options'), want);
      const r = (await loadRecap(who.handle, who.ym))!;
      assert.equal(!!r.excludingOptions, want);
      assert.equal(recordStrip(recordStripInput(r), 'page').figures.some((p) => p.role === 'options'), want);
    }
  } finally { await sql`delete from users where id in ${sql(ids)}`; }
});
