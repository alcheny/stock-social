// Orchestrator's second review of #100 (2026-11-02): two hidden-trader gaps. (a) personal ordering's reason line
// ("Similar holding period to @x") never names a hidden trader: followsAt and personal-load's liked-trader handles use
// the visible-user predicate. (b) the owner's own referral list skips hidden referred accounts. Scoped to this file's
// own users (shared database).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hasDb, people, ready, removePeople } from './thesis-fixtures.ts';

const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await ready(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });
const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');

dbTest('(a) followsAt never returns a trader the owner hid; unhidden, it does again', async () => {
  const { sql } = await import('./db.ts');
  const { followsAt } = await import('./follows.ts');
  const { ids: [viewer, trader] } = await people(2, 'f16r');
  try {
    await sql`insert into follows (viewer_id, trader_id, created_at) values (${viewer}, ${trader}, now() - interval '1 day')`;
    assert.deepEqual((await followsAt(viewer, new Date())).map((f) => f.trader), [trader]);
    await sql`update users set hidden_at = now() where id = ${trader}`;
    assert.deepEqual(await followsAt(viewer, new Date()), []);
    await sql`update users set hidden_at = null where id = ${trader}`;
    assert.deepEqual((await followsAt(viewer, new Date())).map((f) => f.trader), [trader]);
  } finally { await removePeople([viewer, trader]); }
});

test('(a) personal-load reads liked traders\' handles through the visible-user predicate only', () => {
  const s = src('./discovery/personal-load.ts');
  assert.match(s, /select v\.id, v\.handle from users v where v\.id = any\(\$\{more\}\) and \$\{visibleUser\('v'\)\}/);
  assert.doesNotMatch(s, /from users where id = any\(\$\{more\}\) and deleted_at is null/);
});

test('(b) the owner\'s referral list on the profile skips hidden referred accounts', () => {
  const s = src('../app/u/[handle]/page.tsx');
  assert.match(s, /from users u where u\.referred_by_user_id = \$\{user\.id\} and \$\{visibleUser\('u'\)\} order by u\.id/);
});
