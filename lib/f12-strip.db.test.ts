// F-12 (plan §2, §7 DB): the trade and month loaders read open positions (unrealized percent only) for a connected or
// failed record, and never while an import runs or with no consented connection. Query-logging client pre-seeded like
// lib/feed.signed-out.test.ts, so the test sees whether open_positions is read at all.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';

const hasDb = !!process.env.DATABASE_URL;
const log: string[] = [];
if (hasDb) (globalThis as unknown as { sql: postgres.Sql }).sql = postgres(process.env.DATABASE_URL!, { onnotice: () => {}, debug: (_c, q) => { log.push(String(q)); } });
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const STATES = ['connected', 'failed', 'importing', 'none'] as const;

dbTest('trade and month loaders: open positions for connected and failed records only; no open_positions read while importing or for none', async () => {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const { loadTradeShare } = await import('./trade-share-load.ts');
  const { loadRecap } = await import('./recap-load.ts');
  const tag = `f${Math.random().toString(36).slice(2, 9)}`;
  const users: { id: number; handle: string; state: (typeof STATES)[number] }[] = [];
  const closed = new Date(Date.now() - 2 * 86_400_000);
  const ym = closed.toISOString().slice(0, 7);
  try {
    for (const [t, state] of STATES.entries()) {
      const attempt = await createAttempt({ method: 'dev', attested: true });
      const handle = `${tag}${t}`;
      const u = await createUserForAttempt(attempt, { handle });
      users.push({ id: u.id, handle, state });
      await sql`insert into closed_trades ${sql(Array.from({ length: 6 }, (_, i) => ({
        user_id: u.id, sell_id: `${tag}-${t}-${i}`, account_id: 'a', symbol: `F${t}${i}`,
        opened_at: new Date(closed.getTime() - (i + 1) * 3_600_000 - 86_400_000), closed_at: new Date(closed.getTime() - i * 60_000),
        return_pct: i % 2 ? 0.1 : -0.05, holding_days: 1, verified: true,
      })))}`;
      if (state !== 'none') await sql`insert into connections (attempt_id, user_id, state, consent_at, importing_at, last_progress_at) values (${attempt}, ${u.id}, ${state}, now(), now(), now())`;
      await sql`insert into open_positions ${sql([
        { user_id: u.id, account_id: 'a', symbol: 'OPN', unrealized_pct: -0.2 },
        { user_id: u.id, account_id: 'b', symbol: 'OPN', unrealized_pct: 0.05 },
      ])}`;
    }
    for (const u of users) {
      log.length = 0;
      const t = await loadTradeShare(u.handle, `${tag}-${STATES.indexOf(u.state)}-0`);
      const tradeReads = log.filter((q) => /open_positions/.test(q)).length;
      log.length = 0;
      const r = await loadRecap(u.handle, ym);
      const recapReads = log.filter((q) => /open_positions/.test(q)).length;
      assert.ok(t && r, u.state);
      assert.equal(t.state, u.state);
      assert.equal(t.strip.evidence.n, 6);
      assert.equal(r.record.strip.evidence.n, 6);
      if (u.state === 'connected' || u.state === 'failed') {
        assert.deepEqual([...t.open!].sort(), [-0.2, 0.05], u.state);
        assert.deepEqual([...r.open!].sort(), [-0.2, 0.05], u.state);
        assert.equal(tradeReads, 1);
        assert.equal(recapReads, 1);
      } else {
        assert.equal(t.open, undefined, u.state);
        assert.equal(r.open, undefined, u.state);
        assert.equal(tradeReads, 0, `${u.state}: trade loader read open_positions`);
        assert.equal(recapReads, 0, `${u.state}: month loader read open_positions`);
      }
    }
  } finally {
    if (users.length) await sql`delete from users where id in ${sql(users.map((u) => u.id))}`;
  }
});
