// Fix #4: the shared visible-user predicate hides a user whose deletion is in progress from every stock query and the
// sitemap rows, and agrees with the in-memory rule. Scoped to this file's own users and symbol (shared database).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isVisibleUser } from './visible-users.ts';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

test('isVisibleUser: only a user with no deletion mark is visible', () => {
  assert.equal(isVisibleUser({ deleted_at: null }), true);
  assert.equal(isVisibleUser({ deleted_at: new Date() }), false);
});

dbTest('visibleUser / visibleUserIds skip a user marked for deletion', async () => {
  const { sql } = await import('./db.ts');
  const { visibleUser, visibleUserIds } = await import('./visible-users.ts');
  const tag = `vu${Math.random().toString(36).slice(2, 9)}`;
  const sym = tag.toUpperCase().slice(0, 8);
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const mk = async (h: string) => createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: h });
  const live = await mk(`${tag}a`);
  const gone = await mk(`${tag}b`);
  await sql`update users set deleted_at = now() where id = ${gone.id}`;
  try {
    for (const [u, n] of [[live.id, 1], [gone.id, 2]] as const) {
      await sql`insert into closed_trades (user_id, account_id, symbol, sell_id, return_pct, holding_days, opened_at, closed_at, verified)
        values (${u}, 'acc', ${sym}, ${`${tag}-${n}`}, 0.1, 2, now() - interval '3 days', now(), true)`;
    }
    const joined = await sql`select t.user_id from closed_trades t join users u on u.id = t.user_id and ${visibleUser('u')} where t.symbol = ${sym}`;
    assert.deepEqual(joined.map((r) => r.user_id), [live.id]);
    const sub = await sql`select count(*)::int as n from closed_trades where symbol = ${sym} and user_id in (${visibleUserIds()})`;
    assert.equal(sub[0].n, 1);
    const users = await sql`select deleted_at from users where id in (${live.id}, ${gone.id}) order by id`;
    assert.deepEqual(users.map((u) => isVisibleUser(u as { deleted_at: Date | null })), [true, false]);
  } finally {
    await sql`delete from users where id in (${live.id}, ${gone.id})`;
  }
});
