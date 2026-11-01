// F-15 second half · share_action rows against the database: one row per completed own share, deleted with the profile,
// no identifying or free-text column, owner only, no demo or marked account, the headline's sign, the daily cap under
// concurrency, UTC days. Shared database: every test creates its own users and reads only their rows.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const tag = () => `f15s${Math.random().toString(36).slice(2, 10)}`;
async function user(o: { trades?: number[]; demo?: boolean } = {}): Promise<{ id: number; handle: string }> {
  const { sql } = await import('./db.ts');
  const handle = tag();
  const [a] = await sql`insert into signup_attempts (method, adult_attested_at) values ('dev', now()) returning id`;
  const [u] = await sql`insert into users (handle, display_name, adult_attested_at, signup_attempt_id) values (${handle}, ${handle}, now(), ${a.id}) returning id, handle`;
  for (const [i, r] of (o.trades ?? []).entries()) {
    await sql`insert into closed_trades (user_id, sell_id, account_id, symbol, opened_at, closed_at, return_pct, holding_days, verified)
      values (${u.id}, ${`${handle}-${i}`}, 'a', 'F15S', now() - interval '3 days', now() - interval '1 day', ${r}, 2, true)`;
  }
  if (o.demo) await sql`insert into activities (user_id, source, external_id, account_id, symbol, side, units, price, executed_at, raw)
    values (${u.id}, 'demo', ${`${handle}-d`}, 'demo', 'F15S', 'BUY', 1, 1, now(), '{}')`;
  return u as { id: number; handle: string };
}
const rows = async (id: number) => (await import('./db.ts')).sql`select surface, outcome, record_sign, day from share_action where user_id = ${id} order by surface, outcome`;

dbTest('F-15 share_action: one row per completed own share (surface, outcome, sign, UTC day); nothing else stored', async () => {
  const { writeShareAction } = await import('./share-actions.ts');
  const u = await user({ trades: [0.05, -0.01] });
  const me = { id: u.id, handle: u.handle };
  assert.equal(await writeShareAction(me, `/u/${u.handle}`, 'copied', false), true);
  assert.equal(await writeShareAction(me, `/u/${u.handle}?via=card`, 'shared', true), true);
  assert.equal(await writeShareAction(me, `/u/${u.handle}/trade/${u.handle}-0`, 'shared', false), true);
  assert.equal(await writeShareAction(me, `/u/${u.handle}/month/2026-10`, 'copied', false), true);
  const r = await rows(u.id);
  assert.deepEqual(r.map((x) => [x.surface, x.outcome, x.record_sign]), [['card', 'copy', 'up'], ['month', 'copy', 'up'], ['story', 'sheet', 'up'], ['trade', 'sheet', 'up']]);
  const utc = new Date().toISOString().slice(0, 10);
  for (const x of r) assert.equal((x.day as Date).toISOString().slice(0, 10), utc);
});

