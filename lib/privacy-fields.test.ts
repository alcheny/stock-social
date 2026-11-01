// Privacy work (2026-11-01): the public profile's fields equal the consent line (lib/privacy-fields.ts, CONSENT.lines).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONSENT, CONSENT_SCOPE_LINE } from './copy.ts';
import { NOT_A_FIELD, PRIVATE_FIELDS, PUBLIC_FIELDS, scopeLineFromFields } from './privacy-fields.ts';

const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8').replace(/--[^\n]*/g, '');
// Columns of a table: its create-table body plus every schema_add_column on it.
function columns(table: string): string[] {
  const body = schema.split(new RegExp(`create table if not exists ${table} \\(`))[1].split(/\n\);/)[0];
  const cols = body.split('\n').map((l) => l.trim().match(/^([a-z_]+)\s+(?!key\b)/)?.[1]).filter((c): c is string => !!c && !['primary', 'unique', 'check', 'foreign'].includes(c));
  for (const m of schema.matchAll(new RegExp(`schema_add_column\\('${table}', '([a-z_]+)'`, 'g'))) cols.push(m[1]);
  return cols;
}

test('the consent screen shows the owner\'s scope line, and it is exactly the public and private field lists', () => {
  assert.equal(CONSENT_SCOPE_LINE, 'Public: percent returns, symbols, dates, holding periods, institution names, account count, and your current open positions with unrealized percent. Private: quantities, prices, fees and account numbers. Your public record is also used to describe your trading style and to order traders for readers.');
  assert.equal(scopeLineFromFields(), CONSENT_SCOPE_LINE);
  const lines = CONSENT.lines(2, 1);
  assert.ok(lines.includes(CONSENT_SCOPE_LINE));
  assert.equal(lines.filter((l) => /^Public:/.test(l)).length, 1);
  // P6: the connect step still says the record stays public after disconnect, and the account count.
  assert.ok(lines.includes('Your record stays public if you disconnect; deleting your profile removes it.'));
  assert.equal(lines[1], '2 accounts found (1 simulated, not imported)');
});

test('every column of the publicly read record tables is a public field or a listed non-field; private fields live only where nothing public reads them', () => {
  for (const table of ['closed_trades', 'open_positions']) {
    for (const c of columns(table)) {
      const col = `${table}.${c}`;
      const isPublic = PUBLIC_FIELDS.some((f) => f.columns.includes(col));
      const isPrivate = PRIVATE_FIELDS.some((f) => f.columns.includes(col));
      assert.ok(isPublic || isPrivate || NOT_A_FIELD[col], `${col} is not classified in lib/privacy-fields.ts`);
    }
  }
  for (const f of [...PUBLIC_FIELDS, ...PRIVATE_FIELDS]) for (const col of f.columns) {
    const [t, c] = col.split(' ')[0].split('.');
    assert.ok(columns(t).includes(c), `${col} does not exist`);
  }
  // Quantities, prices and fees exist only in the raw activities table (DESIGN: closed_trades stores none).
  for (const table of ['closed_trades', 'open_positions', 'display_log']) {
    assert.deepEqual(columns(table).filter((c) => /^(units|price|fee|qty|quantity|amount|value)$/.test(c)), [], table);
  }
});

test('the public profile never renders a vendor account id (positions are labelled "account N")', () => {
  const page = readFileSync(new URL('../app/u/[handle]/page.tsx', import.meta.url), 'utf8');
  const jsx = page.slice(page.indexOf('return ('));
  assert.doesNotMatch(jsx, /account_id|accountId/);
});
