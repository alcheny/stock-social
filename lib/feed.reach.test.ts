// F-2 PR-1b (business lead, committee PR-3 §5 round 1): exploration and reach. One fixture, signed out, 7 consecutive UTC
// day seeds: 40 hot traders (many fresh small moves: they fill the 200 candidates), 60 ordinary traders and 5 newcomers
// with 5 or 6 closes. Pages 1 to 4 (the first 120 cards) with their sections, as a signed-out reader sees them.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
const DAY = 86_400_000, HOUR = 3_600_000;
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

// The trader triples that occur more than once among consecutive cards.
function repeatedRuns(traders: readonly number[]): string[] {
  const seen = new Set<string>(), rep: string[] = [];
  for (let i = 0; i + 3 <= traders.length; i++) {
    const k = traders.slice(i, i + 3).join(',');
    if (seen.has(k)) rep.push(k); else seen.add(k);
  }
  return rep;
}

test('repeatedRuns finds a repeated 3-trader run and nothing else', () => {
  assert.deepEqual(repeatedRuns([1, 2, 3, 4, 1, 2, 3]), ['1,2,3']);
  assert.deepEqual(repeatedRuns([1, 2, 3, 1, 2, 4, 1, 3, 2]), []);
});

async function makeTraders(tag: string, plan: { closes: number; rows: (t: number, i: number) => { closed: number; ret: number; hold: number } }[]) {
  const { sql } = await import('./db.ts');
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const ids: number[] = [];
  for (let t = 0; t < plan.length; t++) ids.push((await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}${t}` })).id);
  const rows = plan.flatMap((p, t) => Array.from({ length: p.closes }, (_, i) => {
    const { closed, ret, hold } = p.rows(t, i);
    return { user_id: ids[t], sell_id: `${tag}-${t}-${i}`, account_id: 'a', symbol: `${tag.slice(1, 4).toUpperCase()}${(t * 7 + i) % 60}`,
      opened_at: new Date(closed - hold * DAY), closed_at: new Date(closed), return_pct: ret || 0.01, holding_days: hold, verified: true };
  }));
  for (let i = 0; i < rows.length; i += 1000) await sql`insert into closed_trades ${sql(rows.slice(i, i + 1000))}`;
  return { ids, remove: () => sql`delete from users where id in ${sql(ids)}` };
}

dbTest('PR-1b acceptance: ≥ 80% of eligible traders and every newcomer seen in the first 120 cards over 7 day seeds; ≥ 2 of 3 rows new while such traders exist; no repeated 3-trader run in the first 60', async () => {
  const { loadFeedPage, clearFeedCache } = await import('./feed.ts');
  const { prng } = await import('./discovery/explore.ts');
  const { SECTION_AT } = await import('./discovery/section.ts');
  const r = prng(7);
  const base = Date.UTC(2026, 9, 20, 12);
  const tag = `r${Math.random().toString(36).slice(2, 8)}`;
  const plan = [
    ...Array.from({ length: 40 }, () => ({ closes: 30, rows: () => ({ closed: base - r() * 72 * HOUR - 60_000, ret: (r() * 2 - 1) * 0.08, hold: 1 + Math.floor(r() * 3) }) })),
    ...Array.from({ length: 60 }, () => ({ closes: 8 + Math.floor(r() * 13), rows: () => ({ closed: base - r() * 30 * DAY - 60_000, ret: (r() * 2 - 1) * 0.25, hold: 1 + Math.floor(r() * 40) }) })),
    ...Array.from({ length: 5 }, (_, k) => ({ closes: 5 + (k % 2), rows: () => ({ closed: base - r() * 10 * DAY - 60_000, ret: (r() * 2 - 1) * 0.1, hold: 2 + Math.floor(r() * 10) }) })),
  ];
  const f = await makeTraders(tag, plan);
  const newcomers = f.ids.slice(100);
  try {
    const seenAll = new Set<number>();
    const lines: string[] = [];
    for (let d = 0; d < 7; d++) {
      clearFeedCache();
      const now = base + d * DAY;
      const cards: number[] = [], seen = new Set<number>();
      let after: string | null | undefined, sections = 0, newRows = 0, rowsTotal = 0, withNewcomer = 0;
      for (let p = 0; p < 4; p++) {
        const page = await loadFeedPage(after, { now, ids: f.ids });
        const ids = page.cards.map((c) => c.user_id);
        if (page.section) {
          const before = new Set([...cards, ...ids.slice(0, SECTION_AT)]);
          const near = new Set(ids.slice(0, 10));
          const exists = f.ids.some((id) => !before.has(id) && !near.has(id));
          const fresh = page.section.filter((s) => !before.has(s.userId)).length;
          if (exists) assert.ok(fresh >= 2, `seed ${d} page ${p + 1}: ${fresh} of 3 rows have no earlier card`);
          // PR-1b fix round 1 (business lead demand 2, measured per section): while a newcomer has neither a card
          // earlier nor one of the 10 cards around the section, the section carries a newcomer (the slot survives the cap).
          if (newcomers.some((id) => !before.has(id) && !near.has(id))) {
            assert.ok(page.section.some((s) => newcomers.includes(s.userId)), `seed ${d} page ${p + 1}: no newcomer row`);
            withNewcomer++;
          }
          sections++; newRows += fresh; rowsTotal += page.section.length;
          for (const s of page.section) seen.add(s.userId);
        }
        cards.push(...ids);
        for (const id of ids) seen.add(id);
        after = page.next;
        if (!after) break;
      }
      assert.ok(cards.length >= 120, `seed ${d}: ${cards.length} cards`);
      const rep = repeatedRuns(cards.slice(0, 60));
      assert.deepEqual(rep, [], `seed ${d}: repeated 3-trader runs in the first 60`);
      for (const id of seen) seenAll.add(id);
      lines.push(`seed ${new Date(now).toISOString().slice(0, 10)}: ${seen.size} of 105 seen (cards ${new Set(cards.slice(0, 120)).size}), ` +
        `newcomers ${newcomers.filter((id) => seen.has(id)).length}/5, sections ${sections}, rows with no earlier card ${newRows}/${rowsTotal}, sections with a newcomer ${withNewcomer}, ` +
        `hot ${cards.slice(0, 60).filter((id) => f.ids.indexOf(id) < 40).length}/60, repeated runs ${rep.length}`);
    }
    for (const l of lines) console.log(`# reach: ${l}`);
    console.log(`# reach: union over 7 seeds ${seenAll.size} of 105 (${Math.round((100 * seenAll.size) / 105)}%)`);
    assert.ok(seenAll.size >= 0.8 * 105, `${seenAll.size} of 105 eligible traders seen`);
    for (const id of newcomers) assert.ok(seenAll.has(id), `newcomer ${id} never seen`);
  } finally {
    await f.remove();
    clearFeedCache();
  }
});

