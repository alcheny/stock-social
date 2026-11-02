// F-34 AC3 and AC5 (plan §4, §5, §8): one account filter (lib/shared-accounts.ts#positionInRecord) on every open_positions
// reader: a fictional trader with a real, a simulated (paper) and a marked (another profile's) account, one position each,
// shows only the real one everywhere, and the line reads "1 position". The as-of is the MIN(fetched_at) of the shown
// positions only. The image loaders run the same number of statements as on main (no extra per-request query). The
// fixture's users are this file's own (tagged handles), deleted after; nothing else is read or counted.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import postgres from 'postgres';

const ROOT = new URL('..', import.meta.url);
registerHooks({
  resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) return next(new URL(spec.slice(2), ROOT).href, ctx);
    return next(spec, ctx);
  },
});
const hasDb = !!process.env.DATABASE_URL;
const log: string[] = [];
if (hasDb) (globalThis as unknown as { sql: postgres.Sql }).sql = postgres(process.env.DATABASE_URL!, { onnotice: () => {}, debug: (_c, q) => { log.push(String(q).replace(/\s+/g, ' ')); } });
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);

const tag = `f34${Math.random().toString(36).slice(2, 8)}`;
const TAG = tag.toUpperCase();
const DAY = 86_400_000;
const REAL_READ = new Date(Date.now() - 2 * DAY);
const OLD_READ = new Date(Date.now() - 9 * DAY); // the paper and marked rows are older: a leak would move the as-of
const users: { id: number; handle: string }[] = [];
let main: { id: number; handle: string }, paperOnly: { id: number; handle: string };
const closed = new Date(Date.now() - 3 * DAY);
const ym = closed.toISOString().slice(0, 7);
const symbols = { real: `${TAG}R`, paper: `${TAG}P`, mark: `${TAG}M` };

type Memo = <F extends (...args: never[]) => unknown>(fn: F) => F;
const requestScope = (): Memo => (fn) => {
  const seen = new Map<string, unknown>();
  return ((...args: never[]) => { const k = JSON.stringify(args); if (!seen.has(k)) seen.set(k, fn(...args)); return seen.get(k); }) as typeof fn;
};

before(async () => {
  if (!hasDb) return;
  const { sql } = await import('./db.ts');
  await sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple();
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  for (const k of ['m', 'p']) {
    const a = await createAttempt({ method: 'dev', attested: true });
    const u = await createUserForAttempt(a, { handle: `${tag}_${k}` });
    users.push(u);
    await sql`insert into connections (attempt_id, user_id, state, consent_at, importing_at, last_progress_at, connected_at) values (${a}, ${u.id}, 'connected', now(), now(), now(), now())`;
  }
  [main, paperOnly] = users;
  await sql`insert into closed_trades ${sql(Array.from({ length: 6 }, (_, i) => ({
    user_id: main.id, sell_id: `${tag}-${i}`, account_id: `${tag}-real`, symbol: `${TAG}${i}`,
    opened_at: new Date(closed.getTime() - (i + 1) * 3_600_000 - DAY), closed_at: new Date(closed.getTime() - i * 60_000),
    return_pct: i % 2 ? 0.1 : -0.05, holding_days: 1, verified: true,
  })))}`;
  await sql`insert into broker_accounts ${sql([
    { account_id: `${tag}-real`, user_id: main.id, is_paper: false },
    { account_id: `${tag}-paper`, user_id: main.id, is_paper: true },
    { account_id: `${tag}-paper2`, user_id: paperOnly.id, is_paper: true },
  ])}`;
  await sql`insert into shared_account_marks (account_id, user_id) values (${`${tag}-mark`}, ${main.id})`;
  await sql`insert into open_positions ${sql([
    { user_id: main.id, account_id: `${tag}-real`, symbol: symbols.real, unrealized_pct: -0.15, fetched_at: REAL_READ },
    { user_id: main.id, account_id: `${tag}-paper`, symbol: symbols.paper, unrealized_pct: 0.3, fetched_at: OLD_READ },
    { user_id: main.id, account_id: `${tag}-mark`, symbol: symbols.mark, unrealized_pct: 0.2, fetched_at: OLD_READ },
    { user_id: paperOnly.id, account_id: `${tag}-paper2`, symbol: symbols.paper, unrealized_pct: 0.1, fetched_at: OLD_READ },
  ])}`;
});
after(async () => {
  if (!hasDb) return;
  const { sql } = await import('./db.ts');
  if (users.length) await sql`delete from users where id in ${sql(users.map((u) => u.id))}`;
  await sql.end({ timeout: 1 });
});

