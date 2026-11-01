// F-16 engineer B (plan docs/features/logs/F-16-F-17/plan.md §5.3, §5.5, §5.6, §5.8; v2 B2, E6, E9, E10): source and
// copy checks for reports, hide, digest and the runbook. One named test per acceptance criterion. No database.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { HIDDEN_LINE, HIDDEN_RULE, PROFILE_REPORT_COPY, REPORT_CATEGORY_CODES, heldLine } from './report-copy.ts';
import { HIDE_KINDS, HIDE_REASONS, UNHIDE_REASONS } from './trust-hide.ts';
import { MARKS, MINORS, scanText } from '../scripts/compliance.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
// Code only: line and block comments removed.
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(join(ROOT, dir))) {
    const p = `${dir}/${n}`;
    if (n === 'node_modules' || n.startsWith('.')) continue;
    if (statSync(join(ROOT, p)).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(n)) out.push(p);
  }
  return out;
}
const SOURCES = [...walk('app'), ...walk('lib'), ...walk('scripts')].filter((p) => !/\.test\.tsx?$/.test(p));
const HIDE_FILES = ['lib/trust-hide.ts', 'lib/trust-hide-reasons.ts', 'scripts/hide.ts'];

test('B2: the hidden thesis line names no report or review, and heldLine(HIDDEN_RULE) is it', () => {
  assert.equal(heldLine(HIDDEN_RULE), HIDDEN_LINE);
  assert.doesNotMatch(heldLine(HIDDEN_RULE), /report|review/i);
  assert.equal(HIDDEN_LINE, 'This thesis is not shown to others right now. Only you can see it.');
});

test('hide kinds are only a whole profile or a thesis; reasons are fixed codes', () => {
  assert.deepEqual([...HIDE_KINDS], ['profile', 'thesis']);
  assert.deepEqual(HIDE_REASONS.slice(0, REPORT_CATEGORY_CODES.length), [...REPORT_CATEGORY_CODES]);
  assert.ok(HIDE_REASONS.includes('legal-notice'));
  assert.deepEqual([...UNHIDE_REASONS], ['report-unfounded', 'issue-resolved', 'hidden-by-mistake']);
  for (const r of [...HIDE_REASONS, ...UNHIDE_REASONS]) assert.match(r, /^[a-z0-9-]+$/);
});

test('hide and unhide never delete: no delete from, truncate or lib/delete.ts in the hide files', () => {
  for (const f of HIDE_FILES) {
    const s = code(f);
    assert.doesNotMatch(s, /delete\s+from|\btruncate\b|\bdrop\s+(table|column)/i, f);
    assert.doesNotMatch(s, /from '[^']*delete\.ts'/, f);
    assert.doesNotMatch(s, /\b(activities|insertActivities|rebuildTrades|rebuildRecord)\b/, `${f} touches no trade`);
    assert.doesNotMatch(s, /set\s+thesis\s*=|thesis\s*=\s*null/i, `${f} never changes a thesis text`);
  }
});

