// F-17 "no personal data in rejection logs" (decision of cycle 2, veto condition LG; plan
// docs/features/logs/F-16-F-17/plan.md §8 F-17 #11). A log scanner: every console call is captured while the sign-up,
// rename and display-name paths refuse, and nothing captured (nor any thrown error's message, which a server may log)
// carries the typed handle, the typed name or an address. A source scan keeps console calls out of those paths.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hasDb = !!process.env.DATABASE_URL;
before(async () => { if (hasDb) await (await import('./privacy-test-schema.ts')).applySchemaForTests(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const LEVELS = ['log', 'info', 'warn', 'error', 'debug', 'trace'] as const;
async function captured(fn: () => Promise<void>): Promise<string> {
  const out: string[] = [];
  const saved = LEVELS.map((l) => console[l]);
  for (const l of LEVELS) console[l] = (...a: unknown[]) => { out.push(a.map((x) => (x instanceof Error ? `${x.name} ${x.message}` : typeof x === 'string' ? x : JSON.stringify(x))).join(' ')); };
  try { await fn(); } finally { LEVELS.forEach((l, i) => { console[l] = saved[i]; }); }
  return out.join('\n');
}
const letters = (p: string) => `${p}${Math.random().toString(36).replace(/[^a-z]/g, '').slice(0, 6).padEnd(6, 'q')}`;

test('F-17 #11: refused display names log nothing and their reason never repeats the name', async () => {
  const names = ['Verified Lena Q', 'Lena ✓ Q', 'StockSocial Lena', 'Ver‮ified Lena', 'Admin'];
  const errs: string[] = [];
  const log = await captured(async () => {
    const { checkDisplayName } = await import('./handles.ts');
    for (const n of names) { const c = checkDisplayName(n); assert.equal(c.ok, false, n); if (!c.ok) errs.push(c.reason); }
  });
  assert.equal(log, '');
  for (const r of errs) for (const n of names) assert.ok(!r.includes(n) && !r.includes('Lena'), r);
});

test('F-17 #11: refused sign-ups and renames log nothing tied to a person: no typed handle, no name, no address', { skip: !hasDb && 'no DATABASE_URL' }, async () => {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt, changeHandle, signInWithIdentity } = await import('./auth/attempts.ts');
  const tag = letters('lg');
  const ids: number[] = [];
  const typed = [`${tag}_ca1m`, 'support', 'pf_' + tag, `${tag}_soon`, `${tag}_taken`, `${tag}_ow`];
  const name = 'Verified Quill Person';
  const email = `${tag}.x@example.com`;
  const thrown: string[] = [];
  try {
    const log = await captured(async () => {
      const u = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}_calm` });
      ids.push(u.id);
      const t = await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}_taken` });
      ids.push(t.id);
      const viaMail = await signInWithIdentity(await createAttempt({ method: 'email', attested: true }), { provider: 'email', subject: email, email });
      ids.push(viaMail.id);
      const dev = () => createAttempt({ method: 'dev', attested: true });
      const tries: (() => Promise<unknown>)[] = [
        async () => createUserForAttempt(await dev(), { handle: `${tag}_x`, name }),
        async () => createUserForAttempt(await dev(), { handle: 'support' }),
        async () => createUserForAttempt(await dev(), { handle: 'pf_' + tag }),
        () => changeHandle(viaMail.id, `${tag}_ca1m`),
        () => changeHandle(viaMail.id, `${tag}_taken`),
        () => changeHandle(viaMail.id, `${tag}_ow`, { env: { NODE_ENV: 'production', LAUNCH_ALLOWLIST: `${tag}_ow`, SNAPTRADE_CLIENT_ID: 'x' } }),
      ];
      for (const run of tries) { try { await run(); assert.fail('expected a refusal'); } catch (e) { thrown.push((e as Error).message); } }
      await changeHandle(u.id, `${tag}_cal2`);
      try { await changeHandle(u.id, `${tag}_soon`); assert.fail('expected soon'); } catch (e) { thrown.push((e as Error).message); }
    });
    assert.equal(thrown.length, 7);
    assert.deepEqual(thrown.filter((m) => /^expected/.test(m)), [], 'every path refused');
    for (const text of [log, ...thrown]) {
      for (const h of typed) assert.ok(!text.includes(h), `"${text}" carries the typed handle ${h}`);
      assert.ok(!text.includes('Quill'), `"${text}" carries the typed name`);
      assert.ok(!text.includes('@') && !text.includes(tag), `"${text}" carries an address or the tag`);
    }
    assert.equal(log, '', 'the refusal paths log nothing at all');
  } finally {
    await sql`delete from handle_reservations where handle like ${`${tag}%`} or user_id in ${sql(ids.length ? ids : [0])}`;
    if (ids.length) await sql`delete from identities where user_id in ${sql(ids)}`;
    if (ids.length) await sql`delete from users where id in ${sql(ids)}`;
  }
});

test('F-17 #11: the sign-up, rename and display-name code has no console call (source scan)', () => {
  const read = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');
  for (const f of ['./auth/attempts.ts', './handles.ts', '../app/auth/actions.ts', '../app/login/dev/page.tsx']) {
    assert.doesNotMatch(read(f), /\bconsole\.\w+\(/, f);
  }
  const act = read('../app/actions.ts');
  const login = act.slice(act.indexOf('export async function login'), act.indexOf('export async function saveThesis'));
  assert.ok(login.length > 100);
  assert.doesNotMatch(login, /\bconsole\.\w+\(/, 'app/actions.ts#login');
});
