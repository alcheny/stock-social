// F-26 (docs/features/F-26-no-empty-note-line.md), database cases. For a viewer (signed out, or signed in as anyone but
// the trader) a held note and no note give the same loader output (feed cards, pane records, trade page and share
// payload, month recap) and run the same SQL statements; the hold rule reaches only the author's own feed card; the
// trade page's author loader finds the row's closes window with one count(*); reporting a held note answers like
// reporting a removed one. The pool lib/db.ts reuses is pre-seeded with a query-logging client (as
// lib/feed.signed-out.test.ts does). Every fixture carries a random tag and only its own users are removed.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import postgres from 'postgres';

const hasDb = !!process.env.DATABASE_URL;
const log: string[] = [];
if (hasDb) (globalThis as unknown as { sql: postgres.Sql }).sql = postgres(process.env.DATABASE_URL!, { onnotice: () => {}, debug: (_c, q) => { log.push(String(q)); } });
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);

const fx = await import('./thesis-fixtures.ts');
before(async () => { if (hasDb) await fx.ready(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const MARK = `f26mark${Math.random().toString(36).slice(2, 8)}`;
const NOTE = `Retest of the base ${MARK}, see example.com`;

// A trader with `n` closes (fixture: rebuilt from activities), one other reader.
async function fixture(n: number) {
  const { tag, ids } = await fx.people(2, 'f26');
  const closes = await fx.trades(ids[0], tag, n);
  return { tag, trader: ids[0], reader: ids[1], handle: `${tag}0`, closes };
}
async function setNote(tradeId: string, state: 'none' | 'held' | 'published') {
  const { sql } = await import('./db.ts');
  if (state === 'none') await sql`update closed_trades set thesis = null, thesis_status = null, thesis_hold_rule = null, thesis_written_at = null, thesis_edited_at = null where id = ${tradeId}`;
  else await sql`update closed_trades set thesis = ${NOTE}, thesis_status = ${state}, thesis_hold_rule = ${state === 'held' ? 'link' : null},
    thesis_written_at = now() - interval '1 day', thesis_edited_at = now() where id = ${tradeId}`;
}

// A close the feed shows as a card (the diversity caps keep only some of a trader's closes).
async function cardClose(f: Awaited<ReturnType<typeof fixture>>) {
  const { loadFeedPage } = await import('./feed.ts');
  const id = String((await loadFeedPage(undefined, { ids: [f.trader] })).cards[0].id);
  return f.closes.find((c) => c.id === id)!;
}

// Everything a viewer's loaders return for the trader, minus what moves with the clock (a card's decaying score, the
// feed cursor's asOf, the page's own timestamps).
async function viewerView(f: Awaited<ReturnType<typeof fixture>>, viewer: number | undefined, sell: string) {
  const { loadFeedPage, records } = await import('./feed.ts');
  const { loadTradeShare } = await import('./trade-share-load.ts');
  const { loadRecap } = await import('./recap-load.ts');
  const page = await loadFeedPage(undefined, { ids: [f.trader], viewer });
  const cards = page.cards.map(({ score: _s, ...c }) => c);
  const pane = await records([f.trader]);
  const trade = await loadTradeShare(f.handle, sell);
  const closed = trade!.closedAt as unknown as Date;
  const ym = `${new Date(closed).getUTCFullYear()}-${String(new Date(closed).getUTCMonth() + 1).padStart(2, '0')}`;
  const recap = await loadRecap(f.handle, ym);
  return { cards, pane, trade, recap };
}

dbTest('F-26 AC5/AC13: for a viewer a held note and no note give the same feed cards, pane records, trade payload and month recap; no held text, rule or date anywhere', async () => {
  const f = await fixture(6);
  try {
    const x = await cardClose(f);
    for (const viewer of [undefined, f.reader]) {
      await setNote(x.id, 'none');
      const none = await viewerView(f, viewer, x.sell);
      assert.ok(none.cards.some((c) => String(c.id) === x.id), 'the close is a feed card');
      await setNote(x.id, 'held');
      const held = await viewerView(f, viewer, x.sell);
      assert.deepEqual(held, none, `viewer ${viewer ?? 'signed out'}`);
      const text = JSON.stringify(held);
      assert.ok(!text.includes(MARK), 'no held text');
      assert.doesNotMatch(text, /"held"|"link"|own_hold_rule":"/);
      const card = held.cards.find((c) => String(c.id) === x.id)!;
      assert.equal(card.thesis, null); assert.equal(card.thesis_status, null);
      assert.equal(card.thesis_written_at ?? null, null); assert.equal(card.thesis_edited_at ?? null, null);
      assert.ok(!card.own_held, 'no own-held flag for a viewer');
    }
    // Published: the note reaches every viewer.
    await setNote(x.id, 'published');
    const pub = await viewerView(f, undefined, x.sell);
    assert.equal(pub.cards.find((c) => String(c.id) === x.id)!.thesis, NOTE);
    assert.equal(pub.pane.find((r) => r.id === x.id)!.thesis, NOTE);
  } finally {
    await fx.removePeople([f.trader, f.reader]);
  }
});

dbTest('F-26 AC4: the hold rule reaches only the signed-in author\'s own feed card', async () => {
  const f = await fixture(6);
  try {
    const x = await cardClose(f);
    await setNote(x.id, 'held');
    const { loadFeedPage } = await import('./feed.ts');
    const own = (await loadFeedPage(undefined, { ids: [f.trader], viewer: f.trader })).cards.find((c) => String(c.id) === x.id)!;
    assert.equal(own.own_held, true);
    assert.equal(own.own_hold_rule, 'link');
    assert.equal(own.thesis, null, 'the held text itself never rides on the card');
    const other = (await loadFeedPage(undefined, { ids: [f.trader], viewer: f.reader })).cards.find((c) => String(c.id) === x.id)!;
    assert.ok(!other.own_held);
    assert.equal(other.own_hold_rule ?? null, null);
    // Engineer demand 1: the flag follows the status, not the rule column (a published note with a leftover rule).
    const { sql } = await import('./db.ts');
    await sql`update closed_trades set thesis = ${NOTE}, thesis_status = 'published', thesis_hold_rule = 'kept' where id = ${x.id}`;
    const pubOwn = (await loadFeedPage(undefined, { ids: [f.trader], viewer: f.trader })).cards.find((c) => String(c.id) === x.id)!;
    assert.ok(!pubOwn.own_held); assert.equal(pubOwn.own_hold_rule ?? null, null); assert.equal(pubOwn.thesis, NOTE);
    await setNote(x.id, 'held');
    // The author's other closes (no note) carry no flag.
    for (const c of (await loadFeedPage(undefined, { ids: [f.trader], viewer: f.trader })).cards) if (String(c.id) !== x.id) assert.ok(!c.own_held);
  } finally {
    await fx.removePeople([f.trader, f.reader]);
  }
});

dbTest('F-26 AC10: for a viewer the feed, pane and trade loaders run the same SQL statements for a held note as for no note', async () => {
  const f = await fixture(6);
  try {
    const x = await cardClose(f);
    for (const viewer of [undefined, f.reader]) {
      const runs: string[][] = [];
      // Warm the in-memory caches first (weights), then alternate: none, held, none, held.
      for (const st of ['none', 'none', 'held', 'none', 'held'] as const) {
        await setNote(x.id, st);
        log.length = 0;
        await viewerView(f, viewer, x.sell);
        runs.push(log.slice().sort());
      }
      assert.ok(runs[1].length > 5, `${runs[1].length} statements`);
      for (let i = 2; i < runs.length; i++) assert.deepEqual(runs[i], runs[1], `run ${i} (viewer ${viewer ?? 'signed out'})`);
      // The author loader's count never runs for a viewer.
      assert.deepEqual(runs.flat().filter((q) => /x\.closed_at, x\.id\) > \(t\.closed_at, t\.id\)/.test(q)), []);
    }
  } finally {
    await fx.removePeople([f.trader, f.reader]);
  }
});

dbTest('F-26 AC12: the author loader gives the held rule and the profile link to the row\'s closes window (also beyond the first 50); one statement; nothing for a published note, no note or another user', async () => {
  const f = await fixture(56);
  try {
    const { loadOwnNote } = await import('./own-note.ts');
    const { sql } = await import('./db.ts');
    // List order: closed_at desc, id desc. The fixture's sells are an hour apart, so the oldest is the last row.
    const order = await sql`select id::text as id, trade_key from closed_trades where user_id = ${f.trader} order by closed_at desc, id desc`;
    // FIXES-CYCLE5 (F5-24): the link names the row's note field by its trade key (it survives a rebuild).
    const key = (id: string) => order.find((r) => r.id === id)!.trade_key as string;
    // Business lead demand 3: the rows at positions 50 and 51 (indexes 49 and 50), the window edge, and the oldest.
    const last = order[order.length - 1].id as string, first = order[0].id as string, p50 = order[49].id as string, p51 = order[50].id as string;
    for (const id of [last, first, p50, p51]) await setNote(id, 'held');
    log.length = 0;
    const own = await loadOwnNote(f.trader, last, f.handle);
    assert.equal(log.length, 1, 'one statement');
    assert.match(log[0], /count\(\*\)/);
    assert.deepEqual(own, { rule: 'link', edit: `/u/${f.handle}?closes=100#note-${key(last)}` });
    assert.deepEqual(await loadOwnNote(f.trader, first, f.handle), { rule: 'link', edit: `/u/${f.handle}?closes=50#note-${key(first)}` });
    assert.deepEqual(await loadOwnNote(f.trader, p50, f.handle), { rule: 'link', edit: `/u/${f.handle}?closes=50#note-${key(p50)}` });
    assert.deepEqual(await loadOwnNote(f.trader, p51, f.handle), { rule: 'link', edit: `/u/${f.handle}?closes=100#note-${key(p51)}` });
    // The profile's own window for those rows (lib/paging.ts#closesWindow over the same list order) holds them.
    const { closesWindow } = await import('./paging.ts');
    for (const [id, w] of [[p50, '50'], [p51, '100'], [last, '100']] as const) {
      const win = closesWindow(w, order.length), i = order.findIndex((r) => r.id === id);
      assert.ok(i >= win.start && i < win.start + win.shown, `${id} in window ${w}`);
    }
    // Engineer demand 2: two closes at the same time, across the window edge (rows 50 and 51), are ordered by id (desc)
    // as the profile lists them, so each link names the window the profile renders it in.
    const [a, b] = [p50, p51];
    await sql`update closed_trades set closed_at = (select closed_at from closed_trades where id = ${a}) where id = ${b}`;
    for (const id of [a, b]) await setNote(id, 'held');
    const tied = await sql`select id::text as id from closed_trades where user_id = ${f.trader} order by closed_at desc, id desc`;
    const { windowOf } = await import('./paging.ts');
    const ws = [];
    for (const id of [a, b]) {
      const w = windowOf(tied.findIndex((r) => r.id === id));
      ws.push(w);
      assert.equal((await loadOwnNote(f.trader, id, f.handle))!.edit, `/u/${f.handle}?closes=${w}#note-${key(id)}`);
    }
    assert.deepEqual(ws.sort(), [100, 50], 'one on each side of the edge');
    assert.equal(await loadOwnNote(f.reader, last, f.handle), null, 'another user');
    await setNote(last, 'published');
    assert.equal(await loadOwnNote(f.trader, last, f.handle), null, 'published');
    await setNote(last, 'none');
    assert.equal(await loadOwnNote(f.trader, last, f.handle), null, 'no note');
    assert.equal(await loadOwnNote(f.trader, 'x1', f.handle), null, 'malformed id');
  } finally {
    await fx.removePeople([f.trader, f.reader]);
  }
});

dbTest('F-26 AC11: reporting an already-held note gets the same answer as reporting a note its author removed', async () => {
  const f = await fixture(2);
  try {
    const { reportThesis, reportMessage } = await import('./reports.ts');
    const yes = { allow: () => true };
    const [held, removed] = f.closes;
    await setNote(held.id, 'held');
    await setNote(removed.id, 'published');
    await setNote(removed.id, 'none'); // the author removed it
    const a = await reportThesis(f.reader, held.id, yes);
    const b = await reportThesis(f.reader, removed.id, yes);
    assert.equal(a, b);
    assert.equal(reportMessage(a), reportMessage(b));
    const { sql } = await import('./db.ts');
    assert.equal((await sql`select count(*)::int as n from thesis_reports where reporter_id = ${f.reader}`)[0].n, 0, 'nothing written for either');
  } finally {
    await fx.removePeople([f.trader, f.reader]);
  }
});
