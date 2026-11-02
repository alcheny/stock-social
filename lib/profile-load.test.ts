// Known limits 2 (profile): one profile view reads the record once. The profile's reads (app/u/[handle]/load.ts) are
// built from a `perRequest` wrapper (React `cache` in the app, guarded below); here each simulated request gets its own
// memo, and a query-logging client pre-seeds the pool lib/db.ts reuses (`globalThis.sql`, as lib/feed.signed-out.test.ts).
// Gates: the card from the shared reads equals the card from the previous code path (every record state, many closes,
// mixed signs, tied close times), and nothing is remembered across requests.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';

const hasDb = !!process.env.DATABASE_URL;
const log: string[] = [];
if (hasDb) (globalThis as unknown as { sql: postgres.Sql }).sql = postgres(process.env.DATABASE_URL!, { onnotice: () => {}, debug: (_c, q) => { log.push(String(q).replace(/\s+/g, ' ')); } });
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
const src = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');

type Memo = <F extends (...args: never[]) => unknown>(fn: F) => F;
// One simulated server request: each wrapped function runs once per distinct argument list.
const requestScope = (): Memo => (fn) => {
  const seen = new Map<string, unknown>();
  return ((...args: never[]) => {
    const k = JSON.stringify(args);
    if (!seen.has(k)) seen.set(k, fn(...args));
    return seen.get(k);
  }) as typeof fn;
};

const tag = `pl${Math.random().toString(36).slice(2, 8)}`;
const attempts: number[] = [];
const users: Record<string, { id: number; handle: string }> = {};
const NOW = new Date('2026-10-30T12:00:00Z');
const filers: number[] = [];
const filerUsers: number[] = [];
const filerAttempts: number[] = [];

before(async () => {
  if (!hasDb) return;
  const { sql } = await import('./db.ts');
  await sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple();
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  for (const kind of ['connected', 'importing', 'failed', 'demo', 'empty', 'shuffled']) {
    const a = await createAttempt({ method: 'dev', attested: true });
    attempts.push(a);
    users[kind] = await createUserForAttempt(a, { handle: `${tag}_${kind.slice(0, 4)}` });
    const u = users[kind].id;
    if (kind === 'connected' || kind === 'importing' || kind === 'failed' || kind === 'shuffled') {
      await sql`update users set snaptrade_user_id = ${`${tag}-${kind}`} where id = ${u}`;
      await sql`insert into connections (attempt_id, user_id, state, consent_at, importing_at, last_progress_at, connected_at, failed_at, failure_reason)
        values (${a}, ${u}, ${kind === 'shuffled' ? 'connected' : kind}, now(), now(), now(), ${kind === 'connected' || kind === 'shuffled' ? new Date() : null},
          ${kind === 'failed' ? new Date() : null}, ${kind === 'failed' ? 'vendor' : null})`;
      await sql`insert into open_positions ${sql([0.12, -0.08, 0.031].map((p, i) => ({ user_id: u, account_id: 'acct', symbol: `${tag.toUpperCase()}${i}`, unrealized_pct: p })))}`;
    }
    if (kind === 'demo') {
      await sql`insert into activities (user_id, source, external_id, account_id, symbol, side, units, price, executed_at, raw)
        values (${u}, 'demo', ${`${tag}-demo-act`}, 'acct', 'DEMO', 'BUY', 1, 1, now(), '{}')`;
    }
    if (kind === 'empty') continue;
    // 40 closes: mixed signs, awkward floats, tied close times (every 4th close shares the previous close's time).
    const rows = Array.from({ length: 40 }, (_, i) => {
      const close = Date.parse('2025-01-01T00:00:00Z') + (i - (i % 4 === 3 ? 1 : 0)) * 3 * 86_400_000;
      return {
        user_id: u, sell_id: `${tag}-${kind}-${i}`, account_id: 'acct', symbol: `S${i % 7}`,
        opened_at: new Date(close - ((i % 5) + 1) * 86_400_000), closed_at: new Date(close),
        return_pct: [0.1, -0.2, 0.30000000000000004, -0.07, 0.013, -0.0333][i % 6] * (1 + i / 17), holding_days: (i % 5) + 1, verified: kind !== 'failed' || i % 9 !== 0,
      };
    });
    // Inserted in close order (as a sync of a record usually lands), except the 'shuffled' record.
    const order = kind === 'shuffled' ? rows.map((r, i) => [r, (i * 17) % 40] as const).sort((x, y) => x[1] - y[1]).map(([r]) => r) : rows;
    for (const r of order) await sql`insert into closed_trades ${sql(r)}`;
  }
});

