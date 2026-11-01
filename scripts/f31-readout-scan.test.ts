// F-31 AC7 (docs/features/F-31-readout-limits-and-partial-rows.md; plan docs/features/logs/F-31/plan.md §8 AC7, E2, B2):
// no row of the owner's readout selects a user id, handle, return or filing name. A small lexer finds every `sql`
// tagged template literal in scripts/f15-readout.ts (nested sql`…` fragments included, each scanned on its own), and
// every `select` list at every depth is checked item by item. A banned identifier may appear in a select item only as
// the operand of `is [not] null`, `= any(...)` or `= $param`. No file or path allowlist.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const BANNED = new Set(['id', 'user_id', 'handle', 'display_name', 'return_pct', 'filer_key']);
const AGGS = new Set(['array_agg', 'string_agg', 'json_agg', 'jsonb_agg', 'json_build_object', 'jsonb_build_object', 'row_to_json', 'to_json', 'to_jsonb']);
const ENDS = new Set(['from', 'where', 'group', 'order', 'limit', 'union', 'having', 'except', 'intersect']);

// The bodies of every sql`…` literal in a TypeScript source, interpolations replaced by " $param ".
function sqlLiterals(src: string): string[] {
  const out: string[] = [];
  let i = 0;
  const skipQuoted = (q: string) => { i++; while (i < src.length && src[i] !== q) i += src[i] === '\\' ? 2 : 1; i++; };
  const code = (stopAtBrace: boolean) => {
    let depth = 0;
    while (i < src.length) {
      const ch = src[i];
      if (ch === '/' && src[i + 1] === '/') { const e = src.indexOf('\n', i); i = e < 0 ? src.length : e; continue; }
      if (ch === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 2; continue; }
      if (ch === '"' || ch === "'") { skipQuoted(ch); continue; }
      if (ch === '`') { template(/\bsql(?:<[^`()=]*>)?$/.test(src.slice(Math.max(0, i - 200), i))); continue; }
      if (ch === '{') depth++;
      if (ch === '}') { if (depth === 0 && stopAtBrace) { i++; return; } depth--; }
      i++;
    }
  };
  const template = (isSql: boolean) => {
    i++;
    let body = '';
    while (i < src.length) {
      const ch = src[i];
      if (ch === '\\') { body += src.slice(i, i + 2); i += 2; continue; }
      if (ch === '`') { i++; break; }
      if (ch === '$' && src[i + 1] === '{') { i += 2; code(true); body += ' $param '; continue; }
      body += ch; i++;
    }
    if (isSql) out.push(body);
  };
  code(false);
  return out;
}

const tokens = (body: string): string[] =>
  body.replace(/--[^\n]*/g, ' ').toLowerCase().match(/'(?:[^']|'')*'|\$param|[a-z_][a-z0-9_]*|\d+(?:\.\d+)?|::|\|\||<=|>=|<>|!=|[(),.*=<>+\-/;[\]]/g) ?? [];

// Every select list in a body: one array of items (each a token list) per select, at every depth.
function selectLists(body: string): string[][][] {
  const t = tokens(body);
  const lists: string[][][] = [];
  for (let s = 0; s < t.length; s++) {
    if (t[s] !== 'select') continue;
    const items: string[][] = [[]];
    let depth = 0;
    for (let j = s + 1 + (t[s + 1] === 'distinct' ? 1 : 0); j < t.length; j++) {
      const k = t[j];
      if (k === '(') depth++;
      if (k === ')') { if (depth === 0) break; depth--; }
      if (depth === 0 && ENDS.has(k)) break;
      if (depth === 0 && k === ',') { items.push([]); continue; }
      items.at(-1)!.push(k);
    }
    lists.push(items.filter((x) => x.length));
  }
  return lists;
}

// Table names and aliases after from/join in a body: a select item naming one bare (not before ".") returns the whole
// row, id and handle included (tester round 1).
const NOT_ALIAS = new Set(['where', 'join', 'left', 'right', 'inner', 'full', 'outer', 'cross', 'on', 'using', 'group', 'order', 'limit', 'as', 'lateral', 'union', 'having', 'select']);
function aliases(body: string): Set<string> {
  const t = tokens(body), out = new Set<string>();
  for (let j = 0; j < t.length - 1; j++) {
    if ((t[j] !== 'from' && t[j] !== 'join') || !/^[a-z_]/.test(t[j + 1]) || NOT_ALIAS.has(t[j + 1])) continue;
    out.add(t[j + 1]);
    const a = t[j + 2] === 'as' ? t[j + 3] : t[j + 2];
    if (a && /^[a-z_]/.test(a) && !NOT_ALIAS.has(a) && !ENDS.has(a)) out.add(a);
  }
  return out;
}
// Any column named like an id (`*_id`) is refused the same way as the named ones (tester round 1).
const banned = (k: string) => BANNED.has(k) || /^[a-z_][a-z0-9_]*_id$/.test(k);

// Why one select item is refused, or null.
function itemProblem(item: string[], rows: Set<string> = new Set()): string | null {
  const text = item.join(' ');
  if (item.some((k, j) => k === '*' && (j === 0 || item[j - 1] === '.'))) return `star: ${text}`;
  if (item.some((k, j) => k === 'row' && item[j + 1] === '(')) return `row constructor: ${text}`;
  if (item.some((k, j) => rows.has(k) && item[j + 1] !== '.' && item[j - 1] !== '.')) return `whole row: ${text}`;
  const asAt = item.lastIndexOf('as');
  if (asAt >= 0 && banned(item[asAt + 1])) return `banned alias: ${text}`;
  for (let j = 0; j < item.length; j++) {
    const k = item[j];
    if (AGGS.has(k)) return `aggregate ${k}: ${text}`;
    if (!banned(k)) continue;
    const next = item.slice(j + 1, j + 4);
    const operand = (next[0] === 'is' && (next[1] === 'null' || (next[1] === 'not' && next[2] === 'null')))
      || (next[0] === '=' && (next[1] === '$param' || (next[1] === 'any' && next[2] === '(')));
    if (!operand) return `banned ${k}: ${text}`;
  }
  return null;
}

const problems = (body: string) => { const rows = aliases(body); return selectLists(body).flat().map((i) => itemProblem(i, rows)).filter((p): p is string => p !== null); };

test('F-31 AC7: the scanner finds nested literals, strips comments and refuses every must-fail item', () => {
  const src = "const a = sql<{ n: number }[]>`select ${x}, n from t where u = ${sql`select u.id from users u`}`; // sql`select u.handle`\nconst b = `select u.handle`;";
  const lits = sqlLiterals(src);
  assert.equal(lits.length, 2, 'the comment and the untagged literal are not sql');
  assert.deepEqual(lits.map(problems), [['banned id: u . id'], []]);
  for (const bad of ['u.id', 'u.id::text', 'max(u.id)', 'lower(u.handle) as h', "coalesce(u.handle, '')", "u.handle || ''", 'x.*', '*',
    'array_agg(u.id)', 'sum(n) as handle', 'string_agg(x, \',\')', 'json_build_object(\'a\', 1)', 'u.display_name', 'r.return_pct', 'pf.filer_key', 'id']) {
    assert.equal(problems(`select 1, ${bad} from users u`).length, 1, bad);
    assert.equal(problems(`select n from (select ${bad} from users u) q`).length, 1, `${bad} (nested)`);
  }
  assert.equal(problems('select n from t -- , u.id\n where 1 = 1').length, 0, '-- comments are stripped');
  // Tester round 1: whole-row composites and other id columns.
  for (const bad of ['select u from users u', 'select u::text from users u', 'select row(u.*) from users u', 'select u.public_filer_id from users u',
    'select u.snaptrade_user_id from users u', 'select u.referred_by_user_id from users u', 'select users from users', 'select n, x from users u join t x on true']) {
    assert.equal(problems(bad).length, 1, bad);
  }
});

test('F-31 AC7: count(*), select 1 and comparisons of a banned column with a parameter pass', () => {
  for (const ok of ['count(*)', '1', 'count(*) filter (where t.connected)::int as strict', '(r.user_id is not null and $param) as demo',
    '(r.user_id is not null and u.public_filer_id is not null) as filer', 'coalesce(bool_or(u.public_filer_id is null and u.handle = any($param::text[])), false) as internal',
    'u.handle = $param as mine', "to_char(r.day, 'YYYY-MM-DD') as day", 'max(p.n)::int as n']) {
    assert.deepEqual(problems(`select ${ok} from t`), [], ok);
  }
});

test('F-31 AC7: no row of scripts/f15-readout.ts selects a user id, handle, display name, return or filing name', () => {
  const src = readFileSync(new URL('./f15-readout.ts', import.meta.url), 'utf8');
  const lits = sqlLiterals(src);
  const lists = lits.flatMap(selectLists);
  assert.ok(lits.length >= 12, `${lits.length} sql literals`);
  assert.ok(lists.length >= 10, `${lists.length} select lists`);
  const items = lists.flat().map((i) => i.join(' '));
  for (const want of ['as filer', 'as internal', 'as demo', 'as week', 'count ( * )']) assert.ok(items.some((i) => i.includes(want)), want);
  assert.ok(items.includes('trusted'), 'the cap marks loader is scanned');
  assert.deepEqual(lits.flatMap(problems), []);
});
