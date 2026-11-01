// Fixes cycle 3, record pipeline (docs/direction/cycle3-2026-11-01.md → Fixes list F3-1, F3-3, F3-4, F3-5, F3-7, F3-13,
// F3-15; decisions: docs/features/logs/fixes-cycle3/committee-2026-11-01.md). Matcher unit tests are in lib/trades.test.ts.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HOW, HOW_PERSONAL, PROFILE } from './copy.ts';
import { MAX_DECAY, RECENCY_HOURS } from './feed.ts';
import { RANK_MIN_BETS } from './confidence.ts';
import { matchTrades, type Activity } from './trades.ts';
import { unusableTrade } from './corporate-actions.ts';

// ---- Copy (F3-7, F3-15, F3-1) ----

test('F3-7: /how states the base feed order truthfully, tied to the ranking constants; no "size is not used" claim', () => {
  const t = HOW_PERSONAL.text;
  assert.doesNotMatch(t, /Nothing about a return's size/);
  assert.match(t, /^Sign is never used, so a loss ranks like a gain of the same size\./);
  assert.ok(t.includes(`after each ${RECENCY_HOURS} hours`), 'recency constant');
  // lib/feed.ts's score (its SQL, written out): ln(1 + |r|·100) · exp(-max(0, min(age_hours / RECENCY_HOURS, MAX_DECAY))).
  const score = (r: number, ageHours: number) => Math.log1p(Math.abs(r) * 100) * Math.exp(-Math.max(0, Math.min(ageHours / RECENCY_HOURS, MAX_DECAY)));
  for (const age of [0, 100, 1000]) assert.ok(Math.abs(score(0.1, age + RECENCY_HOURS) / score(0.1, age) - 1 / 3) < 0.04, '"about a third as much after each RECENCY_HOURS"');
  assert.ok(t.includes(`at least ${RANK_MIN_BETS} independent bets`), 'evidence floor constant');
  assert.match(t, /a clear loss as much as a clear gain/);
  assert.match(t, /Signed out, everyone gets the same order\./); // the personal-order text follows unchanged
});

test('F3-15 + F3-1: the corporate exclusion line names every cause it counts; /how lists unusable broker rows and their reach', () => {
  assert.equal(PROFILE.excludedCorporate(2), "2 trades excluded: a share move, corporate action or broker row the importer can't price.");
  assert.doesNotMatch(PROFILE.excludedCorporate(1), /stock split/);
  const line = HOW.excluded.find((x) => x.startsWith('Trade rows the broker sent'));
  assert.ok(line);
  assert.match(line, /excluded and counted, never guessed/);
  assert.doesNotMatch(line, /every trade|any broker/i); // POLICY: no completeness claims (e2e/connect.spec.ts checks /how)
  assert.ok(line.endsWith('With no share count, that includes the later trades of the same stock in the same account; with no date, all of its trades there.'));
});

// ---- F3-5: shuffling same-instant rows changes no published figure ----

test('F3-5 property: shuffling rows (one buy and one sell per instant, date-only) changes no published figure', () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  for (let run = 0; run < 300; run++) {
    const rows: Activity[] = [];
    let held = 0;
    for (let day = 1; day <= 12; day++) {
      const at = new Date(Date.UTC(2025, 0, day));
      const sym = rnd() < 0.5 ? 'AAA' : 'BBB';
      if (rnd() < 0.7) { const u = 1 + Math.floor(rnd() * 5); held += u; rows.push({ externalId: `r${run}b${day}`, accountId: 'acc', symbol: sym, side: 'BUY', units: u, price: 10 + Math.floor(rnd() * 10), fee: 0, executedAt: at, verified: true }); }
      if (rnd() < 0.6) rows.push({ externalId: `r${run}s${day}`, accountId: 'acc', symbol: sym, side: 'SELL', units: 1 + Math.floor(rnd() * 5), price: 10 + Math.floor(rnd() * 10), fee: 0, executedAt: at, verified: true });
    }
    const figure = (input: Activity[]) => {
      const m = matchTrades(input);
      return JSON.stringify([m.excluded, m.excludedCorporate, m.trades.map((t) => [t.sellId, t.returnPct, t.holdingDays]).sort()]);
    };
    const base = figure(rows);
    for (let k = 0; k < 4; k++) {
      const shuffled = [...rows].sort(() => rnd() - 0.5);
      assert.equal(figure(shuffled), base, `run ${run}`);
    }
    assert.ok(held >= 0);
  }
});

