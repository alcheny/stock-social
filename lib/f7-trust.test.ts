// F-7 public-record traders: never Verified, the label and the not-joined line on every trust surface, the PUBLIC copy
// (docs/features/logs/F-7/plan.md Round 4 item 1, Round 5 items 2-6; plan-round2-engineer.md §4.3 AC 13, 18; AC 34 card
// data). Pure except the display-log case. Fictional filers and symbols only.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { MARKS, MINORS, PROMO } from '../scripts/compliance.ts';
import { cardTrust, paneTrust, rowBadge } from './pane.ts';
import { imageTrust, isPublicRecord, profileDescription, PUBLIC, publicExclusions, recordCountText, shareCardText, wholeRecordPreview, wholeRecordView, type RecordState } from './copy.ts';
import { CARD_LAYOUT, cardAlt, recordCard } from './record-card.ts';
import { monthCard } from './month-card.ts';
import type { PublicState } from './connections.ts';

const PUB: RecordState[] = ['public', 'public_demo'];
const DAY = 86_400_000;
const now = new Date(Date.UTC(2026, 9, 26, 12));
const trades = [0.1, -0.2, 0.05, -0.04, 0.3].map((r, i) => ({ symbol: `ZQX${i}`, openedAt: new Date(now.getTime() - (90 - i * 10) * DAY), closedAt: new Date(now.getTime() - (80 - i * 10) * DAY), returnPct: r, holdingDays: 10 }));

test('AC 13: paneTrust, cardTrust and rowBadge give Public filing for a filer, never Verified, even when every row says verified', () => {
  for (const state of PUB as PublicState[]) {
    for (const verified of [true, false]) {
      assert.deepEqual(paneTrust([{ verified }], state), { badge: state, incomplete: false });
      assert.equal(cardTrust({ verified }, state).badge, state);
      assert.equal(rowBadge(verified, state), state);
    }
  }
  // C11: only a fictional fixture carries Demo beside Public filing; a real filer's badge has no Demo.
  assert.equal(paneTrust([{ verified: false }], 'public').badge, 'public');
  assert.ok(isPublicRecord('public') && isPublicRecord('public_demo') && !isPublicRecord('connected') && !isPublicRecord('none'));
});

test('AC 13 / AC 34: every image, the unfurl and the previews say Public filing and that the person has not joined, never Verified', () => {
  for (const state of PUB) {
    const x = { state, demo: false, verified: true, empty: false };
    for (const kind of ['profile', 'trade', 'month', 'story'] as const) {
      const t = imageTrust(kind, x);
      assert.match(t.label!, /Public filing/);
      assert.match(t.note!, /has not joined Stock Social/);
      assert.equal(t.stats, true);
      assert.doesNotMatch(`${t.label} ${t.note}`, /verified/i);
    }
    assert.equal(state === 'public_demo', /Demo/.test(shareCardText(x).label!));
    const desc = profileDescription({ ...x, trades: 5, stats: '60% win rate · +1.0% avg return' });
    assert.match(desc, /^Public filing · Built from public filings\. This person has not joined Stock Social/);
    assert.doesNotMatch(desc, /verified/i);
    assert.doesNotMatch(desc, /Request a correction/); // the line without the link (Round 5 item 4)
    assert.doesNotMatch(recordCountText({ ...x, trades: 5 }), /verified/i);
    const preview = wholeRecordPreview({ ...x, trades: 5 }, '60% win rate');
    assert.match(preview, /Public filing/);
    assert.match(preview, /has not joined Stock Social/);
    assert.equal(wholeRecordView(x).stats, true);
    assert.equal(wholeRecordView(x).tone, null); // the pages show their own notice block, not a warning
  }
});

