// F-16 follow-up (owner decision 2026-11-02): the owner-run account deletion against the database. The audit row
// (trust_deletions) commits with the deletion mark: a failing audit insert or a wrong --confirm deletes nothing. The
// deletion is deleteProfile's; the audit row outlives the account and names no one (OD 2.22: date, reason code, counts).
// Each test's audit rows carry the test's own actor role word, so assertions and cleanup touch only its own rows. Scoped to this file's own users (shared database);
// the vendor and billing steps are injected no-ops.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { hasDb, people, ready, removePeople, trades } from './thesis-fixtures.ts';
import type { OwnerDeleteDeps } from './owner-delete.ts';

const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await ready(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });
const lines = () => { const l: string[] = []; return { out: (s: string) => { l.push(s); }, l }; };

async function deps(audit?: OwnerDeleteDeps['audit']) {
  const { defaultOwnerDeleteDeps } = await import('./owner-delete.ts');
  return {
    audit: audit ?? defaultOwnerDeleteDeps.audit,
    profile: { deleteVendorUser: async () => {}, endBilling: async () => {} },
  };
}
async function state(userId: number, handle: string, actor: string) {
  const { sql } = await import('./db.ts');
  const [c] = await sql`select
    (select count(*)::int from users where id = ${userId}) as users,
    (select count(*)::int from users where id = ${userId} and deleted_at is not null) as marked,
    (select count(*)::int from closed_trades where user_id = ${userId}) as trades,
    (select count(*)::int from trust_deletions where actor = ${actor}) as audits,
    (select count(*)::int from handle_reservations where handle = ${handle}) as holds`;
  return { ...c };
}
async function cleanup(ids: number[], handles: string[], actors: string[]) {
  const { sql } = await import('./db.ts');
  await removePeople(ids);
  // This file's own rows: the audit rows of its own actor words, and the holds on its own handles.
  await sql`delete from trust_deletions where actor in ${sql(actors)}`;
  await sql`delete from handle_reservations where handle in ${sql(handles)}`;
}

dbTest('owner delete: deletes through deleteProfile, writes one audit row (date, reason, actor, counts; no user id) that outlives the account', async () => {
  const { sql } = await import('./db.ts');
  const { ownerDeleteAccount, deletionHistory } = await import('./owner-delete.ts');
  const { tag, ids: [u] } = await people(1, 'f16d');
  const handle = `${tag}0`;
  try {
    await trades(u, tag, 2);
    await sql`update closed_trades set thesis = 'Sold into strength; f16 owner delete note.', thesis_status = 'published' where id = (select min(id) from closed_trades where user_id = ${u})`;
    assert.equal(await ownerDeleteAccount(u, 'under-18-founded', handle, tag, await deps()), true);
    assert.deepEqual(await state(u, handle, tag), { users: 0, marked: 0, trades: 0, audits: 1, holds: 1 });
    const h = await deletionHistory(10, { actor: tag });
    assert.deepEqual(h.map((r) => [r.reason, r.actor, r.counts]), [['under-18-founded', tag, { closed_trades: 2, activities: 4, open_positions: 0, notes: 1, reports: 0 }]]);
    assert.ok(h[0].at instanceof Date);
    const cols = (await sql`select column_name from information_schema.columns where table_name = 'trust_deletions' order by column_name`).map((r) => r.column_name);
    assert.deepEqual(cols, ['activities', 'actor', 'at', 'closed_trades', 'id', 'notes', 'open_positions', 'reason', 'reports']);
    const fks = await sql`select 1 from information_schema.table_constraints where table_name = 'trust_deletions' and constraint_type = 'FOREIGN KEY'`;
    assert.equal(fks.length, 0);
    // No account with that id any more: nothing is written.
    assert.equal(await ownerDeleteAccount(u, 'under-18-founded', handle, tag, await deps()), false);
    assert.equal((await deletionHistory(10, { actor: tag })).length, 1);
  } finally { await cleanup([u], [handle], [tag]); }
});

dbTest('owner delete: a failing audit insert deletes nothing (no mark, no removed rows, no audit row)', async () => {
  const { ownerDeleteAccount } = await import('./owner-delete.ts');
  const { run } = await import('../scripts/owner-delete.ts');
  const { tag, ids: [u] } = await people(1, 'f16e');
  const handle = `${tag}0`;
  try {
    await trades(u, tag, 2);
    const before = await state(u, handle, tag);
    assert.deepEqual(before, { users: 1, marked: 0, trades: 2, audits: 0, holds: 0 });
    const failing = await deps(async () => { throw new Error('audit insert failed'); });
    await assert.rejects(ownerDeleteAccount(u, 'under-18-founded', handle, tag, failing), /audit insert failed/);
    assert.deepEqual(await state(u, handle, tag), before);
    // The same through the CLI.
    await assert.rejects(run([String(u), 'under-18-founded', `--confirm=${handle}`, `--actor=${tag}`], lines().out, {}, failing), /audit insert failed/);
    assert.deepEqual(await state(u, handle, tag), before);
  } finally { await cleanup([u], [handle], [tag]); }
});

