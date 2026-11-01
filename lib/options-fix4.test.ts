// OPTIONS fix round 4 (tester re-check N1–N8, legal re-sign): one regression test per item that is not markup (the
// markup cases are in e2e/options.spec.ts). Database cases create and remove their own rows.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HOW, OPTIONS } from './copy.ts';
import { cardAlt, recordCard } from './record-card.ts';
import { recordStrip, stripFigures } from './record-strip.ts';
import { paneView, type OptionCounts } from './options-view.ts';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const C = (o: Partial<OptionCounts> = {}): OptionCounts => ({ shown: 0, short: 0, other: 0, openLong: 0, openShort: 0, openOther: 0, unsupported: 0, exerciseShares: 0, ...o });
const DAY = 86_400_000;
const now = new Date('2026-11-01T12:00:00Z');
const trades = Array.from({ length: 8 }, (_, i) => ({ symbol: `S${i}`, openedAt: new Date(now.getTime() - (40 - i) * DAY), closedAt: new Date(now.getTime() - (30 - i) * DAY), returnPct: i % 2 ? 0.05 : -0.02, holdingDays: 10 }));

test('legal re-sign 1 and 2: the gated line and the /how sentence, these words exactly', () => {
  assert.equal(OPTIONS.gated(4, 1), "4 option trades and 1 open option imported. Option results aren't shown on this record.");
  assert.equal(OPTIONS.gated(0, 2), "2 open options imported. Option results aren't shown on this record.");
  assert.equal(OPTIONS.gated(3, 0), "3 option trades imported. Option results aren't shown on this record.");
  assert.equal(OPTIONS.howLink, 'How options are counted');
  assert.equal(OPTIONS.how, 'Option results are shown only on records whose trader has consented to publishing them. Until then a record shows how many option trades and open options were imported, and its headline stats exclude options.');
  const all = JSON.stringify([HOW, OPTIONS.how, OPTIONS.howMath]);
  assert.doesNotMatch(all, /consent wording covers them|shown once/);
});

test('legal re-sign 3: every alt text with the qualifier says exactly "excluding options" (no paraphrase)', () => {
  const PARAPHRASE = /share trades only|options excluded|without options|not including options|Excluding options/;
  const card = (kind: 'unfurl' | 'square' | 'story') => cardAlt(recordCard({ kind, handle: 'h_x', name: null, trades, state: 'connected', demo: false, verified: true, now, link: null, options: { shareLabel: true, line: OPTIONS.gated(2, 0) } }));
  const strips = (['feed', 'page', 'image'] as const).map((s) => recordStrip({ ...stripFigures(trades, now), state: 'connected', demo: false, verified: true, handle: 'h_x', excludingOptions: true }, s).alt);
  for (const alt of [card('unfurl'), card('square'), card('story'), ...strips]) {
    assert.ok(alt.includes(OPTIONS.altQualifier), alt);
    assert.equal(OPTIONS.altQualifier, 'excluding options');
    assert.doesNotMatch(alt, PARAPHRASE, alt);
  }
  // Without options, no qualifier at all.
  assert.doesNotMatch(cardAlt(recordCard({ kind: 'square', handle: 'h_x', name: null, trades, state: 'connected', demo: false, verified: true, now, link: null })), /excluding options/i);
});

test('N1: an options-only record\'s card says "No closed share trades yet" and carries its options line (picture and alt)', () => {
  const m = recordCard({ kind: 'square', handle: 'h_x', name: null, trades: [], state: 'connected', demo: false, verified: true, now, link: null, options: { shareLabel: true, line: OPTIONS.gated(3, 1) } });
  assert.equal(m.body, OPTIONS.noShareCloses);
  assert.equal(m.optionsLine, OPTIONS.gated(3, 1));
  assert.match(cardAlt(m), /No closed share trades yet\./);
  assert.ok(cardAlt(m).includes(OPTIONS.gated(3, 1)));
  // (The picture itself is rendered in e2e/options.spec.ts "fix round 4 N1".) Every size carries it.
  for (const kind of ['unfurl', 'story'] as const) assert.equal(recordCard({ kind, handle: 'h_x', name: null, trades: [], state: 'connected', demo: false, verified: true, now, link: null, options: { shareLabel: true, line: OPTIONS.gated(3, 1) } }).optionsLine, OPTIONS.gated(3, 1));
  // No options: the empty card is as before.
  assert.equal(recordCard({ kind: 'square', handle: 'h_x', name: null, trades: [], state: 'connected', demo: false, verified: true, now, link: null }).body, 'No closed trades yet');
});

