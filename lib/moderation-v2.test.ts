// Moderation v2 (fix committee 2026-11-01, decisions 1-3). Abusive examples are paraphrased; no third-party names.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { HOLD_V2, LONG_WORDS, moderate, moderateDetail } from './moderation.ts';
import { sanitizeUserText } from './text-safety.ts';

const ZW = '​';
const RLO = '‮';
const PDF = '‬';

// [text, expected label]
const BYPASS: [string, string][] = [
  // zero-width inside a word
  [`gu${ZW}aranteed ret${ZW}urns on every entry`, 'promotion'],
  [`D${ZW}M me for the setup`, 'contact details'],
  [`copy${ZW}trading open to all`, 'copy trading'],
  // Cyrillic and Greek look-alikes
  ['сору trading is open', 'copy trading'], // Cyrillic s,o,r,u
  ['my рісks for the week', 'picks or tips'], // Cyrillic p, i, c
  ['ѕtock ѕocial pays me', 'platform claim'],
  ['vеrifiеd trader here', 'platform claim'],
  // bidi override spoof: shows as "I made 50%" but is stored reversed
  [`I made ${RLO}%05${PDF} on this`, 'return claim'],
  [`Up ${RLO}%008${PDF} this year`, 'return claim'],
  // fullwidth and Arabic-Indic figures
  ['I made ４０％ in a week', 'return claim'],
  ['my account is up ٤٠٪', 'return claim'],
  ['۳۰٪ a month, easy', 'return claim'],
  // links and domains
  ['details at https://example.org/x', 'link'],
  ['www.example.net has the plan', 'link'],
  ['see mysite.com for more', 'link'],
  ['mysite dot com for the rest', 'link'],
  ['mysite (dot) io', 'link'],
  ['mysite[dot]gg', 'link'],
  // contact
  ['write to someone@example.com', 'contact details'],
  ['someone (at) example (dot) com', 'contact details'],
  ['call 555-123-4567 today', 'contact details'],
  ['+1 (555) 123 4567', 'contact details'],
  ['ask @alpha_desk about it', 'contact details'],
  ['message me for the entry', 'contact details'],
  ['hit me up before the open', 'contact details'],
  ['more on my channel', 'contact details'],
  // solicitation and signal selling
  ['join the premium group for entries', 'promotion'],
  ['vip signals every morning', 'promotion'],
  ['alerts channel opens Monday', 'promotion'],
  ['subscribe now to get my alerts first', 'promotion'],
  ['selling my signals, cheap', 'promotion'],
  ['get rich with this one', 'promotion'],
  ['join my room', 'promotion'],
  // copy trading
  ['copy my trades and relax', 'copy trading'],
  ['mirror trading is live', 'copy trading'],
  ['just copy me', 'copy trading'],
  ['follow my trades for the rest', 'copy trading'],
  ['c0py-trad1ng open', 'copy trading'],
  // picks and tips
  ['my top picks for next week', 'picks or tips'],
  ['free tips daily', 'picks or tips'],
  ['pick of the day', 'picks or tips'],
  ['price target 120 by spring', 'picks or tips'],
  // product, verified, official claims
  ['Stock Social featured this trade', 'platform claim'],
  ['as seen on stock_social', 'platform claim'],
  ['s t o c k s o c i a l approved', 'platform claim'],
  ['verified by the team', 'platform claim'],
  ['my record is verified', 'platform claim'],
  ['v3r1f13d returns', 'platform claim'],
  ['V.E.R.I.F.I.E.D', 'platform claim'],
  ['the official account for this ticker', 'platform claim'],
  ["I'm an admin here", 'platform claim'],
  ['0ff1c1al page', 'platform claim'],
  // stated-return claims
  ['I made 40% on this', 'return claim'],
  ['we returned 120% last year', 'return claim'],
  ["I'm up 300% since spring", 'return claim'],
  ['my returns this year are 85%', 'return claim'],
  ['85% return on my account', 'return claim'],
  ['up 60% ytd', 'return claim'],
  ['YTD: +85%', 'return claim'],
  ['12% a month on average', 'return claim'],
  ['this year +40%', 'return claim'],
];

