// The new-trade prompt's Dismiss/Open is one statement: a reader polling while it runs never sees the action written
// without the new seen time (the e2e/app.spec.ts:488 race), and the first-positive-action rule is unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
// FIXES-CYCLE5 (F5-16): the suite deletes exactly what it created (its users, their cascade, then their sign-up attempts
// and any funnel rows on them) before the pool closes, so two runs leave the same row counts.
const made = { users: [] as number[], attempts: [] as number[] };
after(async () => {
  if (!hasDb) return;
  const { sql } = await import('./db.ts');
  if (made.users.length) await sql`delete from users where id in ${sql(made.users)}`;
  if (made.attempts.length) {
    await sql`delete from funnel_events where attempt_id in ${sql(made.attempts)}`;
    await sql`delete from signup_attempts where id in ${sql(made.attempts)}`;
  }
  await sql.end({ timeout: 1 });
});

async function user(): Promise<number> {
  const { sql } = await import('./db.ts');
  const h = `tp${Math.random().toString(36).slice(2, 10)}`;
  const [a] = await sql`insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id`;
  made.attempts.push(a.id as number);
  const [u] = await sql`insert into users (handle, display_name, adult_attested_at, signup_attempt_id) values (${h}, ${h}, now(), ${a.id}) returning id`;
  made.users.push(u.id as number);
  return u.id as number;
}

dbTest('trades prompt: no reader ever sees the action written with the old seen time (one statement)', async () => {
  const { sql } = await import('./db.ts');
  const { recordTradesPrompt } = await import('./trades-prompt.ts');
  for (let round = 0; round < 30; round++) {
    const id = await user();
    await sql`update users set trades_prompt_seen_at = now() - interval '10 days', trades_prompt_action = null where id = ${id}`;
    let torn = 0, done = false;
    const watch = (async () => {
      while (!done) {
        const [r] = await sql`select trades_prompt_action a, trades_prompt_seen_at < now() - interval '1 day' old from users where id = ${id}`;
        if (r.a === 'dismissed' && r.old) torn++;
      }
    })();
    await recordTradesPrompt(id, 'dismissed');
    done = true;
    await watch;
    assert.equal(torn, 0, `round ${round}: the action was visible with the old seen time`);
    const [r] = await sql`select trades_prompt_action a, trades_prompt_seen_at > now() - interval '1 minute' fresh from users where id = ${id}`;
    assert.deepEqual([r.a, r.fresh], ['dismissed', true]);
  }
});

dbTest('trades prompt: opened replaces dismissed, dismissed never replaces opened; the seen time always moves', async () => {
  const { sql } = await import('./db.ts');
  const { recordTradesPrompt } = await import('./trades-prompt.ts');
  const id = await user();
  const state = async () => (await sql`select trades_prompt_action a from users where id = ${id}`)[0].a;
  await recordTradesPrompt(id, 'dismissed');
  assert.equal(await state(), 'dismissed');
  await recordTradesPrompt(id, 'opened');
  assert.equal(await state(), 'opened');
  await sql`update users set trades_prompt_seen_at = now() - interval '10 days' where id = ${id}`;
  await recordTradesPrompt(id, 'dismissed');
  assert.equal(await state(), 'opened');
  assert.equal((await sql`select trades_prompt_seen_at > now() - interval '1 minute' f from users where id = ${id}`)[0].f, true);
  await recordTradesPrompt(id, 'bogus' as never);
  assert.equal(await state(), 'opened');
  const src = readFileSync(new URL('../app/actions.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /update users set trades_prompt_seen_at = now\(\) where id = \$\{user\.id\}`/); // the second statement is gone
});
