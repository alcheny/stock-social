// F-16 AC 1 (docs/features/logs/F-16-F-17/plan.md §5.2, v2 E4/E8/E12): every closed_trades / open_positions read
// under app/ and lib/ goes through the one visible-user predicate (lib/visible-users.ts), or is on the allowlist below
// with a reason and an exact count. The scanner tokenizes each file: it collects every top-level tagged template
// (sql, tx, db, conn, the feed's q, optionally with a type argument) together with the `${…}` templates nested in it, so a read
// inside a fragment is a statement of its own and a predicate in a nested fragment counts for its statement. It also
// checks that every read in code (comments stripped) sits inside a collected statement, so a read the tokenizer can't
// see (a raw string, sql.unsafe) fails instead of passing silently.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

export const READ = /\b(from|join)\s+(closed_trades|open_positions)\b/g;
export const PREDICATE = /\$\{\s*visible(User(AsOf)?\(|UserIds\(\)|Owner\(|Id\()/;
// Any tagged template is a statement (sql, tx, db, conn, the feed's q, …); a keyword before a backtick is not a tag.
const NOT_TAGS = new Set(['return', 'typeof', 'case', 'yield', 'await', 'in', 'of', 'else', 'do', 'void', 'new', 'throw', 'delete', 'instanceof']);

// Splits source into code (comments and plain strings blanked to spaces, template text kept) and the list of top-level
// tagged sql statements, each with its full raw text including nested `${…}` expressions.
export function scan(src: string): { code: string; statements: string[] } {
  const out: string[] = [];
  const statements: string[] = [];
  let i = 0;
  const n = src.length;
  let lastSig = ''; // last significant code character, for the regex-vs-division guess
  const blank = (s: string) => s.replace(/[^\n]/g, ' ');
  // Reads a template starting at the opening backtick; returns the index after the closing one.
  const template = (start: number): number => {
    let j = start + 1;
    while (j < n) {
      const c = src[j];
      if (c === '\\') { j += 2; continue; }
      if (c === '`') return j + 1;
      if (c === '$' && src[j + 1] === '{') { j = expression(j + 2); continue; }
      j++;
    }
    return n;
  };
  // Reads a `${…}` expression body from `start`; returns the index after the matching `}`.
  const expression = (start: number): number => {
    let j = start;
    let depth = 0;
    while (j < n) {
      const c = src[j];
      if (c === '`') { j = template(j); continue; }
      if (c === "'" || c === '"') { j = quoted(j); continue; }
      if (c === '/' && src[j + 1] === '/') { while (j < n && src[j] !== '\n') j++; continue; }
      if (c === '/' && src[j + 1] === '*') { const e = src.indexOf('*/', j + 2); j = e < 0 ? n : e + 2; continue; }
      if (c === '{') depth++;
      if (c === '}') { if (depth === 0) return j + 1; depth--; }
      j++;
    }
    return n;
  };
  // A quoted string ends at its quote or at the line end (JSX text like "don't" then damages one line at most).
  const quoted = (start: number): number => {
    const q = src[start];
    let j = start + 1;
    while (j < n && src[j] !== q && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
    return Math.min(n, j + 1);
  };
  const regex = (start: number): number => {
    let j = start + 1;
    let cls = false;
    while (j < n && src[j] !== '\n') {
      const c = src[j];
      if (c === '\\') { j += 2; continue; }
      if (c === '[') cls = true; else if (c === ']') cls = false; else if (c === '/' && !cls) return j + 1;
      j++;
    }
    return j;
  };
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { const e = src.indexOf('\n', i); const end = e < 0 ? n : e; out.push(blank(src.slice(i, end))); i = end; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); const end = e < 0 ? n : e + 2; out.push(blank(src.slice(i, end))); i = end; continue; }
    if (c === "'" || c === '"') { const end = quoted(i); out.push(blank(src.slice(i, end))); i = end; lastSig = c; continue; }
    if (c === '/' && (lastSig === '' || /[(,=:[!&|?{};]/.test(lastSig))) { const end = regex(i); out.push(blank(src.slice(i, end))); i = end; lastSig = '/'; continue; }
    if (c === '`') {
      const end = template(i);
      // The tag: an identifier (optionally `ident<…>`) right before the backtick.
      const before = src.slice(Math.max(0, i - 200), i);
      const m = /([A-Za-z_$][\w$]*)\s*(<[^`;()]*>)?\s*$/.exec(before);
      const text = src.slice(i, end);
      if (m && !NOT_TAGS.has(m[1])) statements.push(text);
      out.push(text);
      i = end;
      lastSig = '`';
      continue;
    }
    if (!/\s/.test(c)) lastSig = c;
    out.push(c);
    i++;
  }
  return { code: out.join(''), statements };
}

export type FileReport = { reads: number; unpredicated: string[]; stray: number };
// What the AC checks per file: reading statements, the ones without the predicate, and reads outside any statement.
export function check(src: string): FileReport {
  const { code, statements } = scan(src);
  const reading = statements.filter((s) => new RegExp(READ.source).test(s));
  const inStatements = statements.reduce((k, s) => k + [...s.matchAll(READ)].length, 0);
  const inCode = [...code.matchAll(READ)].length;
  return { reads: reading.length, unpredicated: reading.filter((s) => !PREDICATE.test(s)), stray: inCode - inStatements };
}

type Allow = { file: string; count: number; reason: string; proof?: RegExp };
// Exact counts of statements that read without the predicate, on purpose. The count must match (more fails, fewer
// fails too, so the list shrinks when code improves).
export const ALLOW: Allow[] = [
  { file: 'app/actions.ts', count: 1, reason: "the signed-in trader's own trade (thesis ownership check)" },
  { file: 'app/layout.tsx', count: 1, reason: "the viewer's own publisher flag (has the signed-in account any closed trade)" },
  { file: 'app/me/record/page.tsx', count: 1, reason: "the trader's own record (private; a hidden trader still sees it, E11)" },
  { file: 'lib/auth/landing.ts', count: 1, reason: "the signed-in trader's own trade count after sign-in (E11)" },
  { file: 'lib/connections.ts', count: 2, reason: "the trader's own import counts (funnel, connection status; E11)" },
  { file: 'lib/delete.ts', count: 1, reason: "the account's own deletion screen (does this account hold any data)" },
  { file: 'lib/thesis-save.ts', count: 2, reason: "the trader's own note write" },
  { file: 'lib/thesis-review.ts', count: 2, reason: "owner review (script and flag-gated page): hidden profiles' notes stay reviewable" },
  { file: 'lib/reports.ts', count: 1, reason: 'thesis report target lookup (F-16 engineer B owns lib/reports.ts; reporting a hidden thesis is refused there)' },
  { file: 'lib/privacy-purge.ts', count: 7, reason: "the tick's purge (writes and their counts, no output)" },
  { file: 'lib/positions.ts', count: 3, reason: 'sync write of the open positions snapshot (E4)' },
  { file: 'lib/public-trades.ts', count: 1, reason: 'F-7 import rebuild (write)' },
  { file: 'lib/sync.ts', count: 3, reason: 'rebuild and sync (writes; owned by the sync sessions)' },
  { file: 'lib/options-sync.ts', count: 6, reason: 'options rebuild and sync (writes; owned by the sync sessions)' },
  { file: 'lib/feed.ts', count: 1, reason: 'olderThan: a window probe that returns one timestamp (no trader data); elig applies the predicate to every row it can rank' },
  { file: 'lib/thesis-fixtures.ts', count: 1, reason: 'test fixture helper' },
  { file: 'lib/likes.ts', count: 6, reason: "viewer's own list (E12): likedAmong, ownLikes, hiddenTradeCount, ownHiddenTrades, likesAt, rejectsAt read only what this viewer stored" },
  { file: 'lib/discovery/activity.ts', count: 1, reason: "viewer's own list (E12): eventsFor reads this viewer's logged events for their own ordering" },
  { file: 'lib/views.ts', count: 2, reason: "F-15 view targets: both reads splice the `visible` binding, which is visibleUser('u')", proof: /const visible = sql`\$\{visibleUser\('u'\)\} and/ },
];

const files = () => [...walk(`${root}app`), ...walk(`${root}lib`)]
  .filter((f) => /\.tsx?$/.test(f) && !/\.(test|spec)\.tsx?$/.test(f) && !/\.db\.test\.ts$/.test(f));

test('scanner self-test: a read without the predicate fails, including one nested in a ${} fragment', () => {
  const bare = 'const r = await sql`select * from closed_trades where user_id = ${id}`;';
  assert.equal(check(bare).unpredicated.length, 1);
  const ok = "const r = await sql`select * from closed_trades t join users u on u.id = t.user_id and ${visibleUser('u')}`;";
  assert.deepEqual(check(ok), { reads: 1, unpredicated: [], stray: 0 });
  // A fragment nested in a statement: the outer statement has the predicate only for its own read, the nested read
  // is the same top-level statement, so the predicate anywhere in it counts (one statement, one check)…
  const nestedOk = "sql`select x from (${sql`select user_id from closed_trades`}) s join users u on u.id = s.user_id and ${visibleUser('u')}`";
  assert.deepEqual(check(nestedOk), { reads: 1, unpredicated: [], stray: 0 });
  // …and a nested read in a statement that has no predicate at all fails.
  const nestedBad = 'sql`select * from users u where exists (${cond ? sql`select 1 from open_positions p where p.user_id = u.id` : sql``})`';
  assert.equal(check(nestedBad).unpredicated.length, 1);
  // A read inside a template nested in a plain ${} (no sql tag on the outer string) is its own statement.
  const inPlain = 'const q = `label ${sql`select 1 from closed_trades`}`;';
  assert.equal(check(inPlain).unpredicated.length, 0, 'an untagged outer template is not a statement…');
  assert.equal(check(inPlain).stray, 1, '…so its read shows up as one the scanner cannot place');
  // The feed shape (lib/feed.ts candidate CTE and records(): a typed tag and a multi-line join).
  const typed = "sql<Row[]>`with elig as (select t.* from closed_trades t\n join users u on u.id = t.user_id and ${visibleUserAsOf('u', asOf)})`";
  assert.deepEqual(check(typed), { reads: 1, unpredicated: [], stray: 0 });
  for (const p of ["${visibleUserIds()}", "${visibleOwner('t')}", '${visibleId(id)}', "${visibleUser('u')}"]) {
    assert.equal(check(`sql\`select 1 from open_positions t where ${p}\``).unpredicated.length, 0, p);
  }
  // Comments and strings are not reads; a raw string read is a stray read.
  assert.deepEqual(check('// select * from closed_trades\n/* join open_positions */ const s = 1;'), { reads: 0, unpredicated: [], stray: 0 });
  assert.equal(check("sql.unsafe(`select * from closed_trades`)").stray, 1);
  assert.equal(check('function f() { return `select 1 from closed_trades`; }').stray, 1, 'return is not a tag');
  assert.equal(check('await q`select 1 from closed_trades`').unpredicated.length, 1, 'any tag is a statement');
  // JSX text with an apostrophe doesn't swallow a later statement.
  const jsx = "const a = <p>Don't</p>;\nconst r = await sql`select 1 from closed_trades`;";
  assert.equal(check(jsx).unpredicated.length, 1);
  // Regex literals containing backticks don't open a template.
  assert.equal(check('const re = /`/; const r = sql`select 1 from closed_trades`;').unpredicated.length, 1);
});

test('F-16 AC 1: every public closed_trades / open_positions read uses the visible-user predicate (allowlist exact)', () => {
  const allow = new Map(ALLOW.map((a) => [a.file, a]));
  const problems: string[] = [];
  let reads = 0;
  for (const f of files()) {
    const rel = relative(root, f);
    const src = readFileSync(f, 'utf8');
    const r = check(src);
    reads += r.reads;
    if (r.stray !== 0) problems.push(`${rel}: ${r.stray} read(s) outside a tagged sql statement`);
    const a = allow.get(rel);
    const want = a?.count ?? 0;
    if (r.unpredicated.length !== want) {
      problems.push(`${rel}: ${r.unpredicated.length} read(s) without the predicate, allowlist says ${want}${r.unpredicated.map((s) => `\n    ${s.replace(/\s+/g, ' ').slice(0, 140)}`).join('')}`);
    }
    if (a?.proof) assert.match(src, a.proof, `${rel}: allowlist proof no longer holds`);
  }
  for (const a of ALLOW) {
    assert.ok(existsSync(`${root}${a.file}`), `${a.file} is allowlisted but no longer exists`);
    assert.ok(a.reason.length > 10, `${a.file}: give a reason`);
  }
  assert.deepEqual(problems, []);
  assert.ok(reads >= 40, `found only ${reads} reading statements: the scanner may be matching nothing`);
});