const NEGATIVE: string[] = [
  'Stop-loss at 48.20, moved to break-even after the first target',
  'Earnings beat on margins; guidance was cautious, sold into strength',
  'sold at 2x ATR',
  'Sold too early again. The plan said hold to the 20-day; I flinched on a red day.',
  'Followed the note from Сергей on the supply chain', // Cyrillic name
  'The 東京 office reopened; demand recovered', // CJK place name
  'Waited for the Αθήνα port data', // Greek place name
  'Read the note by محمد on regional demand', // Arabic name
  'gapped up 9% on earnings', '+4% premarket', 'sold half after a 12% move', 'down 3% at the open',
  'stop 8% below entry', 'revenue grew 12% y/y', 'U.S. jobs data', 'e.g. 3.5% CPI', 'Inc. guidance', 'BRK.B',
  '3.5x', 'v2.0', '10-K', 'Q3/FY25', 'approx.5', '$XYZ', '5-day', '1.5R', 'set a price alert at 50',
  'followed my plan', 'picked up shares after earnings', 'tip of the iceberg', 'sold @ 52', 'sold @52',
  'waited for the official guidance date', 'Admin me on the dashboard',
  'revenue grew 12% this quarter', 'the 1.5% daily range held', 'I hit my target and sold', 'drug approved by regulators',
  'cover if i edit the plan', 'my signal to exit was the gap', 'I get alerts from the exchange', 'I signed up for price alerts',
  'Sold.Then it ran another 5%', 'the open.Co-founder sold shares', 'Trimmed 25% of the position at 2R',
  'Q3 2024: 2025 guide 1,234,567 units', 'held 21 days; 2024-10-31 close', 'like the dot com bubble', 'the dot-com era', '',
  // every existing negative (lib/moderation.test.ts)
  'Waited for a pullback', 'low risk entry', 'can lose it all', '1000x', 'a 100 x move', 'moonshot',
  'buy the dip', 'I did buy nowhere', 'financial planning notes', 'Trimmed after earnings, stop was hit.',
];

test('bypass corpus: every entry is held, with the expected label', () => {
  for (const [t, label] of BYPASS) {
    const d = moderateDetail(t);
    assert.deepEqual(d, { status: 'held', rule: label }, JSON.stringify(t));
    assert.equal(moderate(t), 'held');
  }
});

test('bypass corpus: still held after the text is cleaned for storage (the save path)', () => {
  for (const [t] of BYPASS) assert.equal(moderateDetail(sanitizeUserText(t)).status, 'held', JSON.stringify(sanitizeUserText(t)));
});

test('negative corpus: every entry is published with no rule', () => {
  for (const t of NEGATIVE) {
    assert.deepEqual(moderateDetail(t), { status: 'published', rule: null }, JSON.stringify(t));
    assert.deepEqual(moderateDetail(sanitizeUserText(t)), { status: 'published', rule: null }, JSON.stringify(t));
  }
});

test('labels are plain category words from the closed set', () => {
  const allowed = new Set(['link', 'contact details', 'return claim', 'promotion', 'copy trading', 'picks or tips', 'platform claim']);
  for (const r of [...HOLD_V2, ...LONG_WORDS]) assert.ok(allowed.has(r.label), r.label);
  assert.ok([...HOLD_V2, ...LONG_WORDS].every((r) => !r.re.global && !r.re.sticky), 'no stateful regexes');
});

test('repeated calls give the same verdict', () => {
  for (const [t] of BYPASS) for (let i = 0; i < 3; i++) assert.equal(moderateDetail(t).status, 'held');
  for (const t of NEGATIVE) for (let i = 0; i < 3; i++) assert.equal(moderateDetail(t).status, 'published');
});

test('importing the PROMO list runs nothing (no scan, no output, no exit)', () => {
  const url = new URL('./moderation.ts', import.meta.url).href;
  const out = execFileSync(process.execPath, ['--input-type=module', '-e',
    `const m = await import(${JSON.stringify(url)}); process.stdout.write(String(m.moderate('ok')));`], { encoding: 'utf8', timeout: 20_000 });
  assert.equal(out, 'published');
  const src = readFileSync(new URL('../scripts/compliance.ts', import.meta.url), 'utf8');
  assert.match(src, /if \(import\.meta\.main\) main\(\);/);
});

test('lib/moderation.ts imports PROMO rather than spelling its phrases', () => {
  const src = readFileSync(new URL('./moderation.ts', import.meta.url), 'utf8');
  assert.match(src, /import \{ PROMO \} from '\.\.\/scripts\/compliance\.ts'/);
  assert.match(src, /SERVER-ONLY/);
});

// ---- Fix round 1 ----

