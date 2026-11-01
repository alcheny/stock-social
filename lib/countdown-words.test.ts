// OPTIONS fix round 1 (QA 10, plan AC 20): no countdown words in any string literal of app/ or lib/ (tests excluded):
// an option's expiry is an absolute date, never "expiring", "days left" or "expires in".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
function files(dir: string): string[] {
  const out: string[] = [];
  for (const f of readdirSync(join(root, dir))) {
    const p = join(dir, f);
    if (statSync(join(root, p)).isDirectory()) out.push(...files(p));
    else if (/\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f)) out.push(p);
  }
  return out;
}
// String literals: '…', "…", `…` (template text) and JSX text between tags.
const LITERALS = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`|>[^<>{}]+</g;
const COUNTDOWN = /\b(expiring|days? left|expires? in)\b/i;

test('QA 10: no string literal in app/ or lib/ uses a countdown word', () => {
  let scanned = 0;
  for (const f of [...files('app'), ...files('lib')]) {
    const src = readFileSync(join(root, f), 'utf8').replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of src.matchAll(LITERALS)) { scanned++; assert.doesNotMatch(m[0], COUNTDOWN, `${f}: ${m[0]}`); }
  }
  assert.ok(scanned > 1000); // the scan reads the whole tree
  // The pattern catches what it should.
  for (const bad of ["'expiring soon'", '`3 days left`', '"expires in 2 days"']) assert.match(bad, COUNTDOWN);
});
