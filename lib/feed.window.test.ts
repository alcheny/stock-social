// Known-limits sweep 2 (feed): the stepped windows (lib/feed.ts#candidateRows, WIDE_WINDOWS) answer exactly what the full
// pass answers: the same 200 in the same order and the same exploration picks with the same weight keys. Fixtures hold
// eligible traders with only old closes (no close in the window: a window's own rule would leave them out of the picks),
// more eligible traders than EXPLORE_EXTRA (the md5 walk must stop at the same 150), a trader eligible only through the
// whole record, closes imported after asOf, an ineligible and a deleted trader, and users with no close.
// Every read uses the `ids` hook; each test removes the users it made (their closes go with them).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL', timeout: 120_000 }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const DAY = 86_400_000;
type Group = { n: number; closes: number; days: (u: number, i: number) => number; ret?: (u: number, i: number) => number };

async function fixture(groups: Record<string, Group>) {
  const { sql } = await import('./db.ts');
  const tag = `fw${Math.random().toString(36).slice(2, 8)}`;
  const at = Date.now() - 60_000;
  const out: Record<string, number[]> = {};
  const all: number[] = [];
  for (const [gi, [name, g]] of Object.entries(groups).entries()) {
    const h = `${tag}${String.fromCharCode(97 + gi)}`; // handles: lowercase, at most 20 characters
    const rows = await sql`
      with a as (insert into signup_attempts (method, adult_attested_at) select 'dev', now() from generate_series(1, ${g.n}) returning id),
           k as (select id, row_number() over (order by id) as k from a)
      insert into users (handle, display_name, adult_attested_at, signup_attempt_id) select ${h} || k, ${h} || k, now(), id from k returning id`;
    const ids = rows.map((r) => r.id as number);
    out[name] = ids;
    all.push(...ids);
    const closes = ids.flatMap((u, t) => Array.from({ length: g.closes }, (_, i) => {
      const closed = at - g.days(t, i) * DAY - (t * 7 + i) * 60_000;
      return { user_id: u, sell_id: `${tag}-${name}-${t}-${i}`, account_id: 'a', symbol: `W${(t * 3 + i) % 23}`, opened_at: new Date(closed - DAY),
        closed_at: new Date(closed), return_pct: g.ret ? g.ret(t, i) : ((((t * 31 + i * 17) % 41) - 20) / 100) || 0.003, holding_days: 1, verified: true };
    }));
    for (let i = 0; i < closes.length; i += 1000) await sql`insert into closed_trades ${sql(closes.slice(i, i + 1000))}`;
  }
  return { sql, tag, groups: out, ids: all, remove: async () => { for (let i = 0; i < all.length; i += 500) await sql`delete from users where id in ${sql(all.slice(i, i + 500))}`; } };
}

// The two answers side by side: every column equal; the 200's fingerprints name their own window (never compared),
// the picks' fingerprints are the full pass's.
async function same(opts: { asOf: Date; day?: string; ids: number[] }, window: number | null) {
  const { candidateRows } = await import('./feed.ts');
  const full = await candidateRows(opts, 'full');
  const got = await candidateRows(opts);
  assert.equal(got.window, window, 'the step that answered');
  const top = (r: Record<string, unknown>) => { const { pn: _n, pm: _m, pk: _k, ...t } = r; return t; };
  assert.deepEqual(got.rows.map((r) => (r.x ? r : top(r))), full.rows.map((r) => (r.x ? r : top(r))));
  if (window !== null && window > 336) for (const r of got.rows.filter((r) => !r.x)) assert.match(String(r.pm), new RegExp(`^w${window}\\d+:\\d+$`));
  return got.rows;
}

