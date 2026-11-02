// OD 2.17 (owner decision 2026-11-02, accepted): the static side of retired handles. Pure: no database.
// - changeHandle and deleteProfile store the hold's end through one fragment (lib/handles.ts#holdUntil), keep a retired
//   row retired, and keep retired rows out of the one-hold cap and the take-back's end.
// - The owner's rename hint says the old handle is retired (not held for a year) for a connected record.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HANDLE_REASON, RENAME_RETIRE, RENAME_RULE_RETIRED } from './handles.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

test('OD 2.17: the hold end is one fragment: infinity for a connected record (source snaptrade), else 365 days', () => {
  const h = code(read('lib/handles.ts'));
  assert.match(h, /export const holdUntil = \(db: Db, userId: number\) => db`case when exists \(select 1 from activities where user_id = \$\{userId\} and source = 'snaptrade'\)\s*then 'infinity'::timestamptz else now\(\) \+ \$\{HANDLE_RESERVED_DAYS\} \* interval '1 day' end`/);
  for (const f of ['lib/auth/attempts.ts', 'lib/delete.ts']) {
    const s = code(read(f));
    assert.match(s, /insert into handle_reservations \(handle, until[^)]*\) values \([^)]*\$\{holdUntil\(tx, (userId|u\.id)\)\}/, f);
    assert.match(s, /until = case when handle_reservations\.until = 'infinity' then handle_reservations\.until else excluded\.until end/, f);
  }
  const c = code(read('lib/auth/attempts.ts'));
  assert.match(c, /update handle_reservations set until = now\(\) where handle = \$\{handle\} and user_id = \$\{userId\} and until > now\(\) and until <> 'infinity'/);
  assert.match(c, /where user_id = \$\{userId\} and until > now\(\) and until <> 'infinity' order by until desc, handle offset \$\{RENAME_HOLD_CAP\}/);
  // The purge removes only ended holds; infinity never is one.
  assert.match(code(read('lib/privacy-purge.ts')), /delete from handle_reservations where handle in \(\s*select handle from handle_reservations where until <= \$\{now\}/);
});

test('OD 2.17: the owner\'s rename hint for a connected record says the old handle is retired and can be taken back', () => {
  assert.equal(RENAME_RULE_RETIRED, `${HANDLE_REASON.soon} ${RENAME_RETIRE}`);
  assert.doesNotMatch(RENAME_RETIRE, /a year|releases|\b301\b|redirect|report|review/i);
  assert.match(RENAME_RETIRE, /never given to anyone else/);
  const page = code(read('app/u/[handle]/page.tsx'));
  assert.match(page, /const retires = isMe && await retiresHandle\(user\.id\);/);
  assert.match(page, /\{retires\s*\? <p className="muted small rename-rule" data-rename-rule>\{soonError \? RENAME_RETIRE : <>\{RENAME_RULE_RETIRED\}\{renameSoon && ` \$\{renameSoon\}`\}<\/>\}<\/p>/);
});
