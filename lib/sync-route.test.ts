// The cron route's shape (app/api/sync/route.ts), read from its source like lib/sync.test.ts and
// lib/privacy-purge.test.ts do: the housekeeping order (deletions, the discovery purge, then F-3's daily billing
// reconciliation, each its own step) sits in the housekeeping block before the shard run, and GET is the same handler
// as POST (the host's cron sends GET).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const route = readFileSync(new URL('../app/api/sync/route.ts', import.meta.url), 'utf8');
const at = (s: string) => route.indexOf(s);

test('route: housekeeping runs deletions, the discovery purge and the billing reconciliation (in that order) in its block, before the shard run', () => {
  const block = at('if (zero) {');
  assert.ok(block > 0);
  for (const s of ['syncAll(pendingDeletes', 'purgeDiscovery()', 'await reconcileIfDue()', 'await runShard(']) assert.ok(at(s) > 0, s);
  assert.ok(block < at('syncAll(pendingDeletes') && at('syncAll(pendingDeletes') < at('purgeDiscovery()') && at('purgeDiscovery()') < at('await reconcileIfDue()'));
  // The reconciliation is inside the housekeeping block (before the block's `housekeeping = {` summary), never a branch.
  assert.ok(at('await reconcileIfDue()') < at('housekeeping = {') && at('housekeeping = {') < at('await runShard('));
  assert.match(route, /try \{ await reconcileIfDue\(\); \} catch \(e\) \{ console\.error\('billing reconcile failed', logSafe\(e\)\); \}/);
});

test('route: the secret is checked before the parameters; GET is POST', () => {
  assert.ok(at('timingSafeEqual(got, want)') > 0 && at('timingSafeEqual(got, want)') < at('parseCall('));
  assert.match(route, /export async function GET\(req: NextRequest\) \{\s*return POST\(req\);\s*\}/);
});
