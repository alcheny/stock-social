// F-36 fixture audit (AC4; plan Round 2 changes, R2-1): the PR's list of changed expectations comes from the test run's
// output, and every changed figure belongs to a trade with an entry fee above 0. Test-only: the matcher on disk is never
// changed; scripts/f36-audit-hook.ts rewrites its `returnPct:` line in memory in each test process.
//   node scripts/f36-audit.ts            (needs DATABASE_URL: the .db.test.ts files run too)
// Two runs of the whole suite (`node --test`, as `npm test`):
// 1. log: the shipped figure; every trade whose legacy figure (purchase cost alone) differs is listed. The run must pass,
//    and any `entryFee=no` line fails the audit.
// 2. legacy: the figure divided by the purchase cost alone; the tests that fail are the expectations F-36 changed.
// Each run must show the hook loaded (a `hook-loaded` line from lib/trades.test.ts), so a hook that didn't load can't
// pass as "nothing changed". Prints percents and yes/no only, never a fee amount.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const HOOK = new URL('./f36-audit-hook.ts', import.meta.url).href;

// A test reporter that prints each failed test (not todo) as `<file>\t<name>`, one per line.
const REPORTER = `export default async function* (source) {
  for await (const e of source) if (e.type === 'test:fail' && !e.data.todo && e.data.details?.type !== 'suite') yield \`fail\\t\${(e.data.file ?? '?').replace(${JSON.stringify(ROOT)}, '')}\\t\${e.data.name}\\n\`;
}`;

function run(mode: 'log' | 'legacy', dir: string): { status: number | null; lines: string[]; failed: string[] } {
  const log = join(dir, `${mode}.log`);
  writeFileSync(log, '');
  const reporter = join(dir, 'reporter.mjs');
  writeFileSync(reporter, REPORTER);
  const r = spawnSync(process.execPath, ['--test', `--test-reporter=${reporter}`, '--test-reporter-destination=stdout'], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28,
    env: { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import ${HOOK}`.trim(), F36_AUDIT_LOG: log, F36_AUDIT_MODE: mode },
  });
  const failed = [...new Set(r.stdout.split('\n').filter((l) => l.startsWith('fail\t')).map((l) => l.slice(5)))].sort();
  return { status: r.status, lines: readFileSync(log, 'utf8').split('\n').filter(Boolean), failed };
}

function main() {
  if (!process.env.DATABASE_URL) { console.error('f36 audit: DATABASE_URL is required (the .db.test.ts files must run)'); process.exit(2); }
  const dir = mkdtempSync(join(tmpdir(), 'f36-audit-'));
  try {
    const problems: string[] = [];
    const now = run('log', dir);
    if (!now.lines.includes('hook-loaded lib/trades.test.ts')) problems.push('log run: the hook did not load in lib/trades.test.ts');
    if (now.status !== 0) problems.push(`log run: the suite failed (${now.failed.length} tests): ${now.failed.join('; ')}`);
    const changed = [...new Set(now.lines.filter((l) => l.startsWith('f36-changed ')).map((l) => l.slice(12)))].sort();
    const noFee = changed.filter((l) => l.endsWith('entryFee=no'));
    if (noFee.length) problems.push(`${noFee.length} changed figures with no entry fee:\n  ${noFee.join('\n  ')}`);
    const legacy = run('legacy', dir);
    if (!legacy.lines.includes('hook-loaded lib/trades.test.ts')) problems.push('legacy run: the hook did not load in lib/trades.test.ts');
    // Every expectation that fails under the legacy figure is in a test file where a fee-bearing figure changed.
    const files = new Set(changed.map((l) => l.split(' ')[0]));
    const unexplained = legacy.failed.filter((f) => !files.has(f.split('\t')[0]));
    if (unexplained.length) problems.push(`tests that fail under the legacy figure with no fee-bearing change in their file:\n  ${unexplained.join('\n  ')}`);

    const perFile = new Map<string, number>();
    for (const l of changed) perFile.set(l.split(' ')[0], (perFile.get(l.split(' ')[0]) ?? 0) + 1);
    console.log('# F-36 fixture audit (node scripts/f36-audit.ts)');
    console.log('\n## Expectations that change (tests that fail with the legacy figure, purchase cost alone)');
    for (const f of legacy.failed) console.log(`- ${f.replace('\t', ': ')}`);
    console.log('\n## Changed figures per test file (every one with an entry fee above 0)');
    for (const [f, n] of [...perFile].sort()) console.log(`- ${f}: ${n} trades`);
    console.log(`\nTotal changed figures: ${changed.length}; with no entry fee: ${noFee.length}.`);
    console.log('\n## Changed figures (test file, symbol, sell id, legacy and new percent, entry fee yes/no)');
    for (const l of changed.filter((x) => (perFile.get(x.split(' ')[0]) ?? 0) <= 20)) console.log(`- ${l}`);
    console.log('(files with more than 20 changed figures are generated histories: counted above, not listed)');
    if (problems.length) { console.error(`\nf36 audit FAILED:\n${problems.join('\n')}`); process.exitCode = 1; }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