// ---- Database: the sync path ----

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const vendorAcc = (ids: string[], auth = 'a') => ids.map((id) => ({ id, authorizationId: auth, institution: 'x', isPaper: false, initialSyncCompleted: true }));

async function setup() {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `f3${Math.random().toString(36).slice(2, 10)}`;
  const made: number[] = [];
  const mkUser = async (n: string) => {
    const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}${n}` });
    made.push(u.id);
    await sql`update users set snaptrade_user_id = ${`${tag}-${n}-vendor`}, snaptrade_secret_enc = 'enc' where id = ${u.id}`;
    return { id: u.id, snaptrade_user_id: `${tag}-${n}-vendor`, snaptrade_secret_enc: 'enc' };
  };
  const connect = async (userId: number, ids: string[], auth = 'a') => Number((await sql`insert into connections (attempt_id, user_id, vendor_authorization_id, state, consent_at, importing_at, connected_at, accounts)
    select signup_attempt_id, id, ${`${tag}-${auth}`}, 'connected', now(), now(), now(), ${sql.json(vendorAcc(ids, auth))} from users where id = ${userId} returning id`)[0].id);
  const act = (id: string, accountId: string, side: 'BUY' | 'SELL', price: number, day: number, units = 100, symbol = 'AAA') => ({
    externalId: `${tag}-${id}`, accountId, symbol, side, units, price, fee: 0, executedAt: new Date(Date.UTC(2024, 0, day)), verified: true, raw: {},
  });
  const bad = (id: string, accountId: string, type: 'BUY' | 'SELL', day: number | null, o: { price?: unknown; units?: unknown; symbol?: string } = {}) =>
    unusableTrade(accountId, { id: `${tag}-${id}`, symbol: o.symbol ?? 'AAA', type, trade_date: day === null ? null : new Date(Date.UTC(2024, 0, day)).toISOString(), price: 'price' in o ? o.price : 0, units: 'units' in o ? o.units : 100 })!;
  const user = async (id: number) => (await sql`select excluded_positions, excluded_corporate from users where id = ${id}`)[0];
  const closes = async (id: number) => (await sql`select sell_id, return_pct from closed_trades where user_id = ${id} order by closed_at`).map((r) => [r.sell_id as string, +(r.return_pct as number).toFixed(10)]);
  const cleanup = async (accounts: string[]) => {
    if (made.length) await sql`delete from users where id in ${sql(made)}`;
    if (accounts.length) await sql`delete from broker_accounts where account_id in ${sql(accounts)}`;
  };
  return { sql, tag, mkUser, connect, act, bad, user, closes, cleanup };
}

dbTest('F3-1: a sync stores an unpriceable sell (raw, as a counted row) and the next round trip is priced from its own buy (+20%, not -76%)', async () => {
  const { sql, tag, mkUser, connect, act, bad, user, closes, cleanup } = await setup();
  const { syncUser } = await import('./sync.ts');
  const acc = `${tag}-acc`;
  try {
    const u = await mkUser('a');
    await connect(u.id, [acc]);
    await syncUser(u, { listAccounts: async () => vendorAcc([acc]), fetchActivities: async () => ({
      activities: [act('b1', acc, 'BUY', 50, 1), act('b2', acc, 'BUY', 10, 3), act('s2', acc, 'SELL', 12, 4)],
      unusable: [bad('s1', acc, 'SELL', 2)],
    }) });
    assert.deepEqual(await closes(u.id), [[`${tag}-s2`, 0.2]]);
    assert.equal((await user(u.id)).excluded_corporate, 1);
    const [row] = await sql`select kind, detail, raw from corporate_actions where external_id = ${`${tag}-s1`}`;
    assert.equal(row.kind, 'unpriceable');
    assert.deepEqual([row.detail.reason, row.detail.side, row.detail.units], ['trade', 'SELL', 100]);
    assert.equal(row.raw.price, 0); // the vendor's row, kept raw
  } finally {
    await cleanup([acc]);
  }
});

dbTest('F3-1: an unpriceable sell in a pair with no stored activity is still counted; a first-history page read stores unusable rows too', async () => {
  const { tag, mkUser, connect, bad, user, cleanup } = await setup();
  const { syncUser } = await import('./sync.ts');
  const acc = `${tag}-acc`;
  try {
    const u = await mkUser('a');
    await connect(u.id, [acc]);
    await syncUser(u, {
      listAccounts: async () => vendorAcc([acc]),
      fetchActivities: async () => { throw new Error('the first history is read by pages'); },
      fetchActivitiesPage: async () => ({ activities: [], unusable: [bad('s1', acc, 'SELL', 2, { symbol: 'ZZZ' }), bad('b9', acc, 'BUY', 3, { symbol: 'YYY' })], done: true }),
    });
    assert.equal((await user(u.id)).excluded_corporate, 1); // the sell; a buy alone is no trade
  } finally {
    await cleanup([acc]);
  }
});

dbTest('F3-1: one vendor id stored both ways counts once; the version stored first wins (unpriced first: counted; priced first: the trade stays)', async () => {
  const { sql, tag, mkUser, connect, act, bad, user, closes, cleanup } = await setup();
  const { syncUser, rebuildTrades } = await import('./sync.ts');
  const a1 = `${tag}-a1`, a2 = `${tag}-a2`;
  try {
    const u = await mkUser('a'), w = await mkUser('b');
    await connect(u.id, [a1]);
    await connect(w.id, [a2], 'b');
    // u: the sell first arrives with no price, then a re-read brings it priced.
    await syncUser(u, { listAccounts: async () => vendorAcc([a1]), fetchActivities: async () => ({ activities: [act('b1', a1, 'BUY', 10, 1)], unusable: [bad('s1', a1, 'SELL', 2, { units: 100 })] }) });
    await syncUser(u, { listAccounts: async () => vendorAcc([a1]), fetchActivities: async () => ({ activities: [act('b1', a1, 'BUY', 10, 1), act('s1', a1, 'SELL', 11, 2)], unusable: [] }) });
    assert.equal(Number((await sql`select count(*) from activities where external_id = ${`${tag}-s1`}`)[0].count), 1); // both stored, raw
    assert.deepEqual(await closes(u.id), []);
    assert.equal((await user(u.id)).excluded_corporate, 1);
    // w: priced first, then a re-read lost the price: the published trade stays and nothing is counted.
    await syncUser(w, { listAccounts: async () => vendorAcc([a2], 'b'), fetchActivities: async () => ({ activities: [act('c1', a2, 'BUY', 10, 1), act('d1', a2, 'SELL', 11, 2)], unusable: [] }) });
    await syncUser(w, { listAccounts: async () => vendorAcc([a2], 'b'), fetchActivities: async () => ({ activities: [act('c1', a2, 'BUY', 10, 1)], unusable: [bad('d1', a2, 'SELL', 2)] }) });
    assert.deepEqual(await closes(w.id), [[`${tag}-d1`, 0.1]]);
    assert.equal((await user(w.id)).excluded_corporate, 0);
    // Stored in the same transaction (a tie on created_at): the activity wins, counted once.
    await sql.begin(async (tx) => {
      const { insertActivities } = await import('./sync.ts');
      const { insertCorporateActions } = await import('./corporate-actions.ts');
      await insertActivities(w.id, 'snaptrade', [act('e1', a2, 'BUY', 10, 5), act('f1', a2, 'SELL', 12, 6)], tx);
      await insertCorporateActions(tx, w.id, 'snaptrade', [bad('f1', a2, 'SELL', 6)]);
      await rebuildTrades(w.id, tx);
    });
    assert.deepEqual(await closes(w.id), [[`${tag}-d1`, 0.1], [`${tag}-f1`, 0.2]]);
    assert.equal((await user(w.id)).excluded_corporate, 0);
  } finally {
    await cleanup([a1, a2]);
  }
});

dbTest('F3-1: an undated row taints its whole pair: published sells become counted ones, so trades + counts stay equal to the sells', async () => {
  const { mkUser, tag, connect, act, bad, user, closes, cleanup } = await setup();
  const { syncUser } = await import('./sync.ts');
  const acc = `${tag}-acc`;
  try {
    const u = await mkUser('a');
    await connect(u.id, [acc]);
    const trades = [act('b1', acc, 'BUY', 10, 1), act('s1', acc, 'SELL', 11, 2), act('b2', acc, 'BUY', 10, 3), act('s2', acc, 'SELL', 11, 4)];
    await syncUser(u, { listAccounts: async () => vendorAcc([acc]), fetchActivities: async () => ({ activities: trades, unusable: [] }) });
    assert.equal((await closes(u.id)).length, 2);
    await syncUser(u, { listAccounts: async () => vendorAcc([acc]), fetchActivities: async () => ({ activities: trades, unusable: [bad('bx', acc, 'BUY', null, { price: 10 })] }) });
    assert.equal((await closes(u.id)).length, 0);
    assert.equal((await user(u.id)).excluded_corporate, 2);
  } finally {
    await cleanup([acc]);
  }
});

// ---- F3-3: a freeze needs confirmed absence; a frozen connection is not read ----

dbTest('F3-3: one list missing the accounts never freezes; a list showing them again clears it; a frozen connection is not read, not synced and its accounts stay owned (TR-6)', async () => {
  const { sql, tag, mkUser, connect, act, cleanup } = await setup();
  const { syncUser, usersToSync, FREEZE_CONFIRM_HOURS } = await import('./sync.ts');
  const { AccountClaimedError } = await import('./claims.ts');
  const acc = `${tag}-acc`;
  const H = 3_600_000, t0 = new Date();
  const at = (h: number) => new Date(t0.getTime() + h * H);
  try {
    const u = await mkUser('a');
    const c = await connect(u.id, [acc]);
    const conn = async () => (await sql`select missing_since, disconnected_at from connections where id = ${c}`)[0];
    let reads = 0;
    const broker = (ids: string[]) => ({ listAccounts: async () => vendorAcc(ids), fetchActivities: async () => { reads++; return { activities: [act('b1', acc, 'BUY', 100, 1), act('s1', acc, 'SELL', 120, 2)], unusable: [] }; } });
    await syncUser(u, broker([acc]), undefined, at(0));
    assert.equal(reads, 1);
    await syncUser(u, broker([]), undefined, at(1)); // first miss
    assert.equal((await conn()).disconnected_at, null);
    assert.ok((await conn()).missing_since);
    await syncUser(u, broker([]), undefined, at(1 + FREEZE_CONFIRM_HOURS - 1)); // still within the window
    assert.equal((await conn()).disconnected_at, null);
    await syncUser(u, broker([acc]), undefined, at(30)); // listed again: the miss was not confirmed
    assert.deepEqual(await conn(), { missing_since: null, disconnected_at: null });
    await syncUser(u, broker([]), undefined, at(31));
    await syncUser(u, broker([]), undefined, at(31 + FREEZE_CONFIRM_HOURS)); // confirmed: frozen
    assert.ok((await conn()).disconnected_at);
    // Frozen is not read: the trader leaves the hourly list, and a sync that runs anyway reads nothing when the account
    // reappears (whether a relisted account unfreezes is owner question Q1; nothing unfreezes today).
    assert.equal((await usersToSync()).some((x) => x.id === u.id), false);
    const before = reads;
    assert.equal(await syncUser(u, broker([acc]), undefined, at(80)), 0);
    assert.equal(reads, before);
    assert.ok((await conn()).disconnected_at);
    assert.equal(Number((await sql`select count(*) from closed_trades where user_id = ${u.id}`)[0].count), 1); // the record stays
    // TR-6: the frozen account is still this profile's; another profile linking it is refused.
    const w = await mkUser('b');
    await connect(w.id, [acc], 'b');
    await assert.rejects(syncUser(w, { listAccounts: async () => vendorAcc([acc], 'b'), fetchActivities: async () => [] }), AccountClaimedError);
  } finally {
    await cleanup([acc]);
  }
});

// ---- F3-4: open positions replaced per account, never per user ----

dbTest('F3-4: an account the vendor stops listing keeps its positions (private, rendered nowhere) and a relisted one gets fresh rows; profile deletion removes them', async () => {
  const { sql, tag, mkUser, connect, cleanup } = await setup();
  const { syncUser } = await import('./sync.ts');
  const a1 = `${tag}-a1`, a2 = `${tag}-a2`;
  try {
    const u = await mkUser('a');
    await connect(u.id, [a1]);
    await connect(u.id, [a2], 'b');
    const pos = new Map([[a1, [{ symbol: 'ONE', unrealizedPct: 0.1 }]], [a2, [{ symbol: 'TWO', unrealizedPct: -0.2 }]]]);
    const broker = (listed: { id: string; auth: string }[], pct = 0) => ({
      listAccounts: async () => listed.flatMap((x) => vendorAcc([x.id], x.auth)),
      fetchActivities: async () => [],
      fetchPositions: async (_u: unknown, id: string) => (pos.get(id) ?? []).map((p) => ({ ...p, unrealizedPct: p.unrealizedPct + pct })),
    });
    const shown = async () => (await sql`select account_id, symbol from open_positions where user_id = ${u.id} order by symbol`).map((r) => r.symbol);
    const kept = async () => (await sql`select symbol, unrealized_pct, fetched_at from unlisted_positions where user_id = ${u.id}`);
    await syncUser(u, broker([{ id: a1, auth: 'a' }, { id: a2, auth: 'b' }]));
    assert.deepEqual(await shown(), ['ONE', 'TWO']);
    const [{ fetched_at: read }] = await sql`select fetched_at from open_positions where user_id = ${u.id} and account_id = ${a2}`;
    await syncUser(u, broker([{ id: a1, auth: 'a' }])); // a2 no longer listed (not yet frozen)
    assert.deepEqual(await shown(), ['ONE']); // today's display: listed accounts only
    const k = await kept();
    assert.deepEqual(k.map((r) => [r.symbol, r.unrealized_pct]), [['TWO', -0.2]]); // kept, never deleted
    assert.equal((k[0].fetched_at as Date).getTime(), (read as Date).getTime()); // with its read time
    await syncUser(u, broker([{ id: a1, auth: 'a' }])); // unlisted again: still one row
    assert.equal((await kept()).length, 1);
    await syncUser(u, broker([{ id: a1, auth: 'a' }, { id: a2, auth: 'b' }], 0.05)); // relisted: fresh rows
    assert.deepEqual(await shown(), ['ONE', 'TWO']);
    assert.equal((await kept()).length, 0);
    await syncUser(u, broker([{ id: a1, auth: 'a' }]));
    assert.equal((await kept()).length, 1);
    await sql`delete from users where id = ${u.id}`; // profile deletion (cascade, lib/delete.ts)
    assert.equal((await kept()).length, 0);
  } finally {
    await cleanup([a1, a2]);
  }
});

// ---- F3-13: the tools card lists the corporate exclusion count in the profile's order ----

dbTest('F3-13: the record tools card lists every non-zero exclusion count, corporate included, in the profile\'s order', async () => {
  const { sql, mkUser, cleanup } = await setup();
  const { compareCards } = await import('./record-tools.ts');
  try {
    const u = await mkUser('a');
    await sql`update users set excluded_positions = 1, excluded_future = 2, excluded_corporate = 3 where id = ${u.id}`;
    const [card] = await compareCards([{ id: u.id, handle: 'h', name: 'n' } as never]);
    assert.deepEqual(card.excluded, [PROFILE.excludedPositions(1), PROFILE.excludedFuture(2), PROFILE.excludedCorporate(3)]);
  } finally {
    await cleanup([]);
  }
});

dbTest('F3-1/F3-5 rollout: scripts/rebuild-records.ts rebuilds a frozen trader the hourly sync no longer reads, and prints counts only', async () => {
  const { sql, tag, mkUser, connect, act, bad, user, cleanup } = await setup();
  const { insertActivities } = await import('./sync.ts');
  const { insertCorporateActions } = await import('./corporate-actions.ts');
  const { run } = await import('../scripts/rebuild-records.ts');
  const acc = `${tag}-acc`;
  try {
    const u = await mkUser('a');
    const c = await connect(u.id, [acc]);
    await sql`update connections set disconnected_at = now() where id = ${c}`;
    await insertActivities(u.id, 'snaptrade', [act('b1', acc, 'BUY', 10, 1)], sql);
    await insertCorporateActions(sql, u.id, 'snaptrade', [bad('s1', acc, 'SELL', 2)]);
    const lines: string[] = [];
    assert.deepEqual(await run((l) => lines.push(l), [u.id]), { rebuilt: 1, failed: 0 });
    assert.equal((await user(u.id)).excluded_corporate, 1);
    assert.deepEqual(lines, ['rebuilt records: 1, failed: 0']);
  } finally {
    await cleanup([acc]);
  }
});

dbTest('F3-1: an unusable sell in an account marked as another profile\'s is not counted on this profile (like its activities)', async () => {
  const { sql, tag, mkUser, bad, user, cleanup } = await setup();
  const { rebuildTrades } = await import('./sync.ts');
  const { insertCorporateActions } = await import('./corporate-actions.ts');
  const acc = `${tag}-acc`;
  try {
    const u = await mkUser('a');
    await insertCorporateActions(sql, u.id, 'snaptrade', [bad('s1', acc, 'SELL', 2)]);
    await rebuildTrades(u.id);
    assert.equal((await user(u.id)).excluded_corporate, 1);
    await sql`insert into shared_account_marks (account_id, user_id) values (${acc}, ${u.id})`;
    await rebuildTrades(u.id);
    assert.equal((await user(u.id)).excluded_corporate, 0);
  } finally {
    await cleanup([acc]);
  }
});
