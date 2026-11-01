// CI's e2e shards (.github/workflows/ci.yml → e2e). Playwright's own --shard balances by test count, and the slow
// tests sit together in a few files, so its slices came out uneven (one shard 203 s of 480 s at N=4). This splits the
// suite into N contiguous slices of about equal estimated time instead and writes the slice as a --test-list file.
//
// Exactly once, by construction: every shard reads the same `playwright test --list --reporter=json` of the same
// commit, and `partition` is a pure function that cuts that one ordered list into disjoint, covering, contiguous
// slices (tested in e2e-shard.test.ts). The weights only move the cut points; they never decide whether a test runs.
// Slices keep each file's tests in declaration order, but a file may be split across shards (connect.spec.ts is):
// its beforeAll/afterAll then run once per shard it lands in, so a test must not rely on an earlier one in its file.
//
//   npx playwright test --list --reporter=json > list.json
//   node scripts/e2e-shard.ts pick list.json <shard> <of> > shard.txt         # the slice as a --test-list
//   npx playwright test --list --reporter=json --test-list shard.txt > got.json
//   node scripts/e2e-shard.ts verify list.json got.json <shard> <of>        # matched exactly the slice, test by test
//   npx playwright test --workers=1 --test-list shard.txt
import { readFileSync } from 'node:fs';

export type ListedTest = { file: string; titles: string[] };

// Seconds per test, measured per file on CI with one worker per shard (run of 2026-11-01). Rough is fine: they only
// balance. Keyed as Playwright names files: relative to the test directory (e2e/), which is what --test-list expects.
export const WEIGHTS: Record<string, number> = {
  'app.spec.ts': 1.3, 'connect.spec.ts': 5.1, 'follow.spec.ts': 6.2, 'likes.spec.ts': 6.1, 'section.spec.ts': 6.6,
  'share-card.spec.ts': 2.5, 'signin.spec.ts': 0.6, 'similar.spec.ts': 15.2,
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
    if (!title || /[›\n\r]/.test(title) || title !== title.trim()) throw new Error(`can't list ${t.file} › ${JSON.stringify(title)}: an empty title, "›", a line break or outer spaces`);
  }
  return [t.file, ...t.titles].join(' › ');
}

const weight = (t: ListedTest) => WEIGHTS[t.file] ?? DEFAULT_WEIGHT;
const read = (file: string) => listedTests(JSON.parse(readFileSync(file, 'utf8')));

// The slice for shard/of of the full list, after checking that the N slices together are the whole list, each test once.
export function slice(tests: ListedTest[], shard: number, of: number): ListedTest[] {
  if (!tests.length) throw new Error('no tests listed');
  const all = Array.from({ length: of }, (_, i) => partition(tests, weight, i + 1, of)).flat();
  if (all.length !== tests.length || all.some((t, i) => t !== tests[i])) throw new Error('slices do not cover the list exactly once');
  return partition(tests, weight, shard, of);
}

// What a shard's --test-list actually matched must be its slice exactly: no test missing, none extra (Playwright
// matches a line as a title prefix, so a line could also pick up a test nested under the same title).
export function verify(want: ListedTest[], got: ListedTest[]): string[] {
  const key = (t: ListedTest) => JSON.stringify([t.file, ...t.titles]);
  const w = want.map(key).sort(), g = got.map(key).sort();
  return [...w.filter((k) => !g.includes(k)).map((k) => `missing ${k}`), ...g.filter((k) => !w.includes(k)).map((k) => `extra ${k}`),
    ...(new Set(g).size !== g.length ? ['a test matched twice'] : [])];
}

if (import.meta.main) {
  const [mode, ...a] = process.argv.slice(2);
  if (mode === 'pick') {
    const [file, shard, of] = a;
    const s = slice(read(file), Number(shard), Number(of));
    process.stdout.write(s.map(testListLine).join('\n') + '\n');
    console.error(`shard ${shard}/${of}: ${s.length} tests picked`);
  } else if (mode === 'verify') {
    const [file, got, shard, of] = a;
    const want = slice(read(file), Number(shard), Number(of));
    const problems = verify(want, read(got));
    if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
    console.error(`shard ${shard}/${of}: --test-list matched exactly the ${want.length} picked tests`);
  } else throw new Error('usage: e2e-shard.ts pick <list.json> <shard> <of> | verify <list.json> <got.json> <shard> <of>');
}