dbTest('owner delete: the actor CHECK rolls the mark back when the insert itself fails in the database', async () => {
  const { ownerDeleteAccount, defaultOwnerDeleteDeps } = await import('./owner-delete.ts');
  const { tag, ids: [u] } = await people(1, 'f16g');
  const handle = `${tag}0`;
  try {
    const before = await state(u, handle, tag);
    // Bypass the library's actor check to reach the table's own CHECK: the insert fails inside the marking transaction.
    const bad = await deps((tx, row) => defaultOwnerDeleteDeps.audit(tx, { ...row, actor: 'Not A Role' }));
    await assert.rejects(ownerDeleteAccount(u, 'owner-decision', handle, tag, bad), /check constraint/i);
    assert.deepEqual(await state(u, handle, tag), before);
  } finally { await cleanup([u], [handle], [tag]); }
});

dbTest('owner delete CLI: --confirm must equal the current handle; a wrong one, a missing one, a bad reason or actor deletes nothing', async () => {
  const { run } = await import('../scripts/owner-delete.ts');
  const { tag, ids: [u, other] } = await people(2, 'f16c');
  const handle = `${tag}0`;
  try {
    const before = await state(u, handle, tag);
    const d = await deps();
    for (const argv of [
      [String(u), 'under-18-founded', `--confirm=${tag}1`], // the other account's handle: a typo'd id
      [String(u), 'under-18-founded', `--confirm=${handle.toUpperCase()}`],
      [String(u), 'under-18-founded', '--confirm='],
      [String(u), 'under-18-founded'],
      [String(u), 'may-be-under-18', `--confirm=${handle}`],
      [String(u), 'under-18-founded', `--confirm=${handle}`, '--actor=Some Person'],
      [String(u), 'under-18-founded', `--confirm=${handle}`, '--actor=someone@example.com'],
      ['x1', 'under-18-founded', `--confirm=${handle}`],
      [String(u), `--confirm=${handle}`],
    ]) {
      const o = lines();
      assert.equal(await run(argv, o.out, {}, d), 2, argv.join(' '));
      assert.ok(o.l.length > 0);
    }
    assert.deepEqual(await state(u, handle, tag), before);
    assert.equal((await state(other, `${tag}1`, tag)).users, 1);
    const o = lines();
    assert.equal(await run([String(u), 'under-18-founded', `--confirm=${handle}`, `--actor=${tag}`], o.out, {}, d), 0);
    assert.match(o.l.join('\n'), /Account deleted\. Next: review the sign-up age gate/);
    assert.equal((await state(u, handle, tag)).users, 0);
    const h = lines();
    assert.equal(await run(['history', `--actor=${tag}`], h.out, {}, d), 0);
    assert.match(h.l[0], new RegExp(`\\tdelete\\tunder-18-founded\\t${tag}\\ttrades 0\\tactivities 0\\tpositions 0\\tnotes 0\\treports 0$`));
    assert.equal(await run(['history', String(u)], lines().out, {}, d), 2); // history takes no user id: the log names no one
    // TRUST_ACTOR names the role when no --actor is given.
    const lead = `${tag}-lead`;
    assert.equal(await run([String(other), 'owner-decision', `--confirm=${tag}1`], lines().out, { TRUST_ACTOR: lead }, d), 0);
    const [r] = await (await import('./db.ts')).sql`select actor, reason from trust_deletions where actor = ${lead}`;
    assert.deepEqual({ ...r }, { actor: lead, reason: 'owner-decision' });
  } finally { await cleanup([u, other], [handle, `${tag}1`], [tag, `${tag}-lead`]); }
});

dbTest('owner delete: a failed vendor step leaves the account marked with its audit row; a re-run finishes the same path', async () => {
  const { ownerDeleteAccount } = await import('./owner-delete.ts');
  const { tag, ids: [u] } = await people(1, 'f16v');
  const handle = `${tag}0`;
  try {
    const { sql } = await import('./db.ts');
    await sql`update users set snaptrade_user_id = ${`${tag}-v`}, snaptrade_secret_enc = 'x' where id = ${u}`;
    const failing = { audit: (await deps()).audit, profile: { deleteVendorUser: async () => { throw new Error('vendor down'); }, endBilling: async () => {} } };
    await assert.rejects(ownerDeleteAccount(u, 'under-18-founded', handle, tag, failing), /vendor down/);
    assert.deepEqual(await state(u, handle, tag), { users: 1, marked: 1, trades: 0, audits: 1, holds: 0 });
    assert.equal(await ownerDeleteAccount(u, 'under-18-founded', handle, tag, await deps()), true);
    assert.deepEqual(await state(u, handle, tag), { users: 0, marked: 0, trades: 0, audits: 2, holds: 1 });
  } finally { await cleanup([u], [handle], [tag]); }
});