after(async () => {
  if (!hasDb) return;
  const { sql } = await import('./db.ts');
  const ids = Object.values(users).map((u) => u.id);
  if (filerUsers.length) await sql`delete from users where id in ${sql(filerUsers)}`;
  if (filers.length) await sql`delete from public_filers where id in ${sql(filers)}`;
  if (filerAttempts.length) await sql`delete from signup_attempts where id in ${sql(filerAttempts)}`;
  if (attempts.length) await sql`delete from connections where attempt_id in ${sql(attempts)}`;
  if (ids.length) await sql`delete from users where id in ${sql(ids)}`;
  if (attempts.length) {
    await sql`delete from funnel_events where attempt_id in ${sql(attempts)}`;
    await sql`delete from signup_attempts where id in ${sql(attempts)}`;
  }
  await sql.end({ timeout: 1 });
});

// The card's read before this change, verbatim (record-card-data.ts on main after F-7 and options), with `now` fixed; `ordered` adds the
// close order the new loader states explicitly.
async function previousCard(handle: string, kind: 'unfurl' | 'square' | 'story', now: Date, ordered = false) {
  const { sql } = await import('./db.ts');
  const { publicRecord } = await import('./connections.ts');
  const { isDemoUser } = await import('./demo.ts');
  const { cardLink, recordCard } = await import('./record-card.ts');
  const { filerVisibleSql } = await import('./public-gate.ts');
  const { optionHeadline, paneView } = await import('./options-load.ts');
  const [user] = await sql`select id, display_name, public_filer_id from users u where handle = ${handle} and deleted_at is null and ${filerVisibleSql('u')}`;
  if (!user) return null;
  const rows = await sql`select symbol, return_pct, holding_days, opened_at, closed_at, verified from closed_trades where user_id = ${user.id} ${ordered ? sql`order by closed_at, id` : sql``}`;
  if (user.public_filer_id && !rows.length) return null;
  const [{ state }, demo, open, options] = await Promise.all([publicRecord(Number(user.id)), isDemoUser(Number(user.id)),
    sql`select unrealized_pct, fetched_at from open_positions where user_id = ${user.id}`, optionHeadline([Number(user.id)])]);
  const opt = paneView(options.get(Number(user.id))!);
  return recordCard({
    kind, handle, name: user.display_name as string | null, state, demo, now,
    link: kind === 'unfurl' ? null : cardLink(process.env, handle),
    verified: rows.length > 0 && rows.every((t) => t.verified),
    open: open.map((p) => Number(p.unrealized_pct)).filter(Number.isFinite),
    ...(open.length ? { openAsOf: new Date(Math.min(...open.map((p) => (p.fetched_at as Date).getTime()))) } : {}), // F-34: the positions' as-of
    options: { shareLabel: opt.label, line: opt.line },
    trades: rows.map((t) => ({ symbol: t.symbol, openedAt: t.opened_at, closedAt: t.closed_at, returnPct: Number(t.return_pct), holdingDays: Number(t.holding_days) })),
  });
}

async function modules() {
  const { profileReads } = await import('../app/u/[handle]/load.ts');
  const { recordCardLoader } = await import('../app/u/[handle]/record-card-data.ts');
  return { profileReads, recordCardLoader };
}

dbTest('the card from the shared reads equals the previous card for connected, importing, failed, demo and empty records', async () => {
  const { profileReads, recordCardLoader } = await modules();
  const { cardAlt, cardDescription } = await import('./record-card.ts');
  for (const k of ['connected', 'importing', 'failed', 'demo', 'empty'] as const) {
    for (const kind of ['unfurl', 'square', 'story'] as const) {
      const card = await recordCardLoader(profileReads(requestScope()))(users[k].handle, kind, NOW);
      const prev = await previousCard(users[k].handle, kind, NOW);
      assert.ok(card && prev, k);
      assert.deepEqual(card, prev, `${k} ${kind}`);
      assert.equal(cardAlt(card), cardAlt(prev));
      assert.equal(cardDescription(card), cardDescription(prev));
    }
  }
  // The fixtures really span the states the card distinguishes.
  const labels = new Set(await Promise.all(['connected', 'importing', 'failed', 'demo', 'empty'].map(async (k) => (await previousCard(users[k].handle, 'unfurl', NOW))!.label)));
  assert.ok(labels.size >= 4, [...labels].join(' | '));
  assert.ok((await previousCard(users.connected.handle, 'unfurl', NOW))!.open, 'a connected record shows its open positions');
  assert.equal(await recordCardLoader(profileReads(requestScope()))(`${tag}_nobody`, 'unfurl', NOW), null);
});