dbTest('the 60-day step equals the full pass: the 200, the 150 picks (old-only traders included) and their weight keys', async () => {
  const f = await fixture({
    recent: { n: 50, closes: 6, days: (t, i) => 15 + ((t + i * 3) % 15) }, // 15 to 29 days: the 14-day window is empty
    oldOnly: { n: 160, closes: 5, days: (t, i) => 200 + t + i }, // eligible, no close in 60 days
    whole: { n: 3, closes: 6, days: (_t, i) => (i < 2 ? 20 : 120 + i) }, // 2 closes in the window, 4 older: eligible via the whole record
    late: { n: 2, closes: 8, days: (t, i) => 150 + t + i }, // 3 of 8 imported after asOf: 5 count
    few: { n: 2, closes: 4, days: (_t, i) => 16 + i }, // 4 closes: never eligible
    gone: { n: 2, closes: 6, days: (_t, i) => 300 + i }, // deleted before asOf
    none: { n: 40, closes: 0, days: () => 0 }, // signed up, no record
  });
  try {
    await f.sql`update closed_trades set sell_imported_at = now() + interval '1 minute' where user_id = any(${f.groups.late}) and sell_id ~ '-[567]$'`;
    await f.sql`update users set deleted_at = now() - interval '1 hour' where id = any(${f.groups.gone})`;
    const asOf = new Date(Date.now() - 30_000);
    const day = asOf.toISOString().slice(0, 10);
    const rows = await same({ asOf, day, ids: f.ids }, 60 * 24);
    const picks = rows.filter((r) => r.x);
    assert.equal(rows.length - picks.length, 200);
    assert.equal(picks.length, 150, 'more eligible traders than picks: the walk stops at 150');
    const old = new Set(f.groups.oldOnly);
    assert.ok(picks.some((r) => old.has(r.user_id)), 'an old-only trader is picked');
    for (const g of ['few', 'gone', 'none']) assert.ok(!rows.some((r) => f.groups[g].includes(r.user_id)), `${g}: never listed`);
    // Without a day (feedCandidates): the 200 only, the same.
    await same({ asOf, ids: f.ids }, 60 * 24);
  } finally {
    await f.remove();
  }
});

dbTest('the 60-day step: a trader with closes imported after asOf is picked with the full pass\'s counts (pn = pk = 5)', async () => {
  const f = await fixture({
    recent: { n: 40, closes: 6, days: (t, i) => 15 + ((t + i) % 20) },
    late: { n: 3, closes: 8, days: (t, i) => 150 + t + i },
    whole: { n: 2, closes: 6, days: (_t, i) => (i < 2 ? 25 : 90 + i) },
  });
  try {
    await f.sql`update closed_trades set sell_imported_at = now() + interval '1 minute' where user_id = any(${f.groups.late}) and sell_id ~ '-[567]$'`;
    const asOf = new Date(Date.now() - 30_000);
    const rows = await same({ asOf, day: asOf.toISOString().slice(0, 10), ids: f.ids }, 60 * 24);
    for (const id of f.groups.late) {
      const r = rows.find((x) => x.user_id === id);
      assert.ok(r?.x, 'picked');
      assert.equal(r.pn, 5);
      assert.equal(r.pk, 5);
      assert.match(String(r.pm), /^f\d+:0$/);
    }
    // A whole-record trader outside the 200 is a pick with every close at asOf counted.
    for (const id of f.groups.whole) { const r = rows.find((x) => x.user_id === id); if (r?.x) assert.equal(r.pn, 6); }
  } finally {
    await f.remove();
  }
});

dbTest('the 365-day step equals the full pass when 60 days cannot prove the 200', async () => {
  const f = await fixture({
    mid: { n: 45, closes: 6, days: (t, i) => 70 + ((t * 2 + i) % 40) }, // 70 to 109 days
    oldOnly: { n: 30, closes: 5, days: (t, i) => 500 + t + i },
  });
  try {
    const asOf = new Date(Date.now() - 30_000);
    const rows = await same({ asOf, day: asOf.toISOString().slice(0, 10), ids: f.ids }, 365 * 24);
    const picks = rows.filter((r) => r.x);
    assert.equal(picks.length, 45 + 30 - new Set(rows.filter((r) => !r.x).map((r) => r.user_id)).size, 'every eligible trader outside the 200');
    assert.ok(picks.some((r) => f.groups.oldOnly.includes(r.user_id)));
  } finally {
    await f.remove();
  }
});

