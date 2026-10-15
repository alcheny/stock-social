import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blocking, cliEnv, cliErr, parseResult, renderSpecDoc, type Finding, headline } from './team.ts';

test('parseResult: structured output, cost, and errors from the CLI envelope', () => {
  const ok = parseResult(JSON.stringify({ structured_output: { pass: true }, total_cost_usd: 0.12, is_error: false }));
  assert.deepEqual(ok, { out: { pass: true }, cost: 0.12, error: null });
  const fromResult = parseResult(JSON.stringify({ result: '{"pass":false}', total_cost_usd: 0 }));
  assert.deepEqual(fromResult.out, { pass: false });
  const authFail = parseResult(JSON.stringify({ is_error: true, result: 'Not logged in · Please run /login', total_cost_usd: 0 }));
  assert.equal(authFail.error, 'Not logged in · Please run /login');
  assert.match(parseResult('not json').error!, /unparseable/);
  assert.equal(parseResult(JSON.stringify({ result: 'plain text' })).error, 'no structured output');
});

test('blocking: notes never block, everything else does', () => {
  const fs: Finding[] = [
    { severity: 'note', where: 'a', problem: 'nit' }, { severity: 'usability', where: 'b', problem: 'tap target 20px' },
    { severity: 'bug', where: 'c', problem: 'crash' }, { severity: 'spec', where: 'd', problem: 'missing label' },
  ];
  assert.deepEqual(blocking(fs).map((f) => f.where), ['b', 'c', 'd']);
  assert.deepEqual(blocking([{ severity: 'note', where: 'x', problem: 'y' }]), []);
});

test('renderSpecDoc records the spec, the discussion, every QA round and the cost', () => {
  const md = renderSpecDoc({
    title: 'Swipe to trade', variant: 'B · Sheet', spec: '## Goal\nOpen trades by swiping.', agreed: true,
    discussion: [
      { round: 1, designer: 'Draft 1', business: { approve: false, ease_of_use: 'ok', retention: 'weak', virality: 'none', feedback: 'add share' } },
      { round: 2, designer: 'Draft 2', business: { approve: true, ease_of_use: 'good', retention: 'good', virality: 'share button', feedback: 'ship it' } },
    ],
    qa: [
      { round: 1, by: 'checks', pass: false, findings: [{ severity: 'bug', where: 'Unit tests', problem: 'expected 2 | got 3' }] },
      { round: 2, by: 'tester', pass: true, findings: [] },
    ],
    calls: [{ role: 'designer', round: 1, costUsd: 0.2, ok: true }, { role: 'engineer', round: 1, costUsd: 1.3, ok: true }],
  });
  assert.match(md, /agreed by designer and business analyst/);
  assert.match(md, /Round 1[\s\S]*changes requested[\s\S]*Round 2[\s\S]*approved/);
  assert.match(md, /\| 1 \| checks \| ✖ fail \| \[bug\] Unit tests: expected 2 \/ got 3 \|/); // pipes escaped in tables
  assert.match(md, /\| 2 \| tester \| ✅ pass \| — \|/);
  assert.match(md, /2 role calls, \$1\.50 total/);
});

test('headline picks the failing line from a check log', () => {
  assert.equal(headline('\n\n  ✘ 3 e2e/app.spec.ts:10 › feed (5s)\nmore\n  1 failed\n'), '✘ 3 e2e/app.spec.ts:10 › feed (5s)');
  assert.equal(headline('all good\nlast line\n\n'), 'last line');
  assert.equal(headline(''), '');
});

test('cli: token is trimmed for the CLI and masked in error output; empty output is a clear error', () => {
  const prev = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  try {
    process.env.CLAUDE_CODE_OAUTH_TOKEN = ['\n ', 'tok', 'en-abcdefgh12345', '\n'].join('');
    assert.equal(cliEnv().CLAUDE_CODE_OAUTH_TOKEN, 'token-abcdefgh12345');
    assert.equal(cliErr(['boom with token-abcdefgh12345 inside', '⚠ Permission mode forced to default'].join('\n')), 'boom with *** inside');
    assert.match(parseResult('').error ?? '', /no output from the CLI/);
    assert.equal(parseResult('⚠ note\n{"structured_output":{"a":1},"total_cost_usd":0.1}').error, null);
  } finally { if (prev === undefined) delete process.env.CLAUDE_CODE_OAUTH_TOKEN; else process.env.CLAUDE_CODE_OAUTH_TOKEN = prev; }
});
