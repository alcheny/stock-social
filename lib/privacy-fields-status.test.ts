// FIXES-LABELS (code review, POLICY P6): every column the record status line's loader (lib/record-status-load.ts) reads
// is classified in lib/privacy-fields.ts — a public field, a listed non-field or record state the status line shows — so
// a column added to that query can't reach a public page unnamed. The query is read from the source, not restated here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NOT_A_FIELD, PUBLIC_FIELDS, RECORD_STATE_FIELDS } from './privacy-fields.ts';
import { CONSENT_SCOPE_LINE } from './copy.ts';

const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8').replace(/--[^\n]*/g, '');
const tables = [...schema.matchAll(/create table if not exists ([a-z_]+) \(/g)].map((m) => m[1]);
function columns(table: string): string[] {
  const body = schema.split(new RegExp(`create table if not exists ${table} \\(`))[1].split(/\n\);/)[0];
  const cols = body.split('\n').map((l) => l.trim().match(/^([a-z_]+)\s+(?!key\b)/)?.[1]).filter((c): c is string => !!c && !['primary', 'unique', 'check', 'foreign'].includes(c));
  for (const m of schema.matchAll(new RegExp(`schema_add_column\\('${table}', '([a-z_]+)'`, 'g'))) cols.push(m[1]);
  return cols;
}

// The SQL of every sql`…` template in a source file, with interpolations, string literals and comments removed.
function queries(src: string): string[] {
  return [...src.matchAll(/\bsql`([\s\S]*?)`/g)].map((m) => m[1].replace(/\$\{[^}]*\}/g, ' ').replace(/--[^\n]*/g, ' ').replace(/'[^']*'/g, ' '));
}

const named = (q: string) => {
  const alias = new Map<string, string>();
  for (const m of q.matchAll(/\b(?:from|join)\s+([a-z_]+)(?:\s+([a-z_]+))?/g)) {
    if (!tables.includes(m[1])) continue;
    alias.set(m[1], m[1]);
    if (m[2] && !['on', 'where', 'left', 'join', 'group', 'order', 'cross', 'inner'].includes(m[2])) alias.set(m[2], m[1]);
  }
  return alias;
};
// Table columns a query reads: `alias.column` through its from/join aliases, and a bare word that is a column of a
// table named in the same CTE (or the final select). Over-counting is safe: it only asks for more classification.
export function columnsRead(q: string): Set<string> {
  const alias = named(q);
  const out = new Set<string>();
  for (const m of q.matchAll(/\b([a-z_]+)\.([a-z_]+)\b/g)) {
    const t = alias.get(m[1]);
    if (t && columns(t).includes(m[2])) out.add(`${t}.${m[2]}`);
  }
  for (const seg of q.split(/\bwith\s+[a-z_]+\s+as\s*\(|\)\s*,\s*[a-z_]+\s+as\s*\(|\)\s*select\b/)) {
    const here = [...new Set(named(seg).values())];
    for (const m of seg.matchAll(/(?<![.\w])([a-z_]+)\b(?!\s*\.)/g)) for (const t of here) if (columns(t).includes(m[1])) out.add(`${t}.${m[1]}`);
  }
  return out;
}

const classified = (col: string) =>
  PUBLIC_FIELDS.some((f) => f.columns.some((c) => c.split(' ')[0] === col)) || !!NOT_A_FIELD[col] || RECORD_STATE_FIELDS.some((f) => f.columns.includes(col));

test('every column the status line\'s loader reads is a public field, a listed non-field or record state', () => {
  const src = readFileSync(new URL('./record-status-load.ts', import.meta.url), 'utf8');
  const qs = queries(src);
  assert.ok(qs.length >= 1, 'the loader has a query');
  const read = new Set(qs.flatMap((q) => [...columnsRead(q)]));
  // The parser sees the three record-state dates the status line prints (the reason this test exists).
  for (const col of ['users.last_synced_at', 'connections.disconnected_at', 'broker_accounts.removed_at', 'closed_trades.opened_at', 'closed_trades.closed_at']) assert.ok(read.has(col), `${col} is read`);
  for (const col of read) assert.ok(classified(col), `${col} (read by lib/record-status-load.ts) is not classified in lib/privacy-fields.ts`);
});

test('the parser resolves aliases and ignores literals, interpolations and comments', () => {
  const got = columnsRead(queries("sql`select u.last_synced_at, x.a->>'removed_at' from users u -- broker_accounts.removed_at\n where u.id = ${id}`")[0]);
  assert.deepEqual([...got].sort(), ['users.id', 'users.last_synced_at']);
});

test('record state fields: real columns, each with the owner-copy reason; none of them is claimed by the consent line yet', () => {
  assert.deepEqual(RECORD_STATE_FIELDS.flatMap((f) => f.columns).slice(0, 3), ['users.last_synced_at', 'connections.disconnected_at', 'broker_accounts.removed_at']);
  for (const f of RECORD_STATE_FIELDS) {
    assert.match(f.reason, /TR-5/);
    assert.match(f.reason, /POLICY P6/);
    assert.match(f.reason, /owner copy/);
    for (const col of f.columns) {
      const [t, c] = col.split('.');
      assert.ok(columns(t).includes(c), `${col} does not exist`);
      assert.ok(!PUBLIC_FIELDS.some((p) => p.columns.includes(col)), `${col} is not also a public field`);
    }
  }
  // Until the owner adds them, the consent line does not name these dates; the ponytail beside it says so.
  assert.doesNotMatch(CONSENT_SCOPE_LINE, /disconnect(ed)? date|account removed|last update/i);
  const copy = readFileSync(new URL('./copy.ts', import.meta.url), 'utf8');
  const at = copy.indexOf('export const CONSENT_SCOPE_LINE');
  assert.match(copy.slice(Math.max(0, at - 600), at), /ponytail:[\s\S]*connection status dates \(last update, disconnected, account removed\)/);
});
