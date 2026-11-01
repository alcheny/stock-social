// F-16 profile reports (plan docs/features/logs/F-16-F-17/plan.md §5.5, AC-F16 #4, #5): the outcomes the form shows,
// signed out refused before any read, F-9's one reports table. No database.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PROFILE_REPORT_COPY, PROFILE_REPORT_STATES } from './report-copy.ts';
import { PROFILE_REPORTS_PER_DAY, PROFILE_REPORTS_PER_TARGET_HOUR, REPORT_TARGETS, RESOLUTIONS, profileReportState, reportProfile, submitProfileReport } from './reports.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const form = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });
const never = { allow: () => { throw new Error('the limiter is never reached'); } };

test('signed out: reportProfile and the action body answer signed-out before anything is read', async () => {
  assert.equal(await reportProfile(null, 'someone', 'abusive', never), 'signed-out');
  assert.equal(await reportProfile(undefined, 'someone', 'abusive', never), 'signed-out');
  assert.deepEqual(await submitProfileReport(null, form({ handle: 'someone', category: 'abusive' }), never), { state: 'signed-out', message: PROFILE_REPORT_COPY.signedOut });
});

test('invalid input is refused before any read: a bad handle, a missing or unknown category', async () => {
  assert.equal(await reportProfile(1, 'x; drop', 'abusive', never), 'invalid');
  assert.equal(await reportProfile(1, 'someone', 'other', never), 'invalid');
  assert.equal(await reportProfile(1, 'someone', null, never), 'invalid');
  assert.deepEqual(await submitProfileReport(1, form({ handle: 'someone' }), never), { state: 'invalid', message: PROFILE_REPORT_COPY.noCategory, field: 'category' });
  assert.deepEqual(await submitProfileReport(1, form({ handle: '??', category: 'abusive' }), never), { state: 'invalid', message: PROFILE_REPORT_COPY.failed });
});

test('every outcome maps to one of the seam states and a PROFILE_REPORT_COPY message', () => {
  const c = PROFILE_REPORT_COPY;
  assert.deepEqual(profileReportState('reported'), { state: 'sent', message: c.done });
  assert.deepEqual(profileReportState('already'), { state: 'already', message: c.already });
  assert.deepEqual(profileReportState('rate'), { state: 'rate', message: c.rate });
  assert.deepEqual(profileReportState('signed-out'), { state: 'signed-out', message: c.signedOut });
  assert.deepEqual(profileReportState('own'), { state: 'invalid', message: c.own });
  assert.deepEqual(profileReportState('not-found', 'abusive'), { state: 'invalid', message: c.failed });
  const messages = new Set<string>((Object.values(c) as unknown[]).filter((v): v is string => typeof v === "string"));
  for (const o of ['reported', 'already', 'rate', 'signed-out', 'own', 'not-found', 'invalid'] as const) {
    const s = profileReportState(o, 'abusive');
    assert.ok(['sent', 'already', 'rate', 'signed-out', 'invalid', 'error'].includes(s.state), o);
    assert.ok(PROFILE_REPORT_STATES.includes(s.state as never), o);
    assert.ok(messages.has(s.message), o);
  }
  // One rate wording for the per-reporter and per-target limits, so a target's volume never leaks.
  assert.equal(c.rate, 'Too many reports right now. Try again later.');
});

test('the limits and the stored codes', () => {
  assert.equal(PROFILE_REPORTS_PER_DAY, 5);
  assert.equal(PROFILE_REPORTS_PER_TARGET_HOUR, 10);
  assert.deepEqual([...REPORT_TARGETS], ['thesis', 'profile']);
  assert.deepEqual([...RESOLUTIONS], ['founded', 'unfounded']);
});

test('F-9\'s one reports table: exactly one report table in the schema, and only lib/reports.ts inserts into it', () => {
  const schema = readFileSync(join(ROOT, 'db/schema.sql'), 'utf8');
  const tables = [...schema.matchAll(/create table if not exists (\w+)/g)].map((m) => m[1]).filter((t) => /report/.test(t));
  assert.deepEqual(tables, ['thesis_reports']);
  const files: string[] = [];
  const walk = (d: string) => {
    for (const n of readdirSync(join(ROOT, d))) {
      const p = `${d}/${n}`;
      if (n === 'node_modules' || n.startsWith('.')) continue;
      if (statSync(join(ROOT, p)).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n)) files.push(p);
    }
  };
  for (const d of ['app', 'lib', 'scripts']) walk(d);
  const inserters = files.filter((f) => /insert into \w*report/i.test(readFileSync(join(ROOT, f), 'utf8')));
  assert.deepEqual(inserters, ['lib/reports.ts']);
});