test('AC 34: the profile share-card data and alt carry the label and the not-joined line at >= 24 px, no Verified and no amount', () => {
  for (const state of PUB) {
    for (const kind of ['unfurl', 'square', 'story'] as const) {
      const m = recordCard({ kind, handle: 'pf_zq_one', name: 'Fictional Filer One', trades, state, demo: false, verified: false, now, link: null });
      assert.match(m.label, /Public filing/);
      assert.equal(state === 'public_demo', /Demo/.test(m.label));
      assert.match(m.note!, /has not joined Stock Social/);
      assert.ok(CARD_LAYOUT[kind].font.body >= 24, 'the note is drawn at the body size');
      assert.equal(m.newRecord, false); // C17: no New record on a public record
      const alt = cardAlt(m);
      assert.match(alt, /Public filing/);
      assert.match(alt, /has not joined Stock Social/);
      assert.doesNotMatch(alt, /verified/i);
      assert.doesNotMatch(alt, /\$|\bshares?\b|\bprice\b/i);
    }
  }
});

test('AC 34: the month share-card data carries the label and the not-joined line at >= 24 px, and no New record', () => {
  const c = monthCard({
    handle: 'pf_zq_one', displayName: 'Fictional Filer One', demo: false, verified: false, state: 'public_demo',
    recap: { label: 'October 2026', monthSoFar: false, count: 2, showHeadline: false, winRate: 0.5, avgReturn: 0.01, best: { symbol: 'ZQXA', returnPct: 0.1 }, worst: { symbol: 'ZQXB', returnPct: -0.1 } },
    record: { trades: 5, winRate: 0.6, avgReturn: 0.01, evidence: 'Too early to tell', range: null, newRecord: true },
  });
  assert.match(c.header.label!, /Public filing/);
  const note = c.bottom.find((l) => l.role === 'note')!;
  assert.match(note.text, /has not joined Stock Social/);
  assert.ok(note.size >= 24);
  assert.ok(!c.bottom.some((l) => l.role === 'new'));
  assert.doesNotMatch(JSON.stringify(c), /verified/i);
});

test('Round 4 item 1 and Round 5 items 3-5: the top block, card line and footer copy are exact', () => {
  assert.equal(PUBLIC.badge, 'Public filing');
  assert.equal(PUBLIC.kind, 'Company insider');
  assert.equal(PUBLIC.notJoined, 'Built from public filings. This person has not joined Stock Social, has not connected a broker, has not reviewed this record and does not endorse it.');
  assert.equal(PUBLIC.since('Mar 4, 2021', 'Nov 1, 2026'), 'Record since Mar 4, 2021 · last checked Nov 1, 2026');
  assert.equal(PUBLIC.correction, 'Request a correction or removal →');
  assert.equal(PUBLIC.caveat, 'Filings can be late, amended or missing.');
  assert.equal(PUBLIC.stale, 'This record may be out of date.');
  assert.equal(PUBLIC.cardLine, 'Company insider · from a public filing');
  assert.equal(PUBLIC.cardFooter, 'See their record, wins and losses →');
  assert.match(PUBLIC.badgeTitle, /Not Verified/);
  assert.match(PUBLIC.filingName('ZQXA', 'Mar 4, 2024'), /opens another site/);
});

