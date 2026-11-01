// OPTIONS AC 15 and D5 (docs/features/logs/options/plan.md): the global gate from the owner's scope line, the per-trader
// consent versions, and each option column in exactly one privacy map.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { CONSENT_SCOPE_LINE } from './copy.ts';
import { GATED_COLUMNS, NOT_A_FIELD, PRIVATE_FIELDS, PUBLIC_FIELDS, scopeLineFromFields } from './privacy-fields.ts';
import { consentCoversOptions, OPTION_PUBLIC_COLUMNS, optionsPublic } from './options-gate.ts';
import { CONSENT_VERSIONS, consentHash, CURRENT_CONSENT_HASH, versionFor } from './consent-versions.ts';

const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8').replace(/--[^\n]*/g, '');
function columns(table: string): string[] {
  const body = schema.split(new RegExp(`create table if not exists ${table} \\(`))[1].split(/\n\);/)[0];
  const cols = body.split('\n').map((l) => l.trim().match(/^([a-z_]+)\s+(?!key\b)/)?.[1]).filter((c): c is string => !!c && !['primary', 'unique', 'check', 'foreign'].includes(c));
  for (const m of schema.matchAll(new RegExp(`schema_add_column\\('${table}', '([a-z_]+)'`, 'g'))) cols.push(m[1]);
  return cols;
}

test('AC15: optionsPublic() is false with today\'s PUBLIC_FIELDS and true with a list naming every option column', () => {
  assert.equal(optionsPublic(), false);
  assert.equal(optionsPublic(PUBLIC_FIELDS), false);
  assert.equal(optionsPublic([...PUBLIC_FIELDS, { words: 'for options, call or put, expiry date and percent return on the premium paid', columns: [...OPTION_PUBLIC_COLUMNS] }]), true);
  // One column short is still closed.
  assert.equal(optionsPublic([...PUBLIC_FIELDS, { words: 'x', columns: OPTION_PUBLIC_COLUMNS.slice(1) }]), false);
  // The line the consent screen shows is still the owner's, unchanged by this work.
  assert.equal(scopeLineFromFields(), CONSENT_SCOPE_LINE);
});

test('AC15: every column of the option tables is in exactly one of PUBLIC_FIELDS, PRIVATE_FIELDS, NOT_A_FIELD or GATED_COLUMNS', () => {
  const pub = new Set(PUBLIC_FIELDS.flatMap((f) => f.columns)), priv = new Set(PRIVATE_FIELDS.flatMap((f) => f.columns));
  for (const table of ['option_trades', 'open_option_positions']) {
    for (const c of columns(table)) {
      const col = `${table}.${c}`;
      const homes = [pub.has(col), priv.has(col), col in NOT_A_FIELD, GATED_COLUMNS.includes(col)].filter(Boolean).length;
      assert.equal(homes, 1, `${col} is in ${homes} privacy maps`);
    }
    // Quantities, prices and fees exist only in the raw tables (closed_trades' rule, for the derived option tables).
    assert.deepEqual(columns(table).filter((c) => /^(units|price|fee|qty|quantity|amount|value|strike|strike_milli|premium|occ_ticker|multiplier)$/.test(c)), [], table);
  }
  for (const c of OPTION_PUBLIC_COLUMNS) {
    assert.ok(GATED_COLUMNS.includes(c), `${c} gated`);
    const [t, col] = c.split('.');
    assert.ok(columns(t).includes(col), `${c} exists`);
  }
  assert.deepEqual([...GATED_COLUMNS].sort(), [...OPTION_PUBLIC_COLUMNS].sort());
  for (const col of ['option_activities.units', 'option_activities.price', 'option_activities.strike_milli', 'option_activities.fee', 'option_activities.account_id']) assert.ok(priv.has(col), col);
});

test('D5 consent versions: append-only, pinned hashes, the last entry is the current line with the columns of PUBLIC_FIELDS', () => {
  // Pinned: an edit to any entry's line changes its hash and fails here. Add new lines as new entries at the end.
  const PINNED = ['394354bb4b4e37e1a2aa33890f8a8ffc764b2f8fb05a31262da510e16f157a6d'];
  assert.ok(CONSENT_VERSIONS.length >= PINNED.length);
  PINNED.forEach((h, i) => assert.equal(consentHash(CONSENT_VERSIONS[i].line), h, `entry ${i}`));
  for (const v of CONSENT_VERSIONS) assert.equal(consentHash(v.line), createHash('sha256').update(v.line).digest('hex'));
  const last = CONSENT_VERSIONS[CONSENT_VERSIONS.length - 1];
  assert.equal(last.line, CONSENT_SCOPE_LINE);
  assert.deepEqual([...last.publicColumns], PUBLIC_FIELDS.flatMap((f) => f.columns));
  assert.equal(CURRENT_CONSENT_HASH, consentHash(CONSENT_SCOPE_LINE));
  assert.equal(new Set(CONSENT_VERSIONS.map((v) => consentHash(v.line))).size, CONSENT_VERSIONS.length);
});

test('D5 consentCoversOptions: unknown, null and every current hash are false; a hash whose entry names every option column is true', () => {
  assert.equal(consentCoversOptions(null), false);
  assert.equal(consentCoversOptions(undefined), false);
  assert.equal(consentCoversOptions('deadbeef'), false);
  assert.equal(consentCoversOptions(CURRENT_CONSENT_HASH), false);
  assert.equal(versionFor(CURRENT_CONSENT_HASH)?.line, CONSENT_SCOPE_LINE);
  // A future entry naming the option columns opens it (simulated without editing the list).
  const future = { line: 'future line', publicColumns: [...PUBLIC_FIELDS.flatMap((f) => f.columns), ...OPTION_PUBLIC_COLUMNS] };
  (CONSENT_VERSIONS as { line: string; publicColumns: readonly string[] }[]).push(future);
  try { assert.equal(consentCoversOptions(consentHash('future line')), true); } finally { (CONSENT_VERSIONS as unknown[]).pop(); }
});

test('AC15: the gate reads no environment variable or flag', () => {
  for (const f of ['options-gate.ts', 'consent-versions.ts', 'options-load.ts']) {
    const src = readFileSync(new URL(`./${f}`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /process\.env|import\.meta\.env/, f);
  }
});