test('N7: open gate with no long close to summarize: the pane gets the profile\'s short and technical lines, and its note follows the gate', () => {
  const v = paneView({ gate: 'open', counts: C({ short: 2, openShort: 1, other: 3 }), summary: null });
  assert.equal(v.line, `${OPTIONS.short(2, 1)} ${OPTIONS.technical(3)}`);
  assert.equal(v.open, true);
  assert.equal(paneView({ gate: 'closed', counts: C({ short: 2 }) }).open, false);
  // The pane's closing note reads the view's gate flag: open → options are summarized above; closed → not shown.
  assert.equal(OPTIONS.paneNote(v.open), OPTIONS.paneNote(true));
  assert.match(OPTIONS.paneNote(v.open), /option trades are summarized above/);
  assert.match(OPTIONS.paneNote(paneView({ gate: 'closed', counts: C({ short: 2 }) }).open), /Options and positions with no recorded entry aren't shown/);
});

dbTest('N2: the trade and month pages (and their images) read the qualifier for a trader with options, and not for one without', async () => {
  const f = await strippedTraders();
  try {
    const { loadTradeShare } = await import('./trade-share-load.ts');
    const { loadRecap } = await import('./recap-load.ts');
    const { tradeStripInput } = await import('./trade-share.ts');
    const { recordStripInput } = await import('./recap.ts');
    for (const [who, want] of [[f.withOptions, true], [f.without, false]] as const) {
      const t = (await loadTradeShare(who.handle, who.sellId))!;
      assert.equal(!!t.excludingOptions, want, `${who.handle} trade`);
      for (const surface of ['page', 'image'] as const) assert.equal(recordStrip(tradeStripInput(t), surface).text.endsWith(` · ${OPTIONS.shareLabel}`), want, surface);
      const r = (await loadRecap(who.handle, who.ym))!;
      assert.equal(!!r.excludingOptions, want, `${who.handle} month`);
      assert.equal(recordStrip(recordStripInput(r), 'image').alt.includes(OPTIONS.altQualifier), want);
    }
  } finally { await f.cleanup(); }
});

test('N8: closing the vendor fake closes its IPv6 listener and connections too', async () => {
  const { startVendorFake } = await import('../e2e/fakes/vendor.ts');
  // A free port from the OS (port 0); the second fake re-binds the same one.
  const a = await startVendorFake(0);
  const port = (a.server.address() as { port: number }).port;
  await new Promise<void>((done) => { a.server.close(() => done()); a.server.closeAllConnections(); });
  // The same port binds again at once, both stacks.
  const b = await startVendorFake(port);
  await new Promise<void>((done) => { b.server.close(() => done()); b.server.closeAllConnections(); });
  // Nothing is left listening on the IPv6 side (where the host has IPv6 loopback at all).
  const { connect } = await import('node:net');
  const refused = await new Promise<boolean | null>((done) => {
    const c = connect({ host: '::1', port });
    c.once('connect', () => { c.destroy(); done(false); });
    c.once('error', (e: NodeJS.ErrnoException) => done(e.code === 'ECONNREFUSED' ? true : null));
  });
  if (refused !== null) assert.equal(refused, true);
});

dbTest('N4: a connection whose listed accounts are none of this sync\'s is never marked backfilled', async () => {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const { saveBackfill } = await import('./options-sync.ts');
  const tag = `n${Math.random().toString(36).slice(2, 10)}`;
  const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}u` });
  try {
    await sql`insert into connections (attempt_id, user_id, state, consent_at, importing_at, connected_at, accounts)
      select signup_attempt_id, id, 'connected', now(), now(), now(), ${sql.json([{ id: `${tag}-gone`, isPaper: false }])} from users where id = ${u.id}`;
    await sql.begin((tx) => saveBackfill(tx, u.id, [], new Map()));
    assert.equal((await sql`select options_backfilled_at from connections where user_id = ${u.id}`)[0].options_backfilled_at, null);
    await sql.begin((tx) => saveBackfill(tx, u.id, [`${tag}-gone`], new Map([[`${tag}-gone`, -1]])));
    assert.ok((await sql`select options_backfilled_at from connections where user_id = ${u.id}`)[0].options_backfilled_at);
  } finally { await sql`delete from users where id = ${u.id}`; }
});

test('decision recorded: a short close while a contract is tainted stays under "other", noted at the taint', async () => {
  const { matchOptions } = await import('./options.ts');
  const row = (id: string, kind: string, oc: string, units = 1) => ({ externalId: id, accountId: 'a', kind, openClose: oc, underlying: 'XYZ', underlyingType: 'cs', right: 'PUT', expiry: '2026-12-19',
    strikeMilli: 1000, multiplier: 100, occTicker: 'XYZ   261219P00001000', units, price: 1, fee: 0, amount: null, currency: 'USD', executedAt: new Date(`2026-11-0${id}T15:00:00Z`), verified: true });
  // Short 2, a contradicting buy to open (tainted, net -1), then the buy to close that brings it flat: "other", not short.
  const m = matchOptions([row('1', 'SELL', 'SELL_TO_OPEN', 2), row('2', 'BUY', 'BUY_TO_OPEN'), row('3', 'BUY', 'BUY_TO_CLOSE')], new Date('2026-11-30'));
  assert.equal(m.short, 0);
  assert.equal(m.counts.contradict, 2);
  // And the decision is written at the taint (a comment pin, in addition to the behaviour above).
  assert.match(readFileSync(new URL('./options.ts', import.meta.url), 'utf8'), /a short close while tainted stays counted under "other"/);
});

// A trader with options and one without, each with one share close this month: the loaders' fixtures.
async function strippedTraders() {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const { insertActivities } = await import('./sync.ts');
  const { insertOptionActivities, rebuildRecord } = await import('./options-sync.ts');
  const tag = `s${Math.random().toString(36).slice(2, 9)}`;
  const at = (d: number) => new Date(Date.now() - d * DAY);
  const ym = at(1).toISOString().slice(0, 7);
  const mk = async (n: string, options: boolean) => {
    const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}${n}` });
    const acc = `${tag}${n}-a`;
    await insertActivities(u.id, 'snaptrade', [
      { externalId: `${tag}${n}-b`, accountId: acc, symbol: 'ABC', side: 'BUY', units: 1, price: 10, fee: 0, executedAt: at(1.2), verified: true, raw: {} },
      { externalId: `${tag}${n}-s`, accountId: acc, symbol: 'ABC', side: 'SELL', units: 1, price: 11, fee: 0, executedAt: at(1), verified: true, raw: {} },
    ]);
    if (options) await insertOptionActivities(u.id, 'snaptrade', [{ externalId: `${tag}${n}-o`, accountId: acc, kind: 'SELL', openClose: 'SELL_TO_CLOSE', underlying: 'XYZ', underlyingType: 'cs',
      right: 'CALL', expiry: '2026-12-19', strikeMilli: 1000, multiplier: 100, occTicker: 'XYZ   261219C00001000', units: 1, price: 1, fee: 0, amount: null, currency: 'USD', executedAt: at(2), verified: true, raw: {} }]);
    await rebuildRecord(u.id);
    return { id: u.id, handle: u.handle, sellId: `${tag}${n}-s`, ym };
  };
  const withOptions = await mk('w', true), without = await mk('n', false);
  return { withOptions, without, cleanup: async () => { await sql`delete from users where id in ${sql([withOptions.id, without.id])}`; } };
}
