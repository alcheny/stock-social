import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkLicenses, forbiddenFile, NOREPLY, scanDiff, scanText } from './compliance.ts';

// Samples are assembled at runtime so this file never contains a real-looking secret or address itself.
const j = (...p: string[]) => p.join('');
const rules = (file: string, text: string) => scanText(file, text).map((v) => `${v.rule}: ${v.detail}`);

test('secrets: every token format is caught, and the match is never echoed', () => {
  const samples = [j('gh', 'p_', 'A'.repeat(36)), j('github', '_pat_', 'B'.repeat(30)), j('sk-', 'ant-', 'oat01-', 'c'.repeat(30)), j('AK', 'IA', 'ABCDEFGHIJKLMNOP'),
    j('AI', 'za', 'D'.repeat(35)), j('xo', 'xb-', '1'.repeat(12)), j('sk', '_live_', 'E'.repeat(20)), j('-----BEGIN ', 'RSA PRIVATE', ' KEY-----'),
    j('eyJ', 'a'.repeat(12), '.eyJ', 'b'.repeat(12), '.', 'c'.repeat(12)), j('postgres://admin:', 'hunter2hunter', '@db.prod.internal/x')];
  for (const s of samples) {
    const v = scanText('lib/x.ts', `const k = "${s}";`);
    assert.ok(v.some((x) => x.rule === 'secret'), s.slice(0, 6));
    assert.ok(v.every((x) => !x.detail.includes(s)), 'never echo the secret');
  }
  assert.ok(rules('lib/x.ts', j('const apiKey = "', 'Zx81kq0vB3mPq7Lw', '";')).includes('secret: hard-coded secret'));
});

test('secrets: CI-only credentials, placeholders and templates are not flagged', () => {
  for (const ok of ['DATABASE_URL: postgres://stock_social:stock_social@localhost:5432/stock_social', 'APP_SECRET_KEY: ci-only',
    'const url = `https://x-access-token:${env(\'GH_TOKEN\')}@github.com/${repo()}.git`;', 'password = "<your-password-here>"',
    'apiKey: process.env.SNAPTRADE_CONSUMER_KEY', 'secret = "change-me-please-now"']) {
    assert.deepEqual(scanText('scripts/x.ts', ok).filter((v) => v.rule === 'secret'), [], ok);
  }
});

test('personal data: real addresses and local paths are caught; noreply and example addresses pass', () => {
  assert.ok(rules('docs/x.md', j('mail me at someone', '@', 'gmail.com')).includes('personal data: email address'));
  assert.ok(rules('docs/x.md', j('see /Us', 'ers/bob/projects/app')).includes('personal data: local machine path'));
  assert.ok(rules('docs/x.md', j('/private/tmp/', 'claude-501/x')).includes('personal data: local machine path'));
  for (const ok of [j('autopilot', '@users.noreply.github.com'), j('noreply', '@anthropic.com'), j('trader', '@example.com'), j('git', '@github.com:o/r.git'), '/home/runner/work/x']) {
    assert.deepEqual(scanText('docs/x.md', ok).filter((v) => v.rule === 'personal data'), [], ok);
  }
});

test('marks: third-party brands and real people are caught anywhere except the term lists', () => {
  for (const s of [j('a Robin', 'hood-style chart'), j('Tik', 'Tok swipe'), j('like Tin', 'der'), j('Steve ', 'Jobs mindset'), j('e', 'Toro copy trading')]) {
    assert.ok(scanText('docs/DESIGN.md', s).some((v) => v.rule === 'third-party mark or real person'), s);
    assert.ok(scanText('app/page.tsx', `// ${s}`).some((v) => v.rule === 'third-party mark or real person'), s);
  }
  assert.deepEqual(scanText('docs/POLICY.md', j('never mention Robin', 'hood')), []);
  assert.deepEqual(scanText('lib/x.ts', 'const handle = "robinsmith"; // SnapTrade, Next.js, Vercel'), []);
});

test('minors: age cohorts that include minors are blocked everywhere but the term lists', () => {
  for (const s of [j('Streaks fit Gen', ' Z'), j('built for tee', 'ns'), j('Gen ', 'Alpha users')]) assert.ok(scanText('docs/DESIGN.md', s).some((v) => v.rule === 'minors targeting'), s);
  assert.deepEqual(scanText('lib/x.ts', 'const generation = 3; // genuine'), []);
});