const statements = async (fn: () => Promise<unknown>) => { const from = log.length; await fn(); return log.length - from; };

dbTest('F-34 AC3: paper and marked accounts never feed the open line; every reader returns the real position only', async () => {
  const { profileReads } = await import('../app/u/[handle]/load.ts');
  const rows = await profileReads(requestScope()).positions(main.id);
  assert.deepEqual(rows.map((r) => r.symbol), [symbols.real]);
  const { openPositions } = await import('./feed.ts');
  assert.deepEqual((await openPositions([main.id, paperOnly.id])).map((r) => Number(r.unrealized_pct)), [-0.15]);
  const { loadTradeShare, openRead } = await import('./trade-share-load.ts');
  const t = (await loadTradeShare(main.handle, `${tag}-0`))!;
  assert.deepEqual(t.open, [-0.15]);
  assert.equal(t.openAsOf!.getTime(), REAL_READ.getTime(), 'the as-of is the shown positions\' MIN(fetched_at)');
  assert.deepEqual(await openRead(main.id, 'connected'), { pcts: [-0.15], asOf: REAL_READ });
  assert.equal(await openRead(main.id, 'importing'), undefined);
  const { loadRecap } = await import('./recap-load.ts');
  const r = (await loadRecap(main.handle, ym))!;
  assert.deepEqual(r.open, [-0.15]);
  assert.equal(r.openAsOf!.getTime(), REAL_READ.getTime());
  const { recordCardLoader } = await import('../app/u/[handle]/record-card-data.ts');
  const card = (await recordCardLoader(profileReads(requestScope()))(main.handle, 'unfurl'))!;
  assert.match(card.open!.line.text, /^Still open: 1 position · at -15\.0% down$/);
  const { GET } = await import('../app/u/[handle]/pane/route.ts');
  const { PAYLOAD_V } = await import('./chart-series.ts');
  const pane = await (await GET(new Request(`http://x/u/${main.handle}/pane?v=${PAYLOAD_V}`), { params: Promise.resolve({ handle: main.handle }) })).json();
  assert.equal(pane.model.open.n, 1);
  assert.match(pane.model.openLine.text, /^Still open: 1 position · /);
  assert.equal(pane.model.openAsOf, REAL_READ.toISOString().slice(0, 10));
  const { symbolOpen } = await import('../app/t/open-positions.ts');
  const sym = await symbolOpen(symbols.real, symbols.paper, symbols.mark);
  assert.deepEqual([...sym.keys()], [symbols.real]);
  const { snapshotsFor } = await import('./display-log.ts');
  const snap = (await snapshotsFor([main.id, paperOnly.id], new Date())).get(main.id)!;
  assert.match(snap.openSummary!, /^1 open position\b/);
  assert.equal((await snapshotsFor([paperOnly.id], new Date())).size, 0, 'a paper-only trader logs no record');
  const { writeDisplayLog } = await import('./display-log.ts');
  assert.equal((await writeDisplayLog({ ids: [paperOnly.id] })).written, 0, 'the batch exists() filter skips a paper-only trader');
});

// Statement counts of the three image loaders on main (measured before F-34 with this fixture): F-34 adds none (EN7).
const MAIN_STATEMENTS = { trade: 10, recap: 10, card: 12 } as const;

dbTest('F-34 AC5: the image loaders run the same number of statements as on main (no extra per-request query)', async () => {
  const { loadTradeShare } = await import('./trade-share-load.ts');
  const { loadRecap } = await import('./recap-load.ts');
  const { profileReads } = await import('../app/u/[handle]/load.ts');
  const { recordCardLoader } = await import('../app/u/[handle]/record-card-data.ts');
  await loadTradeShare(main.handle, `${tag}-0`); // warm module-level caches (schema checks, prepared statements)
  const got = {
    trade: await statements(() => loadTradeShare(main.handle, `${tag}-0`)),
    recap: await statements(() => loadRecap(main.handle, ym)),
    card: await statements(() => recordCardLoader(profileReads(requestScope()))(main.handle, 'unfurl')),
  };
  assert.deepEqual(got, MAIN_STATEMENTS);
});
