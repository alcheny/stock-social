// F-16 follow-up (owner decision 2026-11-02): the owner-run account deletion, static checks. Pure: no database.
// - Never reachable from a web route: no file under app/ imports lib/owner-delete.ts or scripts/owner-delete.ts.
// - The script never reads lib/session.ts (no session, no cookie: the actor is a CLI arg or env).
// - One deletion path: lib/owner-delete.ts calls lib/delete.ts#deleteProfile and removes nothing itself.
// - The audit table is append-only, has no foreign key and holds no handle, email or name.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DELETE_REASONS, isDeleteReason } from './owner-delete.ts';
import { SCHEMA_MAP } from './privacy-retention.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(join(ROOT, dir))) {
    const p = join(dir, n);
    if (statSync(join(ROOT, p)).isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?|mjs)$/.test(n)) out.push(p);
  }
  return out;
}

// Every local module an entry file reaches (relative and @/ imports, static and dynamic).
function graph(entry: string): Set<string> {
  const seen = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const m of code(read(file)).matchAll(/\bfrom\s+['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const spec = m[1] ?? m[2];
      const base = spec.startsWith('@/') ? join(ROOT, spec.slice(2)) : spec.startsWith('.') ? resolve(join(ROOT, dirname(file)), spec) : null;
      if (!base) continue;
      const hit = [base, `${base}.ts`, `${base}.tsx`].find((p) => existsSync(p) && /\.tsx?$/.test(p));
      if (hit) visit(hit.slice(ROOT.length + 1));
    }
  };
  visit(entry);
  return seen;
}

test('owner delete: no file under app/ imports it (never reachable from a web route, action or page)', () => {
  const files = walk('app');
  assert.ok(files.length > 20, 'the walk found the app');
  for (const f of files) {
    assert.doesNotMatch(read(f), /owner-delete/, f);
    assert.ok(!graph(f).has('lib/owner-delete.ts'), `${f} reaches lib/owner-delete.ts`);
  }
});

test('owner delete: the script never reads lib/session.ts, and takes its actor from an arg or env', () => {
  const files = graph('scripts/owner-delete.ts');
  assert.ok(files.has('lib/owner-delete.ts') && files.has('lib/delete.ts'));
  assert.ok(!files.has('lib/session.ts'), [...files].join(', '));
  for (const f of files) assert.doesNotMatch(code(read(f)), /from ['"][^'"]*session(\.ts)?['"]|cookies\(\)/, f);
  const s = code(read('scripts/owner-delete.ts'));
  assert.match(s, /opt\('actor'\) \?\? \(env\.TRUST_ACTOR \|\| 'owner'\)/);
  assert.match(s, /if \(!confirm\) \{/);
});

test('owner delete: one deletion path (deleteProfile), the audit inside its marking transaction, no row removed here', () => {
  const lib = code(read('lib/owner-delete.ts'));
  assert.match(lib, /await deleteProfile\(/);
  assert.match(lib, /withMark: async \(tx\) => \{/);
  assert.doesNotMatch(lib, /delete\s+from|truncate/i);
  assert.doesNotMatch(code(read('scripts/owner-delete.ts')), /delete\s+from|truncate|sql`/i);
  const del = code(read('lib/delete.ts'));
  // withMark is queued first in the transaction that sets deleted_at, so it commits with the mark or not at all.
  assert.match(del, /sql\.begin\(\(tx\) => \[\s*\.\.\.\(deps\.withMark \? \[deps\.withMark\(tx\)\] : \[\]\),\s*tx`update users set deleted_at = coalesce\(deleted_at, now\(\)\) where id = \$\{u\.id\}`/);
});

test('owner delete: reasons are a fixed list with under-18-founded; trust_deletions holds no user id, handle, email or name (OD 2.22: date, reason, counts); mapped for retention', () => {
  assert.ok(DELETE_REASONS.includes('under-18-founded'));
  for (const r of DELETE_REASONS) assert.match(r, /^[a-z0-9-]+$/);
  assert.equal(isDeleteReason('under-18-founded'), true);
  assert.equal(isDeleteReason('may-be-under-18'), false);
  assert.equal(isDeleteReason(''), false);
  const schema = read('db/schema.sql');
  const start = schema.indexOf('create table if not exists trust_deletions');
  assert.ok(start > 0);
  const body = schema.slice(start, schema.indexOf(');', start));
  assert.doesNotMatch(code(body.replace(/--[^\n]*/g, '')), /references|user_id|handle|email|name/i);
  for (const c of ['closed_trades int not null', 'activities int not null', 'open_positions int not null', 'notes int not null', 'reports int not null']) assert.match(body, new RegExp(c));
  assert.ok(SCHEMA_MAP.trust_deletions);
  assert.match(SCHEMA_MAP.trust_deletions.holds, /no user id, handle, email, name/);
  assert.equal(SCHEMA_MAP.trust_deletions.personal, false);
});

test('owner delete: the runbook points the founded under-18 step at the script, cites Section 7, and gives no agent a deletion step', () => {
  const rb = read('docs/security/trust-and-safety-runbook.md');
  assert.match(rb, /scripts\/owner-delete\.ts <user_id> under-18-founded --confirm=<handle>/);
  assert.match(rb, /`docs\/COMPLIANCE\.md` Section 7/);
  assert.doesNotMatch(rb, /no audited, owner-run account-closing path yet/);
  assert.match(rb, /never asks an assistant or an automated job to close accounts or remove data/);
  const f16 = read('docs/features/F-16-trust-and-safety-slice.md');
  const open = f16.slice(f16.indexOf('## Open questions'), f16.indexOf('## Build log'));
  // Feature files are append-only: the item stays, marked answered.
  assert.match(open, /hide stays in place \(runbook Section 3\)\.\n\s+\*\*Answered 2026-11-02 \(owner decision\): `scripts\/owner-delete\.ts`/);
});
