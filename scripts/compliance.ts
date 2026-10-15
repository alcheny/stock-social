// Compliance scanner: the deterministic half of docs/POLICY.md. CI runs it on every PR and every push to
// main, and branch teams run it before handing work to the tester. No AI judgment here: patterns only.
// Agents can't edit this file or the policy (CODEOWNERS, LOOP_PATHS, DOCTOR_FORBIDDEN, team.ts), and
// scripts/invariants.test.ts fails CI if its core checks are weakened. Exceptions are added by a human here.
//
//   node scripts/compliance.ts tree          every tracked file (main, PRs into main)
//   node scripts/compliance.ts diff <ref>    only files and lines added since <ref> (PRs into a line branch)
//   node scripts/compliance.ts auto          diff against origin/$BASE_REF when it is a line, else tree
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type Violation = { file: string; line: number; rule: string; detail: string };

// 1. Secrets. A match is never printed: only the rule and the location.
export const SECRET_PATTERNS: [string, RegExp][] = [
  ['GitHub token', /\b(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})/],
  ['Anthropic/Claude key or OAuth token', /\bsk-ant-[A-Za-z0-9_-]{20,}/],
  ['OpenAI-style key', /\bsk-(proj-)?[A-Za-z0-9]{32,}/],
  ['AWS access key', /\b(AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['Stripe live key', /\b(sk|rk)_live_[A-Za-z0-9]{16,}/],
  ['npm token', /\bnpm_[A-Za-z0-9]{36}\b/],
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['credential in URL', /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/'"`]+:[^\s@/'"`$]{3,}@[^\s'"`]+/i],
  ['hard-coded secret', /\b(secret|password|passwd|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|consumer[_-]?key|private[_-]?key)\b["']?\s*[:=]\s*["'][^"'\s]{12,}["']/i],
];
// Values that are obviously not real secrets: CI-only test credentials, placeholders, templates.
const SECRET_OK = [/postgres:\/\/stock_social:stock_social@localhost/, /ci-only/, /\$\{|\$\(|<[^>]+>|process\.env/, /\b(example|placeholder|changeme|change-me|dummy|fake|xxx+|redacted)\b/i];

// 2. Personal data: email addresses outside these domains, and local machine paths.
const EMAIL = /\b[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}\b/g;
const EMAIL_OK = [/@users\.noreply\.github\.com$/i, /@noreply\.github\.com$/i, /^noreply@anthropic\.com$/i, /^git@github\.com$/i,
  /@example\.(com|org|net)$/i, /\.(example|test|invalid|localhost)$/i];
const LOCAL_PATH = /(\/Users\/[A-Za-z0-9._-]+|\/home\/(?!runner\b)[a-z0-9._-]+\/|[A-Z]:\\Users\\|\/private\/tmp\/claude-)/;

// 3. Files that must never be committed.
export const FORBIDDEN_FILES: RegExp[] = [/(^|\/)\.DS_Store$/, /(^|\/)\.env(\.(?!example$)[^/]+)?$/, /\.(pem|key|p12|pfx|jks|keystore)$/i,
  /(^|\/)id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/, /(^|\/)\.npmrc$/, /(^|\/)\.vibe-wise\//, /(^|\/)(credentials|service[-_]account)[^/]*\.json$/i,
  /\.(sqlite3?|db)$/i, /(^|\/)\.claude\/settings\.local\.json$/];

// 4. Third-party trademarks and real people: never in code, copy, docs, specs or personas. Describe the
// pattern generically instead ("a single-line scrubbable chart", "a vertical swipe feed"). Whole words,
// any case. Vendors this repo genuinely integrates with (SnapTrade, Next.js, Vercel, GitHub, Claude...)
// are not listed. Only a human adds or removes terms (see docs/POLICY.md → Trademarks and people).
export const MARKS = ['robinhood', 'robin hood', 'tiktok', 'tik tok', 'tinder', 'instagram', 'etoro', 'stocktwits', 'tradingview', 'webull',
  'coinbase', 'wallstreetbets', 'snapchat', 'bumble', 'elon musk', 'steve jobs', 'warren buffett', 'cathie wood', 'jim cramer',
  'nancy pelosi', 'roaring kitty', 'keith gill', 'douyin', 'facebook', 'youtube', 'reddit', 'myfxbook', 'zulutrade', 'collective2', 'darwinex',
  'schwab', 'vanguard', 'etrade', 'ibkr', 'interactive brokers', 'binance', 'sofi', 'moomoo', 'cash app', 'venmo', 'plaid', 'tiingo',
  'yahoo finance', 'google finance', 'seeking alpha', 'motley fool', 'unusual whales', 'bloomberg', 'bezos', 'zuckerberg', 'buffett', 'munger',
  'pelosi', 'dalio', 'cramer', 'isaacson', 'insanely great', 'reality distortion', 'idiot index', 'think different', 'just do it', 'diamond hands'];
// Age cohorts that include minors: Phase 1 is adults only, so nothing may target or describe them (POLICY P4).
export const MINORS = ['gen z', 'gen-z', 'genz', 'gen alpha', 'gen-alpha', 'zoomers?', 'teens?', 'teenagers?', 'tweens?'];
const MINORS_RE = new RegExp(`\\b(${MINORS.map((m) => m.replace(/ /g, '\\s')).join('|')})\\b`, 'i');
const MARK_RE = new RegExp(`\\b(${MARKS.map((m) => m.replace(/ /g, '[\\s-]?')).join('|')})\\b`, 'i');
// The term lists live in these files, so they're exempt from the mark check (and only these).
const MARK_EXEMPT = new Set(['docs/POLICY.md', 'scripts/compliance.ts', 'scripts/compliance.test.ts', 'scripts/policy.test.ts']);

// 5. Promotional, promissory or advice language, in product code and copy (not docs, which discuss it).
export const PROMO: RegExp[] = [/\bguaranteed? (returns?|profits?|gains?|income|results?|winners?)\b/i, /\brisk[- ]free\b/i,
  /\b(can'?t|cannot|won'?t) lose money\b/i, /\bget rich\b/i, /\bbeat the market\b/i, /\b(sure thing|easy money|free money)\b/i,
  /\b(you should|we recommend( that you)?|time to) (buy|sell)\b/i, /\bbuy now\b/i, /\bcopy (this|their|my|his|her) trades?\b/i,
  /\b(proven|guaranteed) (strategy|system|track record|winner)\b/i, /\b(outperforms?|make money|passive income|hot (pick|stock)|top picks?|pick of the day)\b/i,
  // Completeness claims the data can't back (options and some positions are excluded): POLICY F3.
  /\b(every closed trade is published|see every trade|all (of )?(their|his|her|my) trades|from any broker|every trade, verified)\b/i,
  // "Verified" means broker-sourced only; never "verified by/via/on" someone, which implies endorsement (POLICY F3a).
  /\bverified (via|by|on)\b/i];
const PRODUCT = /^(app|lib|public|components)\//;
const isTest = (f: string) => /\.test\.[jt]sx?$/.test(f) || f.startsWith('e2e/');

// 6. Dependency licenses (installed tree). Anything else needs a human review entry in LICENSE_REVIEWED.
export const LICENSE_OK = new Set(['MIT', 'MIT-0', 'Zlib', 'OFL-1.1', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', '0BSD', 'Unlicense', 'CC0-1.0', 'BlueOak-1.0.0', 'Python-2.0', 'CC-BY-4.0']);
export const LICENSE_REVIEWED: [RegExp, string][] = [
  [/^@img\/sharp-libvips-/, 'LGPL-3.0-or-later prebuilt libvips binary, dynamically linked by the optional image optimizer; used unmodified'],
];

export function scanText(file: string, text: string, onlyLines?: Set<number>): Violation[] {
  const out: Violation[] = [];
  text.split('\n').forEach((raw, i) => {
    const line = i + 1;
    if (onlyLines && !onlyLines.has(line)) return;
    for (const [rule, re] of SECRET_PATTERNS) {
      const m = raw.match(re);
      if (m && !SECRET_OK.some((ok) => ok.test(m[0]) || (rule === 'hard-coded secret' && ok.test(raw)))) out.push({ file, line, rule: 'secret', detail: rule });
    }
    for (const m of raw.matchAll(EMAIL)) if (!EMAIL_OK.some((ok) => ok.test(m[0]))) out.push({ file, line, rule: 'personal data', detail: 'email address' });
    if (LOCAL_PATH.test(raw)) out.push({ file, line, rule: 'personal data', detail: 'local machine path' });
    if (!MARK_EXEMPT.has(file)) { const m = raw.match(MARK_RE); if (m) out.push({ file, line, rule: 'third-party mark or real person', detail: m[0] }); }
    if (!MARK_EXEMPT.has(file)) { const m = raw.match(MINORS_RE); if (m) out.push({ file, line, rule: 'minors targeting', detail: m[0] }); }
    if (PRODUCT.test(file) && !isTest(file)) for (const re of PROMO) { const m = raw.match(re); if (m) out.push({ file, line, rule: 'promissory or advice language', detail: m[0] }); }
  });
  return out;
}

export const forbiddenFile = (file: string) => FORBIDDEN_FILES.some((re) => re.test(file));

export function checkLicenses(root = 'node_modules'): Violation[] {
  if (!existsSync(root)) return [];
  const out: Violation[] = [];
  const walk = (dir: string) => {
    for (const d of readdirSync(dir, { withFileTypes: true })) {
      if (!d.isDirectory() || d.name.startsWith('.')) continue;
      const p = join(dir, d.name);
      if (d.name.startsWith('@')) { walk(p); continue; }
      const pj = join(p, 'package.json');
      if (existsSync(pj)) {
        try {
          const j = JSON.parse(readFileSync(pj, 'utf8')) as { name?: string; license?: string | { type?: string }; licenses?: { type?: string }[] };
          const lic = typeof j.license === 'string' ? j.license : j.license?.type ?? j.licenses?.map((l) => l.type).join(' OR ') ?? 'UNKNOWN';
          const ids = lic.replace(/[()]/g, '').split(/\s+(?:OR|AND)\s+/);
          const allowed = (id: string) => LICENSE_OK.has(id.trim());
          const ok = /\bAND\b/.test(lic) ? ids.every(allowed) : ids.some(allowed); // "A OR B": either; "A AND B": both
          if (j.name && !ok && !LICENSE_REVIEWED.some(([re]) => re.test(j.name!))) out.push({ file: `${p}/package.json`, line: 1, rule: 'dependency license', detail: `${j.name}: ${lic}` });
        } catch { /* not a package */ }
      }
      const nested = join(p, 'node_modules');
      if (existsSync(nested)) walk(nested);
    }
  };
  walk(root);
  return out;
}

const git = (...a: string[]) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 256 << 20 });
const isBinary = (buf: Buffer) => buf.subarray(0, 8000).includes(0);

export function scanTree(): Violation[] {
  const out: Violation[] = [];
  for (const file of git('ls-files', '-z').split('\0').filter(Boolean)) {
    if (forbiddenFile(file)) out.push({ file, line: 0, rule: 'forbidden file', detail: 'must never be committed' });
    if (!existsSync(file)) continue;
    const buf = readFileSync(file);
    if (!isBinary(buf)) out.push(...scanText(file, buf.toString('utf8')));
  }
  return out;
}

export function scanDiff(base: string): Violation[] {
  const out: Violation[] = [];
  const range = `${base}...HEAD`;
  for (const file of git('diff', '--name-only', '--diff-filter=AR', '-z', range).split('\0').filter(Boolean)) {
    if (forbiddenFile(file)) out.push({ file, line: 0, rule: 'forbidden file', detail: 'must never be committed' });
  }
  // Added line numbers per file, from a zero-context diff.
  const added = new Map<string, Set<number>>();
  let cur = '';
  for (const l of git('diff', '--unified=0', '--no-color', range).split('\n')) {
    if (l.startsWith('+++ ')) { cur = l.startsWith('+++ b/') ? l.slice(6) : ''; continue; }
    const h = l.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (h && cur) { const s = added.get(cur) ?? new Set<number>(); for (let k = 0; k < Number(h[2] ?? 1); k++) s.add(Number(h[1]) + k); added.set(cur, s); }
  }
  for (const [file, lines] of added) {
    if (!existsSync(file)) continue;
    const buf = readFileSync(file);
    if (!isBinary(buf)) out.push(...scanText(file, buf.toString('utf8'), lines));
  }
  return out;
}

// Every commit's author and committer use a GitHub noreply address (or GitHub's own web-merge address), so no
// personal email ever reaches the public history (POLICY P1). Checked for the commits a PR adds.
export const NOREPLY = /^((\d+\+)?[\w.-]+(\[bot\])?@users\.noreply\.github\.com|noreply@github\.com)$/i;
export function checkCommits(range: string): Violation[] {
  return git('log', '--format=%h%x09%ae%x09%ce', range).split('\n').filter(Boolean).flatMap((l) => {
    const [sha, a, c] = l.split('\t');
    return [a, c].filter((e) => !NOREPLY.test(e)).map(() => ({ file: `commit ${sha}`, line: 0, rule: 'personal data', detail: 'commit email is not a GitHub noreply address' }));
  });
}

function main() {
  const [cmd, arg] = process.argv.slice(2);
  const base = process.env.BASE_REF ?? '';
  const mode = cmd === 'auto' ? (/^line\//.test(base) ? 'diff' : 'tree') : cmd;
  const ref = cmd === 'auto' ? `origin/${base}` : arg;
  if (mode !== 'tree' && mode !== 'diff') { console.error('usage: compliance.ts tree | diff <ref> | auto'); process.exit(2); }
  const commits = cmd === 'auto' && base ? checkCommits(`origin/${base}..HEAD`) : [];
  const found = [...(mode === 'tree' ? scanTree() : scanDiff(ref)), ...checkLicenses(), ...commits];
  if (!found.length) return console.log(`compliance: ok (${mode}${mode === 'diff' ? ` vs ${ref}` : ''})`);
  console.error(`compliance: ${found.length} violation(s) of docs/POLICY.md (${mode}${mode === 'diff' ? ` vs ${ref}` : ''}):`);
  for (const v of found) console.error(`  ${v.file}${v.line ? `:${v.line}` : ''}  [${v.rule}] ${v.detail}`);
  console.error('Fix the content (see docs/POLICY.md). Exceptions are added only by a human, in scripts/compliance.ts.');
  process.exit(1);
}

if (import.meta.main) main();
