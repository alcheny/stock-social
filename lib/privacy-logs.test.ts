// Privacy work (2026-11-01), log hygiene: no personal data in server logs (POLICY P3, P6). Every console call in server
// code (any app/ or lib/ file that is not a 'use client' component, and instrumentation.ts) may pass only string
// literals, numeric ids and statuses, counts serialized with JSON.stringify, and an error reduced by logSafe/errStatus.
// Never an error object or its message, an email, a handle, an account id, a vendor id or secret, a thesis or a payload.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { logSafe } from './privacy-log.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const sources = (dir: string): string[] => readdirSync(join(root, dir)).flatMap((f) => {
  const p = join(root, dir, f);
  return statSync(p).isDirectory() ? sources(relative(root, p)) : /\.tsx?$/.test(f) && !/\.test\.ts$/.test(f) ? [relative(root, p)] : [];
});
const server = () => [...sources('app'), ...sources('lib'), 'instrumentation.ts']
  .filter((f) => !/^\s*(\/\/[^\n]*\n\s*)*['"]use client['"]/.test(readFileSync(join(root, f), 'utf8')));

// The argument list of each console call, split at top-level commas.
export function consoleCalls(src: string): string[][] {
  const out: string[][] = [];
  for (const m of src.matchAll(/console\.(log|error|warn|info|debug|trace)\s*\(/g)) {
    let depth = 1, i = m.index! + m[0].length, cur = '', quote = '';
    const args: string[] = [];
    for (; i < src.length && depth > 0; i++) {
      const ch = src[i];
      if (quote) { cur += ch; if (ch === '\\') { cur += src[++i]; continue; } if (ch === quote) quote = ''; continue; }
      if (ch === "'" || ch === '"' || ch === '`') { quote = ch; cur += ch; continue; }
      if ('([{'.includes(ch)) depth++;
      if (')]}'.includes(ch)) depth--;
      if (depth === 0) break;
      if (ch === ',' && depth === 1) { args.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    if (cur.trim()) args.push(cur.trim());
    out.push(args);
  }
  return out;
}

const FORBIDDEN = /\b(email|e?mail_?address|handle|display_name|account_?id|accountId|snaptrade\w*|secret\w*|raw|payload|thesis|token\w*|message|stack|body|name|subject|ip)\b/i;
const ALLOWED = [
  /^'[^'\n]*'$/, /^"[^"\n]*"$/, /^`[^`$\n]*`$/,                       // plain text
  /^\d+$/,                                                          // a number
  /^(?:[a-z]\w*\.)?(?:id|status|n|left|count)$/,                    // a numeric id, status or count
  /^(?:Number|String)\((?:[a-z]\w*\.)?id\)$/,
  /^(?:logSafe|errStatus)\(\w+\)$/,                                 // an error reduced to its class, status and code
  /^JSON\.stringify\([\s\S]*\)$/,                                   // a report object (its keys are checked below)
];
export function unsafeArgs(args: string[]): string[] {
  return args.filter((a) => {
    if (a.startsWith("'") || a.startsWith('"') || a.startsWith('`')) return !ALLOWED.some((r) => r.test(a));
    const bare = a.replace(/\/\/[^\n]*/g, '');
    return FORBIDDEN.test(bare) || !ALLOWED.some((r) => r.test(bare));
  });
}

test('the scanner flags raw errors, messages and personal fields, and passes ids, counts and reduced errors', () => {
  const bad = ["console.error('x', e)", "console.error('x', e.message)", "console.error('x', e instanceof Error ? e.message : e)", "console.log('x', user.email)",
    "console.log('x', u.handle, u.id)", "console.log('x', JSON.stringify({ account_id: a }))", "console.log(`x ${email}`)", "console.warn('x', err)"];
  for (const s of bad) assert.ok(consoleCalls(s).some((a) => unsafeArgs(a).length > 0), s);
  const good = ["console.error('sync failed', u.id, logSafe(e))", "console.error('import step deferred', id, status)", "console.error('x', r.id, errStatus(e))",
    "console.log('tick', JSON.stringify({ ok, failed: failed.length }))", "console.log('plain')"];
  for (const s of good) assert.deepEqual(consoleCalls(s).flatMap(unsafeArgs), [], s);
});

test('no console call in server code passes personal data or an unreduced error (lib/sync.ts and app/t/[symbol]/Watch.tsx first)', () => {
  const files = server();
  assert.ok(files.includes('lib/sync.ts') && files.includes('app/t/[symbol]/Watch.tsx'));
  const found: string[] = [];
  for (const f of files) for (const args of consoleCalls(readFileSync(join(root, f), 'utf8'))) {
    const bad = unsafeArgs(args);
    if (bad.length) found.push(`${f}: ${bad.join(' | ')}`);
  }
  assert.deepEqual(found, []);
});

test('logSafe keeps the class, a numeric status and a short code, never the message', () => {
  class VendorError extends Error { status = 503; }
  const e = Object.assign(new Error('user someone@example.test account 12345678 failed'), { code: '23505' });
  assert.equal(logSafe(e), 'Error code 23505');
  assert.equal(logSafe(new VendorError('acct 999 for someone@example.test')), 'VendorError status 503');
  assert.equal(logSafe({ response: { status: 404 }, message: 'x@y.test' }), 'object status 404');
  assert.equal(logSafe(Object.assign(new Error('x'), { code: 'not a code: x@y.test' })), 'Error');
  assert.equal(logSafe('someone@example.test'), 'string');
  assert.equal(logSafe(null), 'object');
  for (const v of [e, new VendorError('a@b.test')]) assert.doesNotMatch(logSafe(v), /@|\d{6,}/);
});