test('AC 18: exclusion lines by reason, pluralized, only counts above 0, unknown reasons still counted', () => {
  assert.deepEqual(publicExclusions({}), []);
  const lines = publicExclusions({ no_price: 1, unreconciled: 2, derivative: 0, indirect: 3, mystery: 4 });
  assert.equal(lines.length, 4);
  assert.match(lines[0], /^1 sale excluded: no priced open-market purchase/);
  assert.match(lines[1], /^2 sales excluded: holdings didn't reconcile/);
  assert.match(lines.join(' '), /3 transactions in indirectly held shares excluded/);
  assert.match(lines.join(' '), /4 transactions excluded/);
  assert.match(publicExclusions({ derivative: 2, gift: 1, other: 1 }).join(' '), /2 derivative transactions.*1 gift.*1 other disposal/);
  assert.match(PUBLIC.openNote, /not .*full holdings/);
  assert.match(PUBLIC.openNote, /no percent/);
});

// AC 13 and legal C18: the PUBLIC copy passes the banned-claims, marks, minors and promo lists, and bans the F-7 words.
// The one negated "does not endorse" (C15, required wording) is the only use of that word.
const F7_BANNED = [/insider buying/i, /insider trading/i, /smart money/i, /\bsignals?\b/i, /\bcopy\b/i, /follow their trades/i, /trade like/i,
  /all of their trades/i, /just filed/i, /new buy/i, /\bevery trade\b/i, /\bany broker\b/i, /\bcomplete record\b/i, /\bfollow\b/i, /\bendorsed\b/i, /\brecommend/i, /\bguarantee/i];
const MARK_RE = new RegExp(`\\b(${MARKS.map((m) => m.replace(/ /g, '[\\s-]?')).join('|')})\\b`, 'i');
const MINORS_RE = new RegExp(`\\b(${MINORS.map((m) => m.replace(/ /g, '\\s')).join('|')})\\b`, 'i');
function publicStrings(): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'string') out.push(v);
    else if (typeof v === 'function') out.push(String((v as (...a: unknown[]) => unknown)('ZQXA', 'Nov 1, 2026')), String((v as (...a: unknown[]) => unknown)(2, 2)));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(PUBLIC);
  out.push(...publicExclusions({ no_price: 2, unreconciled: 1, derivative: 1, gift: 1, other: 1, indirect: 1, x: 1 }));
  return out;
}
test('AC 13: the PUBLIC copy passes the banned lists', () => {
  const all = publicStrings();
  assert.ok(all.length > 20);
  for (const s of all) {
    for (const re of [...PROMO, ...F7_BANNED]) assert.doesNotMatch(s, re, s);
    assert.doesNotMatch(s, MARK_RE, s);
    assert.doesNotMatch(s, MINORS_RE, s);
    assert.doesNotMatch(s.replace('does not endorse it', ''), /\bendorse/i, s);
  }
});

// Display log (privacy D14): a filer's row holds percents and counts only, never a raw price or share count.
const hasDb = !!process.env.DATABASE_URL;
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });
test('the display log records no amounts for a filer', { skip: !hasDb && 'no DATABASE_URL' }, async () => {
  const { sql } = await import('./db.ts');
  const { insertFiler, deleteFilers, RAW_AMOUNTS } = await import('../e2e/f7-fixture.ts');
  const { writeDisplayLog } = await import('./display-log.ts');
  const h = `pf_t${Math.random().toString(36).slice(2, 8)}`;
  await deleteFilers(sql, [h]);
  try {
    const { userId } = await insertFiler(sql, { handle: h, name: 'Fictional Filer Log', openSymbols: ['ZQXO'], closes: [{ symbol: 'ZQXA', r: 0.12, daysAgo: 40 }, { symbol: 'ZQXB', r: -0.05, daysAgo: 45 }] });
    await writeDisplayLog({ ids: [userId] });
    const [row] = await sql`select headline, range_text, open_summary, evidence from display_log where user_id = ${userId}`;
    assert.ok(row, 'a row is written');
    const text = JSON.stringify(row);
    for (const a of RAW_AMOUNTS) assert.ok(!text.includes(a), a);
    assert.doesNotMatch(text, /\$|ZQXO/);
  } finally {
    await sql`delete from display_log where user_id in (select id from users where handle = ${h})`.catch(() => {});
    await deleteFilers(sql, [h]);
  }
});

test('the Public filing badge text is at least 4.5:1 on its own background, light and dark (WCAG AA)', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const hex6 = (h: string) => (h.length === 4 ? `#${[...h.slice(1)].map((c) => c + c).join('')}` : h).toLowerCase();
  const tokens = (block: string) => Object.fromEntries([...block.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6}\b|#[0-9a-f]{3}\b)/gi)].map((m) => [m[1], hex6(m[2])]));
  const dark = tokens(css.match(/:root\s*\{([^}]*)\}/)![1]);
  const light = { ...dark, ...tokens(css.match(/@media \(prefers-color-scheme: light\)\s*\{\s*:root\s*\{([^}]*)\}/)![1]) };
  const lum = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
  const body = css.match(/\.badge\.public\s*\{([^}]*)\}/)![1];
  const fg = body.match(/color:\s*var\(--([a-z-]+)\)/)![1], bg = body.match(/background:\s*var\(--([a-z-]+)\)/)![1];
  for (const t of [dark, light]) {
    const [x, y] = [lum(t[fg]), lum(t[bg])];
    assert.ok((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) >= 4.5);
  }
});
