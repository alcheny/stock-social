// FIXES-CYCLE5 part 2 (C5-34; committee round 2 item 10): the owner's Share preview (the square card) adds no query to an
// owner render. One simulated request runs what the profile runs (the record reads, the unfurl card for metadata, the
// demo checks); a second also builds the square card, as the page now does for the owner. Both read the same queries.
// A query-logging client pre-seeds the pool lib/db.ts reuses (as lib/profile-load.test.ts). Fictional data (POLICY P2).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import postgres from 'postgres';

const hasDb = !!process.env.DATABASE_URL;
const log: string[] = [];
if (hasDb) (globalThis as unknown as { sql: postgres.Sql }).sql = postgres(process.env.DATABASE_URL!, { onnotice: () => {}, debug: (_c, q) => { log.push(String(q).replace(/\s+/g, ' ')); } });
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);

type Memo = <F extends (...args: never[]) => unknown>(fn: F) => F;
const requestScope = (): Memo => (fn) => {
  const seen = new Map<string, unknown>();
  return ((...args: never[]) => {
    const k = JSON.stringify(args);
    if (!seen.has(k)) seen.set(k, fn(...args));
    return seen.get(k);
  }) as typeof fn;
};

const tag = `fc5p2${Math.random().toString(36).slice(2, 7)}`;
const NOW = new Date('2026-10-30T12:00:00Z');
let user: { id: number; handle: string } | null = null;
let attempt = 0;

before(async () => {
  if (!hasDb) return;
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  attempt = await createAttempt({ method: 'dev', attested: true });
  user = await createUserForAttempt(attempt, { handle: `${tag}_own` });
  await sql`update users set snaptrade_user_id = ${`${tag}-own`} where id = ${user.id}`;
  await sql`insert into connections (attempt_id, user_id, state, consent_at, importing_at, last_progress_at, connected_at)
    values (${attempt}, ${user.id}, 'connected', now(), now(), now(), now())`;
  await sql`insert into open_positions ${sql([0.12, -0.08].map((p, i) => ({ user_id: user!.id, account_id: 'acct', symbol: `${tag.toUpperCase()}${i}`, unrealized_pct: p })))}`;
  for (let i = 0; i < 12; i++) {
    const close = Date.parse('2026-01-01T00:00:00Z') + i * 5 * 86_400_000;
    await sql`insert into closed_trades ${sql({ user_id: user.id, sell_id: `${tag}-${i}`, account_id: 'acct', symbol: `P${i}`, opened_at: new Date(close - 2 * 86_400_000), closed_at: new Date(close), return_pct: [0.04, -0.03, 0.011][i % 3], holding_days: 2, verified: true })}`;
  }
});

after(async () => {
  if (!hasDb) return;
  const { sql } = await import('./db.ts');
  if (user) await sql`delete from users where id = ${user.id}`;
  if (attempt) {
    await sql`delete from connections where attempt_id = ${attempt}`;
    await sql`delete from funnel_events where attempt_id = ${attempt}`;
    await sql`delete from signup_attempts where id = ${attempt}`;
  }
  await sql.end({ timeout: 1 });
});

dbTest('C5-34: one owner render with the square Share preview reads exactly the queries it read without it', async () => {
  const { profileReads } = await import('../app/u/[handle]/load.ts');
  const { recordCardLoader } = await import('../app/u/[handle]/record-card-data.ts');
  const u = user!;
  const render = async (withPreview: boolean) => {
    const memo = requestScope();
    const r = profileReads(memo);
    const card = memo(recordCardLoader(r)); // as the app: loadRecordCard = cache(recordCardLoader(reads))
    log.length = 0;
    const row = await r.user(u.handle);
    await r.trades(row.id);
    await r.clocks(row.id);
    await r.detail(row.id);
    await r.positions(row.id);
    const unfurl = await card(u.handle, 'unfurl', NOW); // generateMetadata
    await r.demo(u.id);
    const square = withPreview ? await card(u.handle, 'square', NOW) : null; // the owner's Share box or prompt
    return { queries: [...log], unfurl, square };
  };
  await render(false); // warm-up: the first request of a process prepares statements and runs one-time reads
  const before = await render(false);
  const withPreview = await render(true);
  assert.ok(withPreview.square && withPreview.unfurl);
  assert.equal(withPreview.square!.kind, 'square');
  assert.equal(withPreview.queries.length, before.queries.length, `before: ${before.queries.join(' ;; ')}\nafter: ${withPreview.queries.join(' ;; ')}`);
  assert.deepEqual(withPreview.queries, before.queries);
  // The figures agree: the preview is the same record as the unfurl.
  for (const f of ['headline', 'range', 'countValue', 'trust', 'label'] as const) assert.equal(withPreview.square![f], withPreview.unfurl![f], f);
  // The guard has teeth: reading the option headline outside the per-request read costs at least one query.
  const { optionHeadline } = await import('./options-load.ts');
  log.length = 0;
  await optionHeadline([u.id]);
  assert.ok(log.length >= 1);
});