dbTest('closes stored out of close order: the card sums in close order (closed_at, id), whatever order a reader returns', async () => {
  const { profileReads, recordCardLoader } = await modules();
  for (const kind of ['unfurl', 'story'] as const) {
    const card = await recordCardLoader(profileReads(requestScope()))(users.shuffled.handle, kind, NOW);
    assert.deepEqual(card, await previousCard(users.shuffled.handle, kind, NOW, true), kind);
    // What a viewer reads is the same as the previous unordered read.
    const prev = (await previousCard(users.shuffled.handle, kind, NOW))!;
    for (const f of ['headline', 'range', 'count', 'period', 'evidence', 'trust', 'label'] as const) assert.equal(card![f], prev[f], f);
  }
});

dbTest('F-7 on main holds in the shared path: a filer\'s card exists only while its profile does (switch on, not hidden, not removed, a priced close)', async () => {
  const { sql } = await import('./db.ts');
  const { profileReads, recordCardLoader } = await modules();
  const mk = async (k: string, closes: number) => {
    const [f] = await sql`insert into public_filers (source, filer_key) values ('insider_reports', ${`${tag}-${k}`}) returning id`;
    filers.push(Number(f.id));
    const [a] = await sql`insert into signup_attempts (method, adult_attested_at) values ('dev', 'epoch') returning id`; // F-7's placeholder
    filerAttempts.push(Number(a.id));
    const [u] = await sql`insert into users (handle, display_name, adult_attested_at, public_filer_id, signup_attempt_id) values (${`${tag}_f${k}`}, ${`Filer ${k}`}, 'epoch', ${f.id}, ${a.id}) returning id, handle`;
    filerUsers.push(Number(u.id));
    for (let i = 0; i < closes; i++) await sql`insert into closed_trades ${sql({ user_id: u.id, sell_id: `${tag}-f${k}-${i}`, account_id: 'pub', symbol: `F${i % 3}`, opened_at: new Date(Date.parse('2025-03-01T00:00:00Z') + i * 86_400_000), closed_at: new Date(Date.parse('2025-03-05T00:00:00Z') + i * 86_400_000), return_pct: [0.04, -0.06, 0.011][i % 3], holding_days: 4, verified: false })}`;
    return { id: Number(f.id), handle: u.handle as string };
  };
  const shown = await mk('a', 12), none = await mk('b', 0), hidden = await mk('c', 5);
  await sql`update public_filers set hidden_at = now() where id = ${hidden.id}`;
  const card = (h: string) => recordCardLoader(profileReads(requestScope()))(h, 'unfurl', NOW);
  const prevEnv = process.env.PUBLIC_TRADERS;
  try {
    delete process.env.PUBLIC_TRADERS; // the default outside production: on
    const c = await card(shown.handle);
    assert.ok(c);
    assert.deepEqual(c, await previousCard(shown.handle, 'unfurl', NOW, true));
    assert.equal(await card(none.handle), null);
    assert.equal(await previousCard(none.handle, 'unfurl', NOW), null);
    assert.equal(await card(hidden.handle), null);
    assert.equal(await previousCard(hidden.handle, 'unfurl', NOW), null);
    process.env.PUBLIC_TRADERS = '0'; // the switch off: no filer card
    assert.equal(await card(shown.handle), null);
    assert.equal(await previousCard(shown.handle, 'unfurl', NOW), null);
  } finally {
    if (prevEnv === undefined) delete process.env.PUBLIC_TRADERS; else process.env.PUBLIC_TRADERS = prevEnv;
  }
});

dbTest('one request (metadata + page + card twice + demo checks) reads each part of the record once', async () => {
  const { profileReads, recordCardLoader } = await modules();
  const u = users.connected;
  const memo = requestScope();
  const r = profileReads(memo);
  const card = memo(recordCardLoader(r)); // as the app: loadRecordCard = cache(recordCardLoader(reads))
  log.length = 0;
  // What load() reads (page.tsx), as generateMetadata and the page both call it, then the card and the demo checks.
  const view = async () => {
    const user = await r.user(u.handle);
    await r.trades(user.id);
    if (user.snaptrade_user_id) await r.clocks(user.id);
    const { public: { state } } = await r.detail(user.id);
    if (state !== 'none') await r.positions(user.id);
  };
  await Promise.all([view(), view()]); // generateMetadata and the page may run concurrently
  await card(u.handle, 'unfurl', NOW);
  await r.demo(u.id);
  await card(u.handle, 'unfurl', NOW); // the share prompt's card
  await r.demo(u.id); await r.demo(u.id);
  const n = (re: RegExp) => log.filter((q) => re.test(q)).length;
  assert.equal(n(/from users where handle/), 1);
  assert.equal(n(/from closed_trades/), 1);
  assert.equal(n(/from open_positions/), 1);
  assert.equal(n(/^update connections/), 2); // applyClocks: its two UPDATEs, once
  assert.equal(n(/source = 'demo'/), 1);
  assert.ok(log.length <= 13, `${log.length} queries: ${log.join(' ;; ')}`); // 11 today with main's options and filer reads (≥15% headroom)
});

