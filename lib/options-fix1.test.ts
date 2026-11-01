// OPTIONS fix round 1 (docs/features/logs/options/review-round1.md, qa-round1.md): one regression test per item that
// is not a matcher hand case (those are in lib/options.test.ts). Database cases create and remove their own rows.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { OptionRow } from './options.ts';
import { oldestRead, paneView, type OptionCounts } from './options-view.ts';
import { OPTIONS } from './copy.ts';
import { PRIVATE_FIELDS } from './privacy-fields.ts';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const STRIKE = /123\.45|123450|00123450|\|100\b|\|10\b|[A-Z]{1,6}\s*\d{6}[CP]\d{8}/;
const C = (o: Partial<OptionCounts> = {}): OptionCounts => ({ shown: 0, short: 0, other: 0, openLong: 0, openShort: 0, openOther: 0, unsupported: 0, exerciseShares: 0, ...o });

async function setup() {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `f${Math.random().toString(36).slice(2, 10)}`;
  const users: number[] = [];
  const mk = async (n = 'u') => { const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}${n}` }); users.push(u.id); return u; };
  const opt = (id: string, account: string, kind: string, oc: string | null, at: string, o: Partial<OptionRow> = {}): OptionRow & { raw: unknown } => ({
    externalId: `${tag}-${id}`, accountId: account, kind, openClose: oc, underlying: 'XYZ', underlyingType: 'cs', right: 'CALL', expiry: '2026-10-16',
    strikeMilli: 123_450, multiplier: 100, occTicker: 'XYZ   261016C00123450', units: 1, price: 1, fee: 0, amount: null, currency: 'USD',
    executedAt: new Date(at), verified: true, raw: {}, ...o,
  });
  const cleanup = async (accounts: string[] = []) => {
    if (users.length) await sql`delete from users where id in ${sql(users)}`;
    if (accounts.length) await sql`delete from broker_accounts where account_id in ${sql(accounts)}`;
  };
  return { sql, tag, mk, opt, cleanup };
}

dbTest('B (QA 1): the open-gate model, serialized, carries no strike, contract symbol, contract key or multiplier; its keys and props neither', async () => {
  const { sql, tag, mk, opt, cleanup } = await setup();
  const { insertOptionActivities, rebuildRecord, replaceOptionPositions } = await import('./options-sync.ts');
  const { loadOptionRecord, optionHeadline } = await import('./options-load.ts');
  const u = await mk();
  const acc = `${tag}-a`;
  try {
    await insertOptionActivities(u.id, 'snaptrade', [opt('b', acc, 'BUY', 'BUY_TO_OPEN', '2026-10-01T15:00:00Z'), opt('s', acc, 'SELL', 'SELL_TO_CLOSE', '2026-10-02T15:00:00Z', { price: 2 })]);
    await rebuildRecord(u.id);
    await sql.begin((tx) => replaceOptionPositions(tx, u.id, null, new Map([[acc, { options: [{ positionKey: 'XYZ|2026-12-11|CALL|123450|100', underlying: 'XYZ', right: 'CALL', expiry: '2026-12-11', unrealizedPct: 0.1 }], short: 0, unsupported: 0 }]])));
    const rec = await loadOptionRecord(u.id, true);
    assert.equal(rec.gate, 'open');
    const text = JSON.stringify(rec);
    assert.doesNotMatch(text, STRIKE);
    assert.doesNotMatch(text, /position_?key|close_?id|"id"|"key"|multiplier/i);
    // Only what the renders show.
    if (rec.gate === 'open') {
      assert.deepEqual(Object.keys(rec.trades[0]).sort(), ['closedAt', 'expiry', 'returnPct', 'right', 'underlying', 'verified']);
      assert.deepEqual(Object.keys(rec.open[0]).sort(), ['expiry', 'pct', 'right', 'underlying']);
    }
    assert.doesNotMatch(JSON.stringify([...(await optionHeadline([u.id], () => true))]), STRIKE);
    // The render keys (app/u/[handle]/options-block.tsx) use the index, never the contract key.
    const block = readFileSync(new URL('../app/u/[handle]/options-block.tsx', import.meta.url), 'utf8');
    for (const m of block.matchAll(/key=\{([^}]*\}?)\}/g)) assert.doesNotMatch(m[1], /\.key\b|position|strike|occ|\.id\b/i, m[0]);
  } finally { await cleanup(); }
});

test('C (review 2) and M (QA 9): an option position with no price is counted, never -100%; the futures count holds futures-type kinds only; the underlying kinds follow the activity allowlist', async () => {
  const { splitPositionKinds, OPTION_UNDERLYING_KINDS } = await import('./broker.ts');
  const opt = (price: string | null, underlyingKind = 'stock') => ({ instrument: { kind: 'option', id: 'o', symbol: 'XYZ   261219C00123450', option_type: 'CALL', strike_price: '123.45',
    expiration_date: '2026-12-19', multiplier: '100', underlying: { kind: underlyingKind, id: 'u', symbol: 'XYZ', raw_symbol: 'XYZ' } }, units: '1', price, cost_basis: '2' }) as never;
  for (const price of [null, '', '  ']) {
    const { split } = splitPositionKinds([opt(price)]);
    assert.deepEqual([split.options.length, split.optionOther, split.unsupported], [0, 1, 0], `price ${JSON.stringify(price)}`);
  }
  assert.equal(splitPositionKinds([opt('0')]).split.options[0].unrealizedPct, -1); // a real zero price is a real -100%
  assert.deepEqual([...OPTION_UNDERLYING_KINDS].sort(), ['adr', 'cef', 'etf', 'stock']);
  const { split } = splitPositionKinds([opt('1', 'other'), opt('1', 'mutualfund'), { instrument: { kind: 'future_option', id: 'f', symbol: 'F' }, units: '1', price: '1', cost_basis: '1' } as never]);
  assert.deepEqual([split.optionOther, split.unsupported], [2, 1]);
  assert.equal(OPTIONS.openOther(2), "2 open options not shown: the importer can't price them exactly.");
});

test('D (review 3): the open block\'s "as of" is the oldest read across share and option positions, and unset when there is none', () => {
  const a = new Date('2026-10-30T12:00:00Z'), b = new Date('2026-10-29T08:00:00Z');
  assert.equal(oldestRead([], null), null);
  assert.equal(oldestRead([], b)!.toISOString(), b.toISOString()); // options only: no Invalid Date
  assert.equal(oldestRead([a], b)!.toISOString(), b.toISOString());
  assert.equal(oldestRead([a], null)!.toISOString(), a.toISOString());
  const page = readFileSync(new URL('../app/u/[handle]/page.tsx', import.meta.url), 'utf8');
  // The combined line counts the option percents the grid counts.
  assert.match(page, /combined\(trades\.map\(\(t\) => t\.return_pct as number\), \[\.\.\.positions\.map\(\(p\) => p\.pct\), \.\.\.optOpen\.map\(\(o\) => o\.pct\)\]\)/);
  assert.doesNotMatch(page, /Math\.min\(\.\.\.positions\.map/);
});

dbTest('E (review 4): a trader with old share history and older options gets them on the next sync (one page per account per sync, the same request count), then the connection is stamped and syncs read the week', async () => {
  const { sql, tag, mk, cleanup } = await setup();
  const { syncUser, insertActivities } = await import('./sync.ts');
  const { toOptionRows } = await import('./broker.ts');
  const u = await mk();
  const acc = `${tag}-acc`;
  await sql`update users set snaptrade_user_id = ${`${tag}-v`}, snaptrade_secret_enc = 'enc' where id = ${u.id}`;
  await sql`insert into connections (attempt_id, user_id, vendor_authorization_id, state, consent_at, importing_at, connected_at, accounts)
    select signup_attempt_id, id, 'a', 'connected', now() - interval '400 days', now(), now(), ${sql.json([{ id: acc, authorizationId: 'a', institution: 'x', isPaper: false, initialSyncCompleted: true }])} from users where id = ${u.id}`;
  const os = { id: 'o', ticker: 'XYZ   250620C00123450', option_type: 'CALL', strike_price: 123.45, expiration_date: '2025-06-20', underlying_symbol: { symbol: 'XYZ', type: { code: 'cs' } } };
  const history = [
    { id: `${tag}-sb`, type: 'BUY', symbol: { symbol: 'ABC' }, units: 1, price: 10, fee: 0, trade_date: '2025-01-02T15:00:00Z' },
    { id: `${tag}-ss`, type: 'SELL', symbol: { symbol: 'ABC' }, units: 1, price: 12, fee: 0, trade_date: '2025-01-09T15:00:00Z' },
    { id: `${tag}-ob`, type: 'BUY', option_type: 'BUY_TO_OPEN', option_symbol: os, units: 1, price: 2, fee: 0, trade_date: '2025-03-03T15:00:00Z' },
    { id: `${tag}-os`, type: 'SELL', option_type: 'SELL_TO_CLOSE', option_symbol: os, units: 1, price: 3, fee: 0, trade_date: '2025-04-01T15:00:00Z' },
  ];
  // Stored share history from before options were imported.
  await insertActivities(u.id, 'snaptrade', [{ externalId: `${tag}-sb`, accountId: acc, symbol: 'ABC', side: 'BUY', units: 1, price: 10, fee: 0, executedAt: new Date('2025-01-02T15:00:00Z'), verified: true, raw: {} },
    { externalId: `${tag}-ss`, accountId: acc, symbol: 'ABC', side: 'SELL', units: 1, price: 12, fee: 0, executedAt: new Date('2025-01-09T15:00:00Z'), verified: true, raw: {} }]);
  const calls: string[] = [];
  const broker = {
    pageLimit: 3,
    listAccounts: async () => [{ id: acc, authorizationId: 'a', institution: 'x', isPaper: false, initialSyncCompleted: true }],
    fetchActivitiesPage: async (_u: unknown, id: string, offset: number, limit = 3, sink?: (r: never[]) => void) => {
      calls.push(`page:${offset}`);
      const rows = history.slice(offset, offset + limit);
      sink?.(toOptionRows(id, rows as never) as never[]);
      const shares = rows.filter((r) => !r.option_symbol).map((r) => ({ externalId: r.id, accountId: id, symbol: (r.symbol as { symbol: string }).symbol, side: r.type as 'BUY' | 'SELL', units: 1, price: r.price, fee: 0, executedAt: new Date(r.trade_date), verified: true, raw: {} }));
      return { activities: shares, done: rows.length < limit };
    },
    fetchActivities: async () => { calls.push('week'); return []; },
    fetchPositions: async () => { calls.push('positions'); return []; },
  };
  const user = { id: u.id, snaptrade_user_id: `${tag}-v`, snaptrade_secret_enc: 'enc' };
  const stamped = async () => (await sql`select options_backfilled_at from connections where user_id = ${u.id}`)[0].options_backfilled_at;
  try {
    await syncUser(user, broker as never);
    assert.deepEqual(calls, ['page:0', 'positions']); // one request for the account's activities, as before
    assert.equal(await stamped(), null); // 3 of 4 rows read
    await syncUser(user, broker as never);
    assert.deepEqual(calls.slice(2), ['page:3', 'positions']);
    assert.ok(await stamped());
    assert.equal((await sql`select count(*)::int as n from option_activities where user_id = ${u.id}`)[0].n, 2);
    assert.equal((await sql`select count(*)::int as n from option_trades where user_id = ${u.id}`)[0].n, 1); // the older close matched
    assert.equal((await sql`select count(*)::int as n from activities where user_id = ${u.id}`)[0].n, 2); // no duplicate shares
    await syncUser(user, broker as never);
    assert.deepEqual(calls.slice(4), ['week', 'positions']);
  } finally { await cleanup([acc]); }
});

test('F (review 5, QA 3): BUY/SELL rows with option_type set, or an OCC symbol, never reach the share path; they reach the options sink and are counted', async () => {
  const { toOptionRows } = await import('./broker.ts');
  const { matchOptions } = await import('./options.ts');
  const src = readFileSync(new URL('./broker.ts', import.meta.url), 'utf8');
  assert.match(src, /if \(a\.option_type \|\| isOccSymbol\(symbol\)\) continue;/);
  const rows = [
    { id: 'a', type: 'BUY', option_type: 'BUY_TO_OPEN', symbol: { symbol: 'XYZ   261219C00123450' }, units: 1, price: 2, trade_date: '2026-10-01T15:00:00Z' },
    { id: 'b', type: 'SELL', option_type: 'SELL_TO_CLOSE', symbol: { symbol: 'XYZ   261219C00123450' }, units: 1, price: 3, trade_date: '2026-10-02T15:00:00Z' },
    { id: 'c', type: 'SELL', symbol: { symbol: 'XYZ261219C00123450' }, units: 1, price: 3, trade_date: '2026-10-03T15:00:00Z' },
    { id: 'd', type: 'BUY', option_type: 'BUY_TO_OPEN', symbol: { symbol: 'XYZ' }, units: 1, price: 2, trade_date: '2026-10-04T15:00:00Z' },
  ];
  const opts = toOptionRows('acc', rows as never);
  assert.deepEqual(opts.map((r) => r.externalId), ['a', 'b', 'c', 'd']);
  const m = matchOptions(opts, new Date('2026-11-01'));
  assert.equal(m.trades.length, 0);
  assert.equal(m.counts.malformed, 2); // the two closes without a contract; opening rows never count
});

dbTest('F: the record rebuild never writes an OCC symbol to closed_trades', async () => {
  const { sql, tag, mk, cleanup } = await setup();
  const { insertActivities } = await import('./sync.ts');
  const { rebuildRecord } = await import('./options-sync.ts');
  const u = await mk();
  try {
    // Even a row stored before this fix (an OCC string in activities.symbol) never becomes a public close.
    await insertActivities(u.id, 'snaptrade', [
      { externalId: `${tag}-1`, accountId: `${tag}-a`, symbol: 'XYZ   261219C00123450', side: 'BUY', units: 1, price: 2, fee: 0, executedAt: new Date('2026-10-01T15:00:00Z'), verified: true, raw: {} },
      { externalId: `${tag}-2`, accountId: `${tag}-a`, symbol: 'XYZ   261219C00123450', side: 'SELL', units: 1, price: 3, fee: 0, executedAt: new Date('2026-10-02T15:00:00Z'), verified: true, raw: {} },
      { externalId: `${tag}-3`, accountId: `${tag}-a`, symbol: 'ABC', side: 'BUY', units: 1, price: 2, fee: 0, executedAt: new Date('2026-10-01T15:00:00Z'), verified: true, raw: {} },
      { externalId: `${tag}-4`, accountId: `${tag}-a`, symbol: 'ABC', side: 'SELL', units: 1, price: 3, fee: 0, executedAt: new Date('2026-10-02T15:00:00Z'), verified: true, raw: {} },
    ]);
    const r = await rebuildRecord(u.id);
    const symbols = (await sql`select symbol from closed_trades where user_id = ${u.id}`).map((x) => x.symbol as string);
    assert.deepEqual(symbols, ['ABC']);
    assert.equal(r.occRemoved, 1); // counted with the other option exclusions
    const [c] = await sql`select excluded_options_other from users where id = ${u.id}`;
    assert.equal(c.excluded_options_other, 1);
  } finally { await cleanup(); }
});

test('G (QA 2): the pane and the record card get the label flag and the one rendered line, never the per-kind counts', () => {
  const v = paneView({ gate: 'closed', counts: C({ shown: 3, short: 1, other: 2, openLong: 1, openShort: 1, openOther: 1, unsupported: 2, exerciseShares: 1 }) });
  assert.deepEqual(v, { label: true, line: OPTIONS.gated(6, 3) });
  assert.deepEqual(Object.keys(v).sort(), ['label', 'line']);
  for (const f of ['../app/u/[handle]/pane/route.ts', '../lib/feed.ts', '../app/u/[handle]/record-card-data.ts']) assert.match(readFileSync(new URL(f, import.meta.url), 'utf8'), /paneView\(/, f);
  assert.doesNotMatch(readFileSync(new URL('../app/u/[handle]/pane/route.ts', import.meta.url), 'utf8'), /options: options\.get/);
  const open = paneView({ gate: 'open', counts: C({ shown: 14 }), summary: { n: 14, winRate: 0.5, avg: 0.1, range: null, bets: 3 } });
  assert.deepEqual(open, { label: true, line: 'Options: 14 trades · 50% wins · +10.0% avg' });
});

test('K (QA 7) and L (QA 8): /how no longer says "slightly"; share closes held over an exercise day have their own words and counter', () => {
  assert.equal(OPTIONS.howMath[0], 'An option trade’s return is on what the contracts cost, fees included: a contract that expires worthless shows −100%, and fees can take it lower, by a lot on very cheap contracts.');
  assert.equal(OPTIONS.technical(3), "3 option trades excluded: exercised, assigned or adjusted contracts and others the importer can't price exactly.");
  assert.equal(OPTIONS.technical(3, 2), "3 option trades excluded: exercised, assigned or adjusted contracts and others the importer can't price exactly, and 2 share trades held over an exercise or assignment day.");
  assert.equal(OPTIONS.exerciseShares(1), 'Excluded: 1 share trade held over an exercise or assignment day.');
  // The gated count line counts option rows only.
  assert.equal(paneView({ gate: 'closed', counts: C({ other: 1, exerciseShares: 5 }) }).line, OPTIONS.gated(1, 0));
  assert.match(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'), /schema_add_column\('users', 'excluded_exercise_shares'/);
});

test('O (QA 11): the raw option table\'s sensitive columns are mapped as private, under the existing words', () => {
  const cols = (w: string) => PRIVATE_FIELDS.find((f) => f.words === w)!.columns;
  for (const c of ['option_activities.share_price', 'option_activities.strike_milli', 'option_activities.cash_amount', 'option_activities.occ_ticker', 'option_activities.contract_key']) assert.ok(cols('prices').includes(c), c);
  assert.ok(cols('quantities').includes('option_activities.contract_units'));
  assert.ok(cols('fees').includes('option_activities.fee'));
  assert.ok(cols('account numbers').includes('option_activities.account_id'));
});

dbTest('P (QA 12): a close id another trader already holds is counted, not silently dropped; an exercise row without option_symbol taints through the activity\'s symbol', async () => {
  const { sql, tag, mk, opt, cleanup } = await setup();
  const { insertActivities } = await import('./sync.ts');
  const { insertOptionActivities, rebuildRecord } = await import('./options-sync.ts');
  const a = await mk('a'), b = await mk('b');
  try {
    // The same vendor ids under two sources (demo and broker) for two traders: the second close collides.
    const rows = [opt('b', `${tag}-x`, 'BUY', 'BUY_TO_OPEN', '2026-10-01T15:00:00Z'), opt('s', `${tag}-x`, 'SELL', 'SELL_TO_CLOSE', '2026-10-02T15:00:00Z', { price: 2 })];
    await insertOptionActivities(a.id, 'snaptrade', rows);
    await insertOptionActivities(b.id, 'demo', rows);
    await rebuildRecord(a.id);
    const r = await rebuildRecord(b.id);
    assert.equal(r.options.trades, 0);
    assert.equal(r.options.counts.duplicate, 1);
    assert.equal((await sql`select excluded_options_other from users where id = ${b.id}`)[0].excluded_options_other, 1);
    assert.match(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'), /create unique index option_trades_user_close on option_trades \(user_id, close_id\)/);
    // Exercise without option_symbol: the activity's own symbol taints the share close held over that day.
    await insertActivities(a.id, 'snaptrade', [
      { externalId: `${tag}-d1`, accountId: `${tag}-x`, symbol: 'QRS', side: 'BUY', units: 1, price: 2, fee: 0, executedAt: new Date('2026-10-05T15:00:00Z'), verified: true, raw: {} },
      { externalId: `${tag}-d2`, accountId: `${tag}-x`, symbol: 'QRS', side: 'SELL', units: 1, price: 3, fee: 0, executedAt: new Date('2026-10-09T15:00:00Z'), verified: true, raw: {} },
    ]);
    await insertOptionActivities(a.id, 'snaptrade', [{ ...opt('ex', `${tag}-x`, 'OPTIONEXERCISE', null, '2026-10-07T15:00:00Z', { underlying: null, right: null, expiry: null, strikeMilli: null, multiplier: null, occTicker: null }), raw: { symbol: { symbol: 'QRS' } } }]);
    const ra = await rebuildRecord(a.id);
    assert.equal(ra.removedForExercise, 1);
  } finally { await cleanup(); }
});