test('promissory language: blocked in product code and copy, allowed in docs and tests', () => {
  for (const s of ['Guaranteed returns every month', 'risk-free gains', 'Beat the market', 'You should buy NVDA', 'Copy their trades']) {
    assert.ok(scanText('app/page.tsx', s).some((v) => v.rule === 'promissory or advice language'), s);
    assert.deepEqual(scanText('docs/POLICY.md', s).filter((v) => v.rule === 'promissory or advice language'), []);
    assert.deepEqual(scanText('lib/x.test.ts', s).filter((v) => v.rule === 'promissory or advice language'), []);
  }
  assert.deepEqual(scanText('app/page.tsx', 'Not investment advice. Past performance does not guarantee future results.'), []);
  for (const s of ['Verified via a vendor', 'Verified on Stock Social', 'verified by the broker']) assert.ok(scanText('lib/badge.ts', s).length, s);
});

test('forbidden files: secrets, OS junk and personal tool data never get committed', () => {
  for (const f of ['.DS_Store', 'app/.DS_Store', '.env', '.env.production', 'key.pem', 'id_ed25519', '.npmrc', '.vibe-wise/profile.md', 'credentials.json', 'dump.sqlite', '.claude/settings.local.json']) {
    assert.ok(forbiddenFile(f), f);
  }
  for (const f of ['.env.example', 'app/page.tsx', 'docs/POLICY.md', '.claude/agents/engineer.md']) assert.ok(!forbiddenFile(f), f);
});

test('diff mode: only added lines and added files count', () => {
  const dir = mkdtempSync(join(tmpdir(), 'compliance-'));
  const cwd = process.cwd();
  const g = (...a: string[]) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' });
  try {
    g('init', '-q'); g('config', 'user.email', j('t', '@example.com')); g('config', 'user.name', 't');
    writeFileSync(join(dir, 'old.md'), j('legacy Robin', 'hood mention\n'));
    g('add', '.'); g('commit', '-qm', 'base'); g('branch', 'base');
    writeFileSync(join(dir, 'old.md'), j('legacy Robin', 'hood mention\nnew clean line\n'));
    writeFileSync(join(dir, 'new.md'), j('a Tik', 'Tok clone\n'));
    writeFileSync(join(dir, '.DS_Store'), 'x');
    g('add', '.'); g('commit', '-qm', 'change');
    process.chdir(dir);
    const v = scanDiff('base');
    assert.deepEqual(v.map((x) => `${x.file}:${x.line}:${x.rule}`).sort(), ['.DS_Store:0:forbidden file', 'new.md:1:third-party mark or real person']);
  } finally { process.chdir(cwd); }
});

test('licenses: permissive and reviewed packages pass, copyleft and unknown fail', () => {
  const root = mkdtempSync(join(tmpdir(), 'nm-'));
  const pkg = (name: string, license?: string) => {
    mkdirSync(join(root, name), { recursive: true });
    writeFileSync(join(root, name, 'package.json'), JSON.stringify({ name, version: '1.0.0', ...(license ? { license } : {}) }));
  };
  pkg('ok-mit', 'MIT'); pkg('ok-dual', '(MIT OR GPL-3.0)'); pkg('@img/sharp-libvips-linux-x64', 'LGPL-3.0-or-later');
  pkg('bad-gpl', 'GPL-3.0'); pkg('bad-agpl', 'AGPL-3.0-only'); pkg('bad-none'); pkg('bad-and', 'MIT AND GPL-2.0');
  const bad = checkLicenses(root).map((v) => v.detail.split(':')[0]).sort();
  assert.deepEqual(bad, ['bad-agpl', 'bad-and', 'bad-gpl', 'bad-none']);
});

test('commit emails: only GitHub noreply addresses pass', () => {
  for (const ok of [j('124938909+alcheny', '@users.noreply.github.com'), j('autopilot', '@users.noreply.github.com'), j('41898282+github-actions[bot]', '@users.noreply.github.com'), j('noreply', '@github.com')]) assert.ok(NOREPLY.test(ok), ok);
  for (const bad of [j('someone', '@gmail.com'), j('me', '@company.com'), j('x', '@users.noreply.github.com.evil.com')]) assert.ok(!NOREPLY.test(bad), bad);
});