dbTest('nothing is remembered across requests: a second request reads again and sees a new close', async () => {
  const { sql } = await import('./db.ts');
  const { profileReads, recordCardLoader } = await modules();
  const u = users.connected;
  const first = await recordCardLoader(profileReads(requestScope()))(u.handle, 'unfurl', NOW);
  await sql`insert into closed_trades ${sql({ user_id: u.id, sell_id: `${tag}-late`, account_id: 'acct', symbol: 'LATE', opened_at: new Date('2026-10-01T00:00:00Z'), closed_at: new Date('2026-10-02T00:00:00Z'), return_pct: -0.5, holding_days: 1, verified: true })}`;
  try {
    log.length = 0;
    const second = await recordCardLoader(profileReads(requestScope()))(u.handle, 'unfurl', NOW);
    assert.equal(log.filter((q) => /from closed_trades/.test(q)).length, 1);
    assert.equal(parseInt(second!.countValue!), parseInt(first!.countValue!) + 1);
    assert.notEqual(second!.headline, first!.headline);
  } finally {
    await sql`delete from closed_trades where sell_id = ${`${tag}-late`}`;
  }
  // The app's reads outside a server request: React's cache memoizes nothing (each call reads).
  const { reads } = await import('../app/u/[handle]/load.ts');
  log.length = 0;
  await reads.user(u.handle);
  await reads.user(u.handle);
  assert.equal(log.filter((q) => /from users where handle/.test(q)).length, 2);
});

dbTest('applyClocks is idempotent: a second run with the same now marks nothing and records no funnel event', async () => {
  const { sql } = await import('./db.ts');
  const { applyClocks } = await import('./connections.ts');
  const a = attempts[attempts.length - 1];
  const [c] = await sql`insert into connections (attempt_id, state, pending_at) values (${a}, 'pending', now() - interval '30 days') returning id`;
  const id = Number(c.id);
  const now = new Date();
  const events = async () => Number((await sql`select count(*)::int as n from funnel_events where attempt_id = ${a} and name = 'expired'`)[0].n);
  const before = await events();
  assert.deepEqual((await applyClocks(now, { id })).expired, [id]);
  assert.equal(await events(), before + 1);
  assert.deepEqual(await applyClocks(now, { id }), { expired: [], failed: [] });
  const both = await Promise.all([applyClocks(now, { id }), applyClocks(now, { id })]);
  assert.deepEqual(both, [{ expired: [], failed: [] }, { expired: [], failed: [] }]);
  assert.equal(await events(), before + 1);
});

test('the app binds the per-request reads to React cache, and the profile and the card read only through them', () => {
  const load = src('../app/u/[handle]/load.ts');
  assert.match(load, /import \{ cache \} from 'react';/);
  assert.match(load, /export const reads = profileReads\(cache\);/);
  const card = src('../app/u/[handle]/record-card-data.ts');
  assert.match(card, /import \{ cache \} from 'react';/);
  assert.match(card, /export const loadRecordCard = cache\(recordCardLoader\(reads\)\);/);
  assert.doesNotMatch(card, /\bsql`|lib\/db/);
  const page = src('../app/u/[handle]/page.tsx');
  assert.match(page, /import \{ cache \} from 'react';/);
  assert.match(page, /const load = cache\(async \(handle: string\) => \{/);
  assert.match(page, /import \{ isDemoUser, reads \} from '\.\/load\.ts';/);
  assert.doesNotMatch(page, /from users where handle|from closed_trades where user_id = \$\{user\.id\}|from open_positions|applyClocks|publicRecordDetail/);
  // The image routes never run the profile's clocks.
  for (const f of ['../app/u/[handle]/opengraph-image.tsx', '../app/u/[handle]/story/route.tsx']) assert.doesNotMatch(src(f), /clocks|applyClocks/i, f);
});
