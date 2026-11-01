// CI's e2e shards (.github/workflows/ci.yml → e2e). Playwright's own --shard balances by test count, and the slow
// tests sit together in a few files, so its slices came out uneven (one shard 203 s of 480 s at N=4). This splits the
// suite into N contiguous slices of about equal estimated time instead and writes the slice as a --test-list file.
//
// Exactly once, by construction: every shard reads the same `playwright test --list --reporter=json` of the same
// commit, and `partition` is a pure function that cuts that one ordered list into disjoint, covering, contiguous
// slices (tested in e2e-shard.test.ts). The weights only move the cut points; they never decide whether a test runs.
// Contiguous slices keep each file's tests in declaration order, as Playwright's own sharding does.
//
//   npx playwright test --list --reporter=json > list.json
//   node scripts/e2e-shard.ts list.json <shard> <of> > shard.txt   # prints the slice; its size goes to stderr
//   npx playwright test --workers=1 --test-list shard.txt
import { readFileSync } from 'node:fs';

export type ListedTest = { file: string; titles: string[] };

// Seconds per test, measured per file on CI (run of 2026-10-26, 2 workers). Rough is fine: they only balance.
// Keyed as Playwright names files: relative to the test directory (e2e/), which is also what --test-list expects.
export const WEIGHTS: Record<string, number> = {
  'app.spec.ts': 2, 'connect.spec.ts': 5.8, 'follow.spec.ts': 6.8, 'likes.spec.ts': 6.2,
  'section.spec.ts': 6.7, 'signin.spec.ts': 0.75, 'similar.spec.ts': 13,
};
export const DEFAULT_WEIGHT = 4; // a new spec file, until its weight is measured

type Suite = { title: string; file: string; specs?: { title: string; file: string }[]; suites?: Suite[] };

// The tests in the order the JSON reporter lists them: per file, specs before nested describe blocks, as listed.
export function listedTests(json: { suites: Suite[] }): ListedTest[] {
  const out: ListedTest[] = [];
  const walk = (s: Suite, path: string[]) => {
    for (const sp of s.specs ?? []) out.push({ file: sp.file, titles: [...path, sp.title] });
    for (const c of s.suites ?? []) walk(c, [...path, c.title]);
  };
  for (const fileSuite of json.suites) walk(fileSuite, []);
  return out;
}

// Cuts the ordered list into `of` contiguous slices of about equal weight; returns slice `shard` (1-based).
export function partition<T>(items: T[], weight: (t: T) => number, shard: number, of: number): T[] {
  if (!Number.isInteger(of) || of < 1 || !Number.isInteger(shard) || shard < 1 || shard > of) throw new Error(`bad shard ${shard}/${of}`);
  const total = items.reduce((s, t) => s + weight(t), 0);
  let acc = 0;
  return items.filter((t) => {
    const w = weight(t);
    // A test belongs to the slice its midpoint falls in; the index never decreases, so slices are contiguous.
    const k = total > 0 ? Math.min(of - 1, Math.floor(((acc + w / 2) * of) / total)) : 0;
    acc += w;
    return k === shard - 1;
  });
}

// One --test-list line per test. Playwright splits a line on "›" and compares each trimmed part with a title, so a
// title that holds the delimiter or outer spaces could not be matched exactly: fail loudly instead of skipping it.
export function testListLine(t: ListedTest): string {
  for (const title of t.titles) {
    if (title.includes('›') || title !== title.trim()) throw new Error(`can't list ${t.file} › ${title}: "›" or outer spaces in a title`);
  }
  return [t.file, ...t.titles].join(' › ');
}

if (import.meta.main) {
  const [file, shard, of] = process.argv.slice(2);
  const tests = listedTests(JSON.parse(readFileSync(file, 'utf8')));
  if (!tests.length) throw new Error('no tests listed');
  const weight = (t: ListedTest) => WEIGHTS[t.file] ?? DEFAULT_WEIGHT;
  // Belt and braces at run time: the N slices together are the whole list, each test in exactly one.
  const all = Array.from({ length: Number(of) }, (_, i) => partition(tests, weight, i + 1, Number(of))).flat();
  if (all.length !== tests.length || all.some((t, i) => t !== tests[i])) throw new Error('slices do not cover the list exactly once');
  const slice = partition(tests, weight, Number(shard), Number(of));
  process.stdout.write(slice.map(testListLine).join('\n') + '\n');
  console.error(`shard ${shard}/${of}: ${slice.length} of ${tests.length} tests`);
}