// The PR-1 skewed fixture (5 hyperactive traders, 60 fresh small closes each; 55 ordinary): the per-card discount breaks
// the fixed return order; the existing caps (≤ 5 of 10, ≤ 27 of the first 60) are pinned in lib/feed.test.ts.
dbTest('PR-1b: on the skewed fixture no 3-trader run repeats in the first 60 cards, on 7 day seeds', async () => {
  const { feedList, clearFeedCache } = await import('./feed.ts');
  const { prng } = await import('./discovery/explore.ts');
  const r = prng(42), now = Date.now();
  const plan = Array.from({ length: 60 }, (_, t) => ({ closes: t < 5 ? 60 : 6 + Math.floor(r() * 15),
    rows: () => ({ closed: now - (t < 5 ? r() * 20 * HOUR : r() * 30 * DAY) - 60_000, ret: (r() * 2 - 1) * (t < 5 ? 0.08 : 0.25), hold: 1 }) }));
  const f = await makeTraders(`s${Math.random().toString(36).slice(2, 8)}`, plan);
  try {
    for (let d = 0; d < 7; d++) {
      clearFeedCache();
      const { list } = await feedList({ asOf: new Date(now), day: new Date(now + d * DAY).toISOString().slice(0, 10), ids: f.ids });
      const ids = list.slice(0, 60).map((c) => c.user_id);
      assert.deepEqual(repeatedRuns(ids), [], `day ${d}`);
      assert.ok(ids.filter((id) => f.ids.indexOf(id) < 5).length <= 27, `day ${d}: hyperactive traders`);
    }
  } finally {
    await f.remove();
    clearFeedCache();
  }
});