dbTest('F-15 share_action: the day is the UTC date even when the session runs in another time zone', async () => {
  const { sql } = await import('./db.ts');
  const u = await user();
  await sql.begin(async (tx) => {
    await tx`set local time zone 'Pacific/Kiritimati'`; // UTC+14: its local date differs from UTC for 14 hours a day
    await tx`insert into share_action (user_id, day, surface, outcome, record_sign)
      select ${u.id}, (now() at time zone 'utc')::date, 'card', 'copy', 'none'`;
    const [x] = await tx`select day::text d, (now() at time zone 'utc')::date::text utc from share_action where user_id = ${u.id}`;
    assert.equal(x.d, x.utc);
  });
  const src = readFileSync(new URL('./share-actions.ts', import.meta.url), 'utf8');
  assert.equal((src.match(/\(now\(\) at time zone 'utc'\)::date/g) ?? []).length, 2); // the insert and the cap's count
  assert.doesNotMatch(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8').split('F-15 second half')[1], /default current_date/);
});

dbTest('F-15 share_action: owner only; another trader, a demo account, a marked account, a bad path or outcome write nothing', async () => {
  const { sql } = await import('./db.ts');
  const { writeShareAction } = await import('./share-actions.ts');
  const a = await user({ trades: [0.02] }), b = await user({ trades: [0.02] }), demo = await user({ trades: [0.02], demo: true }), marked = await user();
  await sql`update users set deleted_at = now() where id = ${marked.id}`;
  assert.equal(await writeShareAction({ id: a.id, handle: a.handle }, `/u/${b.handle}`, 'copied', false), false);
  assert.equal(await writeShareAction(null, `/u/${a.handle}`, 'copied', false), false);
  assert.equal(await writeShareAction({ id: a.id, handle: a.handle }, `/u/${a.handle.toUpperCase()}`, 'copied', false), false);
  assert.equal(await writeShareAction({ id: a.id, handle: a.handle }, `/u/${a.handle}`, 'dismissed', false), false);
  assert.equal(await writeShareAction({ id: a.id, handle: a.handle }, `/u/${a.handle}/trade/x`, 'shared', true), false);
  assert.equal(await writeShareAction({ id: demo.id, handle: demo.handle }, `/u/${demo.handle}`, 'copied', false), false);
  assert.equal(await writeShareAction({ id: marked.id, handle: marked.handle }, `/u/${marked.handle}`, 'copied', false), false);
  assert.equal(await writeShareAction({ id: a.id, handle: 'someoneelse' }, '/u/someoneelse', 'copied', false), false); // the handle must be the id's
  for (const u of [a, b, demo, marked]) assert.equal((await rows(u.id)).length, 0);
});

dbTest('F-15 share_action: the sign is the headline the profile shows (stats over every close, one decimal); none with no headline', async () => {
  const { sql } = await import('./db.ts');
  const { recordSign } = await import('./share-actions.ts');
  const { stats } = await import('./trades.ts');
  const { tone } = await import('./format.ts');
  const cases: [number[], string][] = [[[0.05, -0.01], 'up'], [[-0.02, -0.04], 'down'], [[0.0004, -0.0001], 'flat'], [[], 'none']];
  for (const [trades, want] of cases) {
    const u = await user({ trades });
    assert.equal(await recordSign(u.id), want, JSON.stringify(trades));
    if (trades.length) {
      const all = await sql`select return_pct, holding_days, closed_at from closed_trades where user_id = ${u.id}`;
      assert.equal(await recordSign(u.id), tone(stats(all.map((r) => ({ returnPct: r.return_pct, holdingDays: r.holding_days, closedAt: r.closed_at }))).avgReturn));
    }
  }
  for (const handle of ['momentum_maya', 'dividend_dan', 'yolo_yuki']) {
    const [d] = await sql`select id from users where handle = ${handle}`;
    if (!d) continue;
    const all = await sql`select return_pct, holding_days, closed_at from closed_trades where user_id = ${d.id}`;
    assert.equal(await recordSign(d.id), all.length ? tone(stats(all.map((r) => ({ returnPct: r.return_pct, holdingDays: r.holding_days, closedAt: r.closed_at }))).avgReturn) : 'none', handle);
  }
  // An import running or failed: the profile shows no headline, so the sign is none.
  for (const state of ['importing', 'failed'] as const) {
    const u = await user({ trades: [0.03] });
    const [a] = await sql`select signup_attempt_id id from users where id = ${u.id}`;
    await sql`insert into connections (attempt_id, user_id, state, consent_at, importing_at) values (${a.id}, ${u.id}, ${state}, now(), now())`;
    assert.equal(await recordSign(u.id), 'none', state);
  }
});

dbTest('F-15 share_action: at most 20 a trader a UTC day, even with 25 at once', async () => {
  const { writeShareAction, SHARE_CAP_PER_DAY } = await import('./share-actions.ts');
  const u = await user({ trades: [0.01] });
  const ok = await Promise.all(Array.from({ length: 25 }, () => writeShareAction({ id: u.id, handle: u.handle }, `/u/${u.handle}`, 'copied', false)));
  assert.equal(ok.filter(Boolean).length, SHARE_CAP_PER_DAY);
  assert.equal((await rows(u.id)).length, SHARE_CAP_PER_DAY);
});

dbTest('F-15 share_action: deleteProfile removes the trader\'s rows and leaves others\'', async () => {
  const { writeShareAction } = await import('./share-actions.ts');
  const { deleteProfile } = await import('./delete.ts');
  const a = await user({ trades: [0.01] }), b = await user({ trades: [0.01] });
  for (const u of [a, b]) await writeShareAction({ id: u.id, handle: u.handle }, `/u/${u.handle}`, 'copied', false);
  await deleteProfile({ id: a.id, handle: a.handle, snaptrade_user_id: null, snaptrade_secret_enc: null }, { deleteVendorUser: async () => {}, endBilling: async () => {} });
  assert.equal((await rows(a.id)).length, 0);
  assert.equal((await rows(b.id)).length, 1);
});

dbTest('F-15 share_action: exactly the allowed columns; no thesis, account id, IP, agent, viewer, session, cookie, fingerprint or time', async () => {
  const { sql } = await import('./db.ts');
  const cols = (await sql`select column_name c from information_schema.columns where table_schema = current_schema() and table_name = 'share_action' order by ordinal_position`).map((r) => r.c);
  assert.deepEqual(cols, ['user_id', 'day', 'surface', 'outcome', 'record_sign']);
  for (const c of cols) assert.doesNotMatch(c, /thesis|account|ip|addr|agent|^ua|viewer|session|cookie|finger|referr|url|path|query|handle|token|hash|device|time|_at$|sell|month|dest|recip|format/, c);
  const { SHARE_SURFACES, SHARE_OUTCOMES, RECORD_SIGNS } = await import('./share-actions.ts');
  for (const r of await sql`select distinct surface, outcome, record_sign from share_action`) {
    assert.ok((SHARE_SURFACES as readonly string[]).includes(r.surface), r.surface);
    assert.ok((SHARE_OUTCOMES as readonly string[]).includes(r.outcome), r.outcome);
    assert.ok((RECORD_SIGNS as readonly string[]).includes(r.record_sign), r.record_sign);
  }
});
