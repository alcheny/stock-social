// Privacy work (2026-11-01): the schema map names every table with a retention class (lib/privacy-retention.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SCHEMA_MAP, schemaTables } from './privacy-retention.ts';

const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');

test('every table in db/schema.sql has a schema-map entry with a retention class, and every entry names a real table', () => {
  const tables = schemaTables(schema);
  assert.ok(tables.length >= 20);
  assert.deepEqual(tables.filter((t) => !SCHEMA_MAP[t]), [], 'tables with no entry in lib/privacy-retention.ts SCHEMA_MAP');
  assert.deepEqual(Object.keys(SCHEMA_MAP).filter((t) => !tables.includes(t)), [], 'entries with no table');
  for (const [t, e] of Object.entries(SCHEMA_MAP)) {
    assert.ok(['account', 'session', 'short', 'reserved', 'none'].includes(e.retention), t);
    assert.ok(e.holds.length > 10, t);
    if (!e.personal) assert.ok(e.retention !== 'account', `${t}: no personal data, so not kept "until account deletion"`);
  }
});

test('the parser finds a table added without an entry (the check fails for a new table)', () => {
  const added = `${schema}\ncreate table if not exists brand_new_table (id int);\nCREATE TABLE other_new (x int);\n-- create table commented_out (x int);`;
  const missing = schemaTables(added).filter((t) => !SCHEMA_MAP[t]);
  assert.deepEqual(missing, ['brand_new_table', 'other_new']);
});

test('every table holding a user id is personal and goes with the account (cascade or purge)', () => {
  const blocks = schema.replace(/--[^\n]*/g, '').split(/create\s+table\s+if\s+not\s+exists\s+/i).slice(1);
  for (const b of blocks) {
    const name = b.match(/^[a-z_]+/)![0];
    const body = b.slice(0, b.indexOf(');'));
    if (/\b(user_id|viewer_id|trader_id)\b[^,]*references users/.test(body)) {
      assert.equal(SCHEMA_MAP[name]?.personal, true, name);
      assert.match(body, /references users[^,]*on delete (cascade|set null)/, `${name}: a user's rows go when the account is deleted`);
    }
  }
});