// Ordinary talk about figures, someone else's numbers or a small own result: publishes.
const NEGATIVE_R1: string[] = [
  'Revenue grew 20% a year for five years.', 'Net margin 22% annualized from Q3.', 'Volatility was 30% annualized, too much for me.',
  'Shares fell 3% each day this week.', 'Sector ETF XYZE up 3% this week.', 'The index made 15% this year so beta did the work.',
  'I was up 12% then gave it back — sold at 3%.', 'My gains on this one were small, 3%.', 'Add me to the bears this time.',
  'Analyst price targets are irrelevant to me.', 'sold @ the open', 'Trimmed 40 percent of the position into strength',
  'The fund returned 25% last year, I only watched', 'Stop at 8 pct below entry', 'Exit plan: sell into the 50-day, no price target.',
  'Sold.Then it ran', 'BRK.B and U.S. data, e.g. Inc. guidance at v2.0, approx.5, 3.5x, Q3/FY25', 'Bought at 9.5, sold at 12.1',
  'my plan was to add on a retest', 'Trust the process, not the tips of the iceberg', 'Teams of analysts missed it',
  'Margin up 3% to 41% this quarter for the company', 'I got 2 alerts and ignored both', 'Me too: sold half at the open',
];

// [text, expected label]
const BYPASS_R1: [string, string][] = [
  ['see example[.]org', 'link'], ['see example(.)net', 'link'], ['hxxps://example[.]org/x', 'link'], ['example . com', 'link'],
  ['notes at example .io today', 'link'], ['example\n.com', 'link'], ['example。com', 'link'], ['mysite.de', 'link'],
  ['mysite.me for more', 'link'], ['mysite.to', 'link'], ['mysite.fm', 'link'], ['mysite.page', 'link'],
  ['D.M. me', 'contact details'], ['d m me', 'contact details'], ['D-M me for it', 'contact details'], ['dm. me', 'contact details'],
  ['my dms are open', 'contact details'], ['ask @ alpha_desk', 'contact details'], ['ask (at)alpha_desk', 'contact details'],
  ['call +44 20 7946 0958', 'contact details'], ['add me on the app', 'contact details'],
  ['pa1d signals each morning', 'promotion'], ['paid-signals', 'promotion'], ['V I P signals', 'promotion'],
  ['mirr0r my trades', 'copy trading'], ['my p1cks this week', 'picks or tips'], ['t.i.p.s inside', 'picks or tips'],
  ['price-target 300', 'picks or tips'], ['my price target is high', 'picks or tips'],
  ['vérified trader', 'platform claim'], ['verifled trader', 'platform claim'],
  ['I made 40 percent', 'return claim'], ['I made 4O%', 'return claim'], ['my port +40%', 'return claim'],
  ['portfolio up 40% since I started', 'return claim'], ['I compounded 40% per annum', 'return claim'],
  ['We made 12%/yr', 'return claim'], ['I made 15% per annum', 'return claim'], ['I averaged 3% a month', 'return claim'],
  ["I'm +40% this year", 'return claim'], ['this trade made me 50%', 'return claim'], ['I was up 3x on it', 'return claim'],
  ['my account is up 12% this month', 'return claim'], ['Up 9% this week.', 'return claim'],
];

test('fix round 1: ordinary talk publishes (no rule)', () => {
  for (const t of NEGATIVE_R1) {
    assert.deepEqual(moderateDetail(t), { status: 'published', rule: null }, JSON.stringify(t));
    assert.deepEqual(moderateDetail(sanitizeUserText(t)), { status: 'published', rule: null }, JSON.stringify(t));
  }
});

test('fix round 1: link, contact, promotion and claim bypasses are held with the expected label', () => {
  for (const [t, label] of BYPASS_R1) {
    assert.deepEqual(moderateDetail(t), { status: 'held', rule: label }, JSON.stringify(t));
    assert.equal(moderateDetail(sanitizeUserText(t)).status, 'held', JSON.stringify(sanitizeUserText(t)));
  }
});

test('fix round 1: invisible fillers inside a domain never hide it', () => {
  for (const c of ['͏', 'ㅤ', '⠀', 'ﾠ', '\u{E0041}', '᠋', '⁪']) {
    const t = `see example${c}.com`;
    assert.equal(moderateDetail(t).status, 'held', JSON.stringify(t));
    assert.equal(moderateDetail(sanitizeUserText(t)).status, 'held', JSON.stringify(t));
  }
});