test('the hide is owner-run only: no app route, action or page imports lib/trust-hide.ts; the script never reads a session', () => {
  for (const f of SOURCES.filter((p) => p.startsWith('app/'))) assert.doesNotMatch(read(f), /trust-hide(\.ts)?'/, f);
  for (const f of [...HIDE_FILES, 'lib/trust-digest.ts', 'scripts/trust-digest.ts']) {
    const s = code(f);
    assert.doesNotMatch(s, /session\.ts'|next\/headers|currentUser|cookies\(/, `${f} never reads a session`);
  }
  // The actor is a CLI flag or env, a role word (never a name or address).
  assert.match(read('scripts/hide.ts'), /--actor=/);
  assert.match(read('scripts/hide.ts'), /TRUST_ACTOR/);
});

test('the audit row is written in the same transaction as the change, and carries no thesis text', () => {
  const s = code('lib/trust-hide.ts');
  const fns = s.split(/export async function /).slice(1).filter((b) => /^(hide|unhide)(Profile|Thesis)\(/.test(b));
  assert.equal(fns.length, 4);
  for (const b of fns) {
    assert.match(b, /sql\.begin\(async \(tx\)/);
    assert.match(b, /deps\.audit\(tx,/);
  }
  const insert = /insert into trust_audit \(([^)]*)\)/.exec(s);
  assert.ok(insert);
  assert.deepEqual(insert[1].split(',').map((c) => c.trim()), ['kind', 'user_id', 'sell_id', 'action', 'reason', 'actor']);
  // The table has no free-text column (db/schema.sql).
  const table = /create table if not exists trust_audit \(([\s\S]*?)\n\);/.exec(read('db/schema.sql'));
  assert.ok(table);
  const cols = table[1].split('\n').map((l) => l.replace(/--.*$/, '').trim()).filter(Boolean).map((l) => l.split(/\s+/)[0]);
  assert.deepEqual(cols, ['id', 'kind', 'user_id', 'sell_id', 'action', 'reason', 'actor', 'at']);
});

test('reporter identity: thesis_reports appears only in the report, review, save, digest and privacy files', () => {
  const allowed = new Set(['lib/reports.ts', 'lib/thesis-review.ts', 'lib/thesis-save.ts', 'lib/trust-digest.ts', 'lib/privacy-retention.ts', 'lib/report-copy.ts']);
  const found = SOURCES.filter((f) => /\bthesis_reports\b/.test(read(f)));
  for (const f of found) assert.ok(allowed.has(f), `${f} must not read thesis_reports (reporter identity stays with the owner)`);
  // lib/report-copy.ts is client-safe copy and names the table only in a comment.
  assert.doesNotMatch(code('lib/report-copy.ts'), /\bthesis_reports\b/);
  // The trader's own export never reads it.
  assert.doesNotMatch(read('lib/record-tools.ts'), /thesis_reports|reporter/);
});

test('E9: no new index for reports; E10: the target is looked up before the advisory lock', () => {
  const block = read('db/schema.sql').split('-- ---- F-16 (docs/features/F-16-trust-and-safety-slice.md)')[1].split('-- end F-16 / F-17')[0];
  assert.doesNotMatch(block, /on thesis_reports/);
  const s = code('lib/reports.ts');
  const body = s.slice(s.indexOf('export async function reportProfile'));
  const look = body.indexOf('from users u where u.handle');
  const lock = body.indexOf('pg_advisory_xact_lock');
  assert.ok(look > 0 && lock > look, 'lookup, then lock');
  assert.ok(body.indexOf("'own'") > lock && body.indexOf('insert into thesis_reports') > lock);
});

test('a profile report never hides: reportProfile writes only its report row', () => {
  const s = code('lib/reports.ts');
  const body = s.slice(s.indexOf('export async function reportProfile'), s.indexOf('export function profileReportState'));
  assert.doesNotMatch(body, /update\s+(users|closed_trades|kept_theses)|hidden_at|thesis_status/i);
  assert.equal((body.match(/insert into/g) ?? []).length, 1);
  // F-9's auto-hold stays theses-only: REPORT_HOLD_AT is not read by the profile path.
  assert.doesNotMatch(body, /REPORT_HOLD_AT/);
});

test('the server action: use server, reads the signed-in user like reportNote, returns PROFILE_REPORT_COPY messages', () => {
  const s = read('app/report-actions.ts');
  assert.match(s, /^'use server';/);
  assert.match(s, /export async function reportProfileAction\(_prev: ProfileReportState, formData: FormData\): Promise<ProfileReportState>/);
  assert.match(s, /currentUser\(\)/);
  assert.match(s, /submitProfileReport\(user\?\.id \?\? null, formData\)/);
  assert.match(s, /PROFILE_REPORT_COPY\.failed/);
  // Only async functions are exported from a 'use server' file.
  for (const m of s.matchAll(/^export\s+(\w+)/gm)) assert.equal(m[1], 'async');
});

test('the digest is a script: no digest route exists, no email sender or fetch in the trust files', () => {
  const routes = walk('app').filter((p) => /digest/i.test(p));
  assert.deepEqual(routes, []);
  for (const f of ['lib/trust-digest.ts', 'scripts/trust-digest.ts', 'lib/trust-hide.ts', 'scripts/hide.ts']) {
    const s = code(f);
    assert.doesNotMatch(s, /auth\/email\.ts|\bfetch\(|nodemailer|sendMail|smtp/i, f);
  }
});

test('report copy and categories: no third-party mark, no age-group word, no skill judgement', () => {
  const texts = [...Object.values(PROFILE_REPORT_COPY).map((v) => (typeof v === 'function' ? v('handle') : v))];
  for (const t of texts) {
    for (const m of MARKS) assert.doesNotMatch(t.toLowerCase(), new RegExp(`\\b${m}\\b`), t);
    for (const m of MINORS) assert.doesNotMatch(t, new RegExp(`\\b${m}\\b`, 'i'), t);
    assert.doesNotMatch(t, /skill|fake|edge|signal/i, t);
  }
});

test('runbook: no secrets or personal data, no instruction to delete, replay is owner only, breach items to check', () => {
  const p = 'docs/security/trust-and-safety-runbook.md';
  assert.ok(existsSync(join(ROOT, p)));
  const s = read(p);
  assert.deepEqual(scanText(p, s), []);
  assert.doesNotMatch(s, /delete from|drop (table|schema|database)|truncate|rm -rf/i);
  for (const line of s.split('\n')) {
    if (/\b(agent|claude|bot)s?\b/i.test(line)) assert.doesNotMatch(line, /delet|purg|drop/i, line);
  }
  assert.match(s, /^## 5\. Restore from a backup, with deletion replay \(Owner only\)$/m);
  for (const need of [/scripts\/hide\.ts profile/, /scripts\/hide\.ts unhide-profile/, /scripts\/hide\.ts thesis/, /scripts\/hide\.ts unhide-thesis/,
    /30 days/, /500 or more consumers/, /State breach-notification/, /rotate the credential/i, /items to check/i, /May be under 18/]) assert.match(s, need);
  assert.doesNotMatch(s, /@[a-z0-9-]+\.[a-z]{2,}/i, 'no email address');
  assert.doesNotMatch(s, /\/home\/|\/Users\//, 'no home path');
});