dbTest('fewer than 200 capped closes in a year: the full pass answers', async () => {
  const f = await fixture({ few: { n: 20, closes: 6, days: (t, i) => 30 + t + i }, oldOnly: { n: 5, closes: 5, days: (t, i) => 400 + t + i } });
  try {
    const asOf = new Date(Date.now() - 30_000);
    const rows = await same({ asOf, day: asOf.toISOString().slice(0, 10), ids: f.ids }, null);
    assert.equal(rows.filter((r) => !r.x).length, 20 * 6 + 5 * 5, 'every close is a candidate');
  } finally {
    await f.remove();
  }
});

dbTest('every close inside 14 days but fewer than 200 capped: the 14-day statement answers as the full pass (no second pass)', async () => {
  const f = await fixture({ fresh: { n: 15, closes: 6, days: (t, i) => (t + i) % 10 }, four: { n: 2, closes: 4, days: (_t, i) => i } });
  try {
    const { candidateRows } = await import('./feed.ts');
    const asOf = new Date(Date.now() - 30_000), opts = { asOf, day: asOf.toISOString().slice(0, 10), ids: f.ids };
    const full = await candidateRows(opts, 'full');
    const got = await candidateRows(opts);
    assert.equal(got.window, 336, 'the 14-day window held every close');
    // The same rows; the fingerprints name the window ('c'), with the same counts and newest id as the full pass's ('f').
    const key = (r: Record<string, unknown>) => ({ ...r, pm: String(r.pm).replace(/^[cf]/, '') });
    assert.deepEqual(got.rows.map(key), full.rows.map(key));
    assert.ok(got.rows.every((r) => String(r.pm).startsWith('c')));
    assert.equal(got.rows.filter((r) => !r.x).length, 90);
  } finally {
    await f.remove();
  }
});

dbTest('a step whose window adds no close is skipped: closes only within 14 days and older than a year go straight to the full pass', async () => {
  const f = await fixture({ fresh: { n: 10, closes: 6, days: (t, i) => (t + i) % 10 }, ancient: { n: 10, closes: 6, days: (t, i) => 500 + t + i } });
  try {
    const asOf = new Date(Date.now() - 30_000);
    await same({ asOf, day: asOf.toISOString().slice(0, 10), ids: f.ids }, null);
  } finally {
    await f.remove();
  }
});

dbTest('code review S5: a window that adds no close still answers when the last 200 prove at its lower bound', async () => {
  // 240 closes 5 to 13 days old (the 14-day window fills the 200, but small moves score under its bound of 0.65), none
  // from 14 to 60 days, older closes 500 days back: the 60-day window holds the same closes and proves them.
  const f = await fixture({
    week: { n: 40, closes: 6, days: (t, i) => 5 + ((t + i) % 9), ret: (t, i) => ((t + i) % 2 ? 1 : -1) * (0.01 + ((t * 7 + i) % 5) / 1000) },
    ancient: { n: 5, closes: 5, days: (t, i) => 500 + t + i },
  });
  try {
    const { candidateRows, RECENT_HOURS, RECENCY_HOURS } = await import('./feed.ts');
    const asOf = new Date(Date.now() - 30_000);
    const opts = { asOf, ids: f.ids };
    const top = (await candidateRows(opts, 'full')).rows;
    assert.equal(top.length, 200);
    assert.ok(Number(top[199].score) <= Math.log1p(Number.MAX_VALUE) * Math.exp(-RECENT_HOURS / RECENCY_HOURS), 'the 14-day bound does not prove');
    await same({ ...opts, day: asOf.toISOString().slice(0, 10) }, 60 * 24);
  } finally {
    await f.remove();
  }
});
