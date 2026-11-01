// F-14 × OPTIONS (the merge of the sync cadence with #62): a cadence sync reads positions per account, so one round may
// read account A and not B. #62's account-scoped replace added the read accounts' open option counts to the user's
// totals (right for the import, which starts from a user-wide reset); repeated on every positions-only round it would
// grow them without bound. replaceAccountOptionPositions replaces only the read accounts' counts and rows.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const opt = (key: string) => ({ positionKey: key, underlying: 'XYZ', right: 'CALL' as const, expiry: '2027-12-17', unrealizedPct: 0.1 });

dbTest('positions read per account: the open option totals stay the sum over accounts, rows of unread accounts stay, a dropped account goes', async () => {
  const { sql } = await import('./db.ts');
  const { replaceAccountOptionPositions } = await import('./options-sync.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `oc${Math.random().toString(36).slice(2, 10)}`;
  const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}u` });
  const A = `${tag}-a`, B = `${tag}-b`;
  // Reads with activities (replace); review B1's positions-only rule has its own test below.
  const write = (real: string[], read: string[], splits: [string, { options: ReturnType<typeof opt>[]; short: number; unsupported: number; optionOther?: number }][]) =>
    sql.begin((tx) => replaceAccountOptionPositions(tx, u.id, real, read, [], new Map(splits), { settle: true }));
  // A closing option row of that contract, imported now (option_activities.contract_key = account | position key).
  const closeOf = (account: string, key: string) => sql`insert into option_activities (user_id, source, external_id, account_id, contract_key, kind, open_close, raw)
    values (${u.id}, 'snaptrade', ${`${tag}-${account}-${key}-close`}, ${account}, ${`${account}|${key}`}, 'SELL', 'SELL_TO_CLOSE', '{}'::jsonb)`;
  const state = async () => {
    const [r] = await sql`select open_options_short as short, open_unsupported as unsupported, open_options_other as other,
      (select coalesce(string_agg(account_id || '/' || position_key, ',' order by account_id, position_key), '') from open_option_positions where user_id = ${u.id}) as rows
      from users where id = ${u.id}`;
    return { short: r.short, unsupported: r.unsupported, other: r.other, rows: r.rows };
  };
  try {
    // The first cadence sync reads every account: the user-wide replace starts the per-account counts.
    await write([A, B], [A, B], [[A, { options: [opt('a1')], short: 2, unsupported: 1, optionOther: 1 }], [B, { options: [opt('b1')], short: 3, unsupported: 0 }]]);
    assert.deepEqual(await state(), { short: 5, unsupported: 1, other: 1, rows: `${A}/a1,${B}/b1` });
    // Ten rounds reading A alone, same holdings: nothing grows, B's row and counts stay.
    for (let i = 0; i < 10; i++) await write([A, B], [A], [[A, { options: [opt('a1')], short: 2, unsupported: 1, optionOther: 1 }]]);
    assert.deepEqual(await state(), { short: 5, unsupported: 1, other: 1, rows: `${A}/a1,${B}/b1` });
    // A's holdings change (one short closed, a new long): only A's part moves. a1 is no longer listed but its close is
    // not imported yet, so it stays (TR-4, the share rule); it goes with the read that imports its close.
    await write([A, B], [A], [[A, { options: [opt('a2')], short: 1, unsupported: 1 }]]);
    assert.deepEqual(await state(), { short: 4, unsupported: 1, other: 0, rows: `${A}/a1,${A}/a2,${B}/b1` });
    await closeOf(A, 'a1');
    await write([A, B], [A], [[A, { options: [opt('a2')], short: 1, unsupported: 1 }]]);
    assert.deepEqual(await state(), { short: 4, unsupported: 1, other: 0, rows: `${A}/a2,${B}/b1` });
    // B read alone with no split (no option positions listed): its part is zero; b1 goes once its close is imported.
    await write([A, B], [B], []);
    assert.deepEqual(await state(), { short: 1, unsupported: 1, other: 0, rows: `${A}/a2,${B}/b1` });
    await closeOf(B, 'b1');
    await write([A, B], [B], []);
    assert.deepEqual(await state(), { short: 1, unsupported: 1, other: 0, rows: `${A}/a2` });
    // B is no longer real (disconnected): dropped even on a round that reads only A.
    await write([A, B], [B], [[B, { options: [opt('b2')], short: 3, unsupported: 0 }]]);
    await write([A], [A], [[A, { options: [opt('a2')], short: 1, unsupported: 1 }]]);
    assert.deepEqual(await state(), { short: 1, unsupported: 1, other: 0, rows: `${A}/a2` });
    await write([A, B], [B], [[B, { options: [opt('b2')], short: 3, unsupported: 0 }]]);
    const C = `${tag}-c`;
    await write([A, C], [C], []); // B gone while only C is read
    assert.deepEqual(await state(), { short: 1, unsupported: 1, other: 0, rows: `${A}/a2` });
  } finally {
    await sql`delete from users where id = ${u.id}`;
  }
});

dbTest('a record whose per-account counts were never started keeps its totals until every account is read at once', async () => {
  const { sql } = await import('./db.ts');
  const { replaceAccountOptionPositions } = await import('./options-sync.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `od${Math.random().toString(36).slice(2, 10)}`;
  const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}u` });
  const A = `${tag}-a`, B = `${tag}-b`;
  try {
    await sql`update users set open_options_short = 7, open_options_by_account = null where id = ${u.id}`;
    await sql.begin((tx) => replaceAccountOptionPositions(tx, u.id, [A, B], [A], [], new Map([[A, { options: [], short: 1, unsupported: 0 }]])));
    assert.equal((await sql`select open_options_short as n from users where id = ${u.id}`)[0].n, 7, 'never added to, never guessed');
    await sql.begin((tx) => replaceAccountOptionPositions(tx, u.id, [A, B], [A, B], [], new Map([[A, { options: [], short: 1, unsupported: 0 }]])));
    assert.equal((await sql`select open_options_short as n from users where id = ${u.id}`)[0].n, 1);
  } finally {
    await sql`delete from users where id = ${u.id}`;
  }
});
