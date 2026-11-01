// Moderation v2 (fix committee 2026-11-01, decisions 1-3). Abusive examples are paraphrased; no third-party names.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { figures, HOLD_V2, LONG_WORDS, moderate, moderateDetail, RULE_EXPLAIN } from './moderation.ts';
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

// ---- Fix round 2 (tester round 2 + business lead; committee accepted the revision of decision 2) ----

// A decimal point is not a sentence break; a singular "my pick" is talk; "verified" and copy trading hold only as
// claims or offers; macro and fundamental figures with a time total publish.
const NEGATIVE_R2: string[] = [
  'Inflation ran 3.2% annualized last quarter.', 'Unemployment ticked to 4.3% this month.', 'Revenue grew 20.5% a year for five years.',
  'Dividend yield 4.2% a year.', 'CPI rose 0.3% this month.', 'Index up 1.5% this week.',
  'Mid-cap index up 11% this year; my pick was flat.', 'My pick was wrong.', 'Our pick of entry was poor.', 'My tip: size small.',
  'Bought on an unverified rumor', 'Verified the guidance raise on the call', 'Copy trading names were hot so I sold',
  'Copy trading platforms looked crowded, so I passed.', 'my plan is simple', 'my stop is 52', 'my stop is 52.40', 'my risk is 1R',
  'my target is the 50-day', 'my exit is fy25 guidance', 'my price alerts fired twice', 'my alerts are set at 50',
  'Shares fell 40% in 2 weeks.', '40% in 2 weeks for the sector.', 'Up 25% since March for the index.', 'Up 12% on earnings, sold half.',
  'Revenue doubled this year.', 'I doubled down on the dip.', 'I doubled my position at 50.', 'find me at the open, I trade the first hour',
  'Streaming subscribers grew 5% this quarter.', 'Sold one hundred shares at the open.', 'Analysts call it the pick of the litter',
];

// [text, expected label]
const BYPASS_R2: [string, string][] = [
  // picks, tips and price targets
  ['my top 3 picks', 'picks or tips'], ['my favorite picks this week', 'picks or tips'], ['my picks', 'picks or tips'],
  ['target price 300', 'picks or tips'], ['PT 300', 'picks or tips'], ["today's pick", 'picks or tips'], ['today’s pick: XYZ', 'picks or tips'],
  ['Pick of the week is in', 'picks or tips'],
  // subject-dropped and figure-free return claims
  ['Made 60% this year with this system.', 'return claim'], ['Returns this year: 75%.', 'return claim'],
  ['Up 85% since spring on my swing setup.', 'return claim'], ['Doubled my money twice this year.', 'return claim'],
  ['Tripled the account in 6 months.', 'return claim'], ['I am up two hundred percent.', 'return claim'], ['made 40% this year', 'return claim'],
  ['40% in 2 weeks on my setup.', 'return claim'], ['40% in 2 weeks, all on my system.', 'return claim'], ['40% this qtr', 'return claim'],
  ['40% annual', 'return claim'], ['40% a yr', 'return claim'], ["We're up fifty percent.", 'return claim'],
  ['Up 30% since March on my account.', 'return claim'], ['Made 30% since 2025.', 'return claim'],
  // verified: a claim about the self, the account, the record, the trades or the platform
  ["I'm verified", 'platform claim'], ['verified trader', 'platform claim'], ['my record is verified', 'platform claim'],
  ['verified returns', 'platform claim'], ['stock social verified', 'platform claim'], ['I am a verified trader', 'platform claim'],
  ['All my trades are verified.', 'platform claim'], ['verified', 'platform claim'],
  // copy trading: the solicitation and the offer
  ['replicate my trades', 'copy trading'], ['tail my trades', 'copy trading'], ['mirror my moves', 'copy trading'], ['trade with me', 'copy trading'],
  ['auto-copy is open for members', 'copy trading'], ['copy trading spots open', 'copy trading'],
  // contact and promotion
  ['msg me', 'contact details'], ['find me at example_trader on the bird app', 'contact details'], ['my chat app is alpha_desk', 'contact details'],
  ['my handle there is trader2024', 'contact details'], ['subscribers get the entries first', 'promotion'], ['my alerts go out at 9', 'promotion'],
];

test('fix round 2: decimals, singular picks, ordinary "verified" and copy-trading talk publish (no rule)', () => {
  for (const t of NEGATIVE_R2) {
    assert.deepEqual(moderateDetail(t), { status: 'published', rule: null }, JSON.stringify(t));
    assert.deepEqual(moderateDetail(sanitizeUserText(t)), { status: 'published', rule: null }, JSON.stringify(t));
  }
});

test('fix round 2: picks, dropped-subject returns, self-verification, copy offers, handles and alert services are held', () => {
  for (const [t, label] of BYPASS_R2) {
    assert.deepEqual(moderateDetail(t), { status: 'held', rule: label }, JSON.stringify(t));
    assert.equal(moderateDetail(sanitizeUserText(t)).status, 'held', JSON.stringify(sanitizeUserText(t)));
  }
});

test('fix round 2: number words read as figures', () => {
  assert.equal(figures('up two hundred percent'), 'up 200%');
  assert.equal(figures('fifty-five pct'), '55%');
  assert.equal(figures('one hundred and twenty percent'), '120%');
  assert.equal(figures('one hundred shares'), 'one hundred shares');
});

test('fix round 2: every label has a plain explanation', () => {
  for (const r of [...HOLD_V2, ...LONG_WORDS]) assert.ok(RULE_EXPLAIN[r.label], r.label);
  assert.deepEqual(RULE_EXPLAIN, {
    link: 'a link or web address', 'contact details': 'contact details or an @mention', promotion: 'a promotion',
    'picks or tips': 'a stock recommendation or price target', 'platform claim': 'a claim about this site or being verified',
    'return claim': 'a return claim beyond this trade', 'copy trading': 'an offer to copy trades',
  });
});

// ---- Fix round 3 (tester round 3 + business lead; committee decisions 2-3, POLICY F1/F2) ----

// A small figure about this one trade, with a span, is how a trade is described; third-party targets, singular own
// picks, past-tense buying, prose dots and a DM'd company publish.
const NEGATIVE_R3: string[] = [
  // item 1: small first-person figures about this trade with a time span
  'Up 4% this week on the position, trimmed.', 'I made 6% on this trade in 2 weeks.', 'Made 6% in 2 weeks, sold before earnings.',
  'Gained 4% over 3 weeks then stopped out.', '+5% this month on this name.', 'Returned 5% over 2 weeks, beat holding cash.',
  'I made 8% in 2 weeks on this trade',
  // item 2: singular picks, scale-out targets and third-party targets
  'Not my best pick, cut it at -4%.', 'Best pick I had all year, sold too early.', 'Top pick from my screen, faded.',
  'Took profit at PT 1, rest at pt 2', "Analysts' PT is 300 but I sold.", "PT 60 from the bank upgrade, I didn't care.",
  // item 3
  "DM'd the IR team about the guidance",
  // item 4: past tense, an existing negative, and a win rate without a figure
  'Target was 52, hit it.', 'I bought it now that the base is set', 'Buy the dip worked this time', 'My win rate this month was bad',
  'I lose often on breakouts',
  // item 5
  'Sold $5k of it to rebalance', 'Position was $2k', 'Revenue $40B this year',
  // item 6
  'my plan is simple', 'My group is small this year.', 'my chat is quiet', 'Got a snap reaction at the open.',
  // item 7
  'the company com­pleted the buyback', 'Time to connect the dots on margins.', 'Felt like the dotcom bubble again.',
  'Valuations looked dotcom bubble crazy.', 'Bought in the dotcom era.',
  // negations and ordinary phrasing beside the new hype rules
  "Wouldn't buy it now", "Couldn't get in.", 'We never lose sight of risk', 'Bought before it ran', 'Made $500 on this trade this week',
];

// [text, expected label]
const BYPASS_R3: [string, string][] = [
  // item 1: the existing holds stay held
  ['made 40% this year', 'return claim'], ['Made 60% this year with this system.', 'return claim'], ['Returns this year: 75%.', 'return claim'],
  ['40% this qtr', 'return claim'], ['my port +40%', 'return claim'], ['Up 9% this week.', 'return claim'],
  ['I made 6% in 2 weeks on my account.', 'return claim'], ['Made 6% in 2 weeks with my system.', 'return claim'],
  ['Up 5% this year on this name.', 'return claim'], ['I averaged 3% a month on this trade', 'return claim'],
  // item 2
  ['my top picks', 'picks or tips'], ["today's top pick", 'picks or tips'], ['hot picks', 'picks or tips'], ['free picks', 'picks or tips'],
  ['PT $200', 'picks or tips'], ['my PT 300', 'picks or tips'], ['target price 300', 'picks or tips'], ['PT 300', 'picks or tips'],
  ['price target 120 by spring', 'picks or tips'],
  // item 3
  ['DM for entries', 'contact details'], ['DM for entries 📩', 'contact details'], ['DM for the setup', 'contact details'],
  ['dm 4 setups', 'contact details'], ['DMs open for entries', 'contact details'], ['message for alerts', 'contact details'],
  // item 4
  ['buy it now', 'promotion'], ['buy right now', 'promotion'], ['Best penny stock to buy right now', 'promotion'], ['load up now', 'promotion'],
  ['load up before it runs', 'promotion'], ['buy today before it rips', 'promotion'], ['Next 100 bagger, load up', 'promotion'],
  ['Strong buy, target 500', 'promotion'], ['Target: 300 next month, get in', 'promotion'], ['Everyone should buy this', 'promotion'],
  ['BUY BUY BUY', 'promotion'], ['I never lose, 100% win rate', 'promotion'], ['My signals are 95% accurate', 'return claim'],
  ['Verified: 92% win rate', 'return claim'], ['Verified 92% win rate', 'return claim'], ['verified track: 92% wins', 'return claim'],
  // item 5
  ['Made $50k this month', 'return claim'], ['I made $12k this week', 'return claim'], ['Up $40k this year', 'return claim'],
  ['Turned 1k into 50k', 'return claim'], ['Turned $1,000 into $40,000', 'return claim'],
  // item 6
  ['My tele is tradeking', 'contact details'], ['My tg: tradeking', 'contact details'], ['find me on tele: tradeking', 'contact details'],
  ['my insta is tradeking', 'contact details'], ['my group: tradeking', 'contact details'],
  // item 7
  ['www tradeking com', 'link'], ['tradeking com/join', 'link'], ['tradeking dot c o m', 'link'],
];

test('fix round 3: small single-trade figures, singular picks, third-party targets and prose dots publish (no rule)', () => {
  for (const t of NEGATIVE_R3) {
    assert.deepEqual(moderateDetail(t), { status: 'published', rule: null }, JSON.stringify(t));
    assert.deepEqual(moderateDetail(sanitizeUserText(t)), { status: 'published', rule: null }, JSON.stringify(t));
  }
});

test('fix round 3: DM offers, hype, win-rate and dollar claims, messenger handles and dotless domains are held', () => {
  for (const [t, label] of BYPASS_R3) {
    assert.deepEqual(moderateDetail(t), { status: 'held', rule: label }, JSON.stringify(t));
    assert.equal(moderateDetail(sanitizeUserText(t)).status, 'held', JSON.stringify(sanitizeUserText(t)));
  }
});

test('fix round 3: adversarial 280-character inputs finish in under 20 ms each', () => {
  const inputs = [
    'A-'.repeat(140).slice(0, 279) + '!', 'a-'.repeat(140), '1.'.repeat(140), 'a.'.repeat(140), 'a '.repeat(140), 'my '.repeat(93),
    'aaaa'.repeat(70), 'a'.repeat(279) + '!', '-'.repeat(280), 'a.b-'.repeat(70), '%1'.repeat(140), '1 '.repeat(140), 'dot '.repeat(70),
    '@a'.repeat(140), 'up 1% '.repeat(46), 'www '.repeat(70), 'a dot '.repeat(46), 'x@'.repeat(140), '+1 '.repeat(93), 'buy '.repeat(70),
  ].map((s) => s.slice(0, 280));
  // Best of three runs: the first call compiles each expression; a polynomial pattern is slow on every run.
  for (const t of inputs) {
    let ms = Infinity;
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      moderateDetail(t);
      ms = Math.min(ms, performance.now() - t0);
    }
    assert.ok(ms < 20, `${JSON.stringify(t.slice(0, 12))}… took ${ms.toFixed(1)} ms`);
  }
});

// ---- Fix round 4 (false holds on ordinary trading talk; the calls and claims stay held) ----

const NEGATIVE_R4: string[] = [
  'I never lose more than 1R per trade.', 'Strong buy volume at the open.', "Strong buy rating from the street didn't help.",
  'Next 10 bagger? Doubt it.', 'Get in early or not at all is a bad rule.',
  'Phase 3 trial had a 70% success rate, sold into the readout.', 'Analysts have a 70% hit rate on this name.',
  'PT 60, stop 48.', 'Hit PT 120 early. Done.', 'pt 3.5 hit', 'Took profits at pt 6 per my plan',
  'They turned 5 into 10 stores this year.', 'Strong buy pressure faded into the close.',
  // a past-tense own target is a reflection, not a call
  'My PT was 60',
];

// [text, expected label]
const BYPASS_R4: [string, string][] = [
  ['my PT is 300', 'picks or tips'], ['my PT 300', 'picks or tips'], ['PT $200', 'picks or tips'], ['target price 300', 'picks or tips'],
  ['PT 300', 'picks or tips'], ['price target 120 by spring', 'picks or tips'], ['it will hit PT 300', 'picks or tips'],
  ['I never lose', 'promotion'], ['I never lose money', 'promotion'], ['Strong buy, target 500', 'promotion'], ['Strong buy.', 'promotion'],
  ['XYZ is a strong buy', 'promotion'], ['Strong buy on XYZ', 'promotion'], ['BUY BUY BUY', 'promotion'],
  ['Next 100 bagger, load up', 'promotion'], ['Next 10 bagger!', 'promotion'], ['get in early!', 'promotion'], ['get in now', 'promotion'],
  ['My signals are 95% accurate', 'return claim'], ['I never lose, 100% win rate', 'promotion'], ['92% win rate', 'return claim'],
  ['I have a 90% win rate', 'return claim'], ['our calls hit 80% accuracy', 'return claim'],
  ['Turned 1k into 50k', 'return claim'], ['Turned $1,000 into $40,000', 'return claim'], ['Turned my account into $40k', 'return claim'],
  ['turned 5000 into 20000', 'return claim'],
];

test('fix round 4: trading talk around targets, win rates, "strong buy", baggers and "turned into" publishes (no rule)', () => {
  for (const t of NEGATIVE_R4) {
    assert.deepEqual(moderateDetail(t), { status: 'published', rule: null }, JSON.stringify(t));
    assert.deepEqual(moderateDetail(sanitizeUserText(t)), { status: 'published', rule: null }, JSON.stringify(t));
  }
});

test('fix round 4: own targets, calls, "never lose", win-rate and money "turned into" claims stay held', () => {
  for (const [t, label] of BYPASS_R4) {
    assert.deepEqual(moderateDetail(t), { status: 'held', rule: label }, JSON.stringify(t));
    assert.equal(moderateDetail(sanitizeUserText(t)).status, 'held', JSON.stringify(sanitizeUserText(t)));
  }
});

// ---- Fix round 5 (independent review: bypasses, false holds, rate claims) ----

const HY = String.fromCodePoint(0x2010); // hyphen
// [text, expected label]
const BYPASS_R5: [string, string][] = [
  ['g.u.a.r.a.n.t.e.e.d returns', 'promotion'], ['gu4rant33d returns', 'promotion'], ['r1sk-free income', 'promotion'],
  [`risk${HY}free profits`, 'promotion'], ['dm🔥me', 'contact details'], ['join🔥my🔥group', 'promotion'],
  ['copy🔥my🔥trades', 'copy trading'], ['e x a m p l e . c o m', 'link'],
  // item 4: rate claims
  ['I average 30% a month', 'return claim'], ['Avg 30% per month on my system', 'return claim'], ['Doing 30% monthly. Ask me', 'return claim'],
  ["I'm pulling 25% a month", 'return claim'],
];
const NEGATIVE_R5: string[] = [
  'Decided it was time to sell after the second miss.', 'Semis outperform when rates fall, so I sized up.',
  'The company does not make money yet; sold.', 'It was a hot stock in 2021 and I bought late.',
  'Buy now pay later names sold off and I exited.', 'Copy this trade? No.',
  // item 4: one trade over a span; position talk with a rate verb but no time total
  'Gained 35% in 4 months; sold into the run-up', "I'm doing 25% trims into strength.",
];

test('fix round 5: leet, squashed, emoji-split and dash look-alike bypasses and rate claims are held', () => {
  for (const [t, label] of BYPASS_R5) {
    assert.deepEqual(moderateDetail(t), { status: 'held', rule: label }, JSON.stringify(t));
    assert.equal(moderateDetail(sanitizeUserText(t)).status, 'held', JSON.stringify(sanitizeUserText(t)));
  }
});

test('fix round 5: generic words from the scanner list, the payment-plan phrase and one-trade spans publish (no rule)', () => {
  for (const t of NEGATIVE_R5) {
    assert.deepEqual(moderateDetail(t), { status: 'published', rule: null }, JSON.stringify(t));
    assert.deepEqual(moderateDetail(sanitizeUserText(t)), { status: 'published', rule: null }, JSON.stringify(t));
  }
  // The offer and claim forms of the same lists still hold, and the frozen HOLD entry still holds a plain call.
  for (const t of ['buy now before earnings', 'guaranteed returns', 'risk free', 'you should buy this', 'passive income daily', 'top picks inside', 'Copy my trades'])
    assert.equal(moderate(t), 'held', t);
});

test('fix round 5: the start-up re-check applies only rules newer than the version a note was checked at', async () => {
  const { MODERATION_VERSION } = await import('./moderation.ts');
  assert.equal(MODERATION_VERSION, 4); // fix rounds 6 and 7 and F4-18 raised it (the tests below and lib/moderation.test.ts pin what versions 2, 3 and 4 add)
  assert.ok(HOLD_V2.every((r) => (r.since ?? 1) <= MODERATION_VERSION));
  // A note checked at the current version matches nothing new; a note from main's rules (version 0) is matched by
  // every rule of this branch, but not by the frozen HOLD on its raw text (it passed that when it was saved).
  assert.deepEqual(moderateDetail('DM me, join my group', { after: MODERATION_VERSION }), { status: 'published', rule: null });
  assert.equal(moderateDetail('see example.com', { after: 0 }).status, 'held');
  assert.equal(moderateDetail('see example.com').status, 'held');
});

// ---- Fix round 6 (independent re-check: period rates, spelled-out phrases, calls to act) ----

// [text, expected label]
const BYPASS_R6: [string, string][] = [
  // item 1: a return figure tied to a period is a claim, with or without a subject or a verb
  ['my avg is 30% a month', 'return claim'], ['my average is 40% a year', 'return claim'], ['my avg is 30% monthly', 'return claim'],
  ['avg is 30% a month', 'return claim'], ['my avg = 30%/mo', 'return claim'], ['avg return 8%/wk', 'return claim'],
  ['average of 4% a week', 'return claim'], ['avg 5% weekly', 'return claim'], ['averaging 5% weekly', 'return claim'],
  ['I avg 5% per wk', 'return claim'], ['avg monthly 30%', 'return claim'], ['I make 5% weekly', 'return claim'],
  ['Avg 5% weekly', 'return claim'], ['5% weekly, every week.', 'return claim'], ['We average 2% daily.', 'return claim'],
  ['My returns are 5% weekly.', 'return claim'], ['Making 3% a day on this setup.', 'return claim'], ['8%/wk. Ask how.', 'return claim'],
  ['I make 12% annually', 'return claim'], ['avg yearly return: 60%', 'return claim'],
  // item 2: multi-word phrases spelled out letter by letter
  ['t o t h e m o o n', 'promotion'], ['g e t r i c h', 'promotion'], ['e a s y m o n e y', 'promotion'],
  ['b e a t t h e m a r k e t', 'promotion'], ['f i n a n c i a l a d v i c e', 'promotion'], ['d m m e', 'contact details'],
  ['j o i n m y group', 'promotion'], ['r i s k f r e e', 'promotion'], ['m y p i c k s', 'picks or tips'],
  // item 3: calls to act
  ['Time to buy $XYZ, everyone.', 'promotion'], ['Time to buy!', 'promotion'], ['time to sell your shares now', 'promotion'],
  ['Copy this trade.', 'promotion'], ['hot stock alert: $XYZ', 'promotion'], ['This strategy outperforms the market', 'promotion'],
  ['I make money every week with this', 'promotion'], ["It's time to buy.", 'promotion'], ['Guys, time to sell.', 'promotion'],
  ['Hot stock: $XYZ', 'promotion'], ['You make money each month with this', 'promotion'], ['My system outperforms, folks.', 'promotion'],
  // nit 4: the Latin script g
  ['ɡet rich quick', 'promotion'],
];
// Ordinary talk that must keep publishing next to the round 6 rules.
const NEGATIVE_R6: string[] = [
  // item 1: third-party rates, figures attached to third-party nouns, and rate words with no period
  'Revenue averaged 12% a year for a decade.', 'The index averages 7% a year over long periods.', 'CPI averaged 0.3% a month.',
  'Dividend growth averaged 6% annually.', 'Analysts average 10% a year for earnings.', 'Shares averaged 2% daily moves this week.',
  'My average loss is 2% per trade.', 'My avg hold is 5 days.', 'Average daily volume rose 40%.', 'the 1.5% daily range held',
  'Sales grew 5% weekly through the holidays.', 'The fund made 8% a year, I only watched.', 'Wages up 4% a year, rates at 5%.',
  'Avg 5% weekly for the index, mostly beta.', 'Inflation is 3% annually; I stayed in cash.', 'Yield is 4% a year on the bond.',
  // item 3: the trader's own past action, reflection and third-person commentary
  'I thought it was time to buy', 'Decided it was time to sell after the second miss.', 'It was a hot stock in 2021 and I bought late.',
  'Semis outperform when rates fall, so I sized up.', 'The company does not make money yet; sold.', 'Copy this trade? No.',
  'Felt like time to sell once volume dried up.', 'Was it time to buy? I thought so.', 'Small caps outperformed in the spring; I was early.',
  'I wondered whether to copy this trade again.',
  // item 2: ordinary words never join (squash joins only runs of single characters)
  'I bought a 5 x 2 grid of strikes.', 'Plan B: wait for a retest, then add.', 'A B test of two entries, sold both.',
];

test('fix round 6: period rates, spelled-out phrases, calls to act and the script g are held with the expected label', () => {
  for (const [t, label] of BYPASS_R6) {
    assert.deepEqual(moderateDetail(t), { status: 'held', rule: label }, JSON.stringify(t));
    assert.equal(moderateDetail(sanitizeUserText(t)).status, 'held', JSON.stringify(sanitizeUserText(t)));
  }
});

test('fix round 6: third-party rates, past or reflective calls and ordinary spacing publish (no rule)', () => {
  for (const t of NEGATIVE_R6) {
    assert.deepEqual(moderateDetail(t), { status: 'published', rule: null }, JSON.stringify(t));
    assert.deepEqual(moderateDetail(sanitizeUserText(t)), { status: 'published', rule: null }, JSON.stringify(t));
  }
});

test('fix round 6: the start-up re-check holds version 1 notes only on what version 2 added', () => {
  for (const t of ['my avg is 30% a month', 'Time to buy!', 'Copy this trade.', 't o t h e m o o n', 'd m m e', 'ɡet rich quick']) {
    assert.equal(moderateDetail(t, { after: 1 }).status, 'held', t);
    assert.deepEqual(moderateDetail(t, { after: 2 }), { status: 'published', rule: null }, t);
  }
  // a version 1 rule is not re-applied to a version 1 note (it passed it when saved)
  assert.deepEqual(moderateDetail('see example.com', { after: 1 }), { status: 'published', rule: null });
  // version 2 rules carry since: 2
  assert.ok(HOLD_V2.some((r) => r.since === 2));
});

// Rules fingerprint: changing a rule without raising MODERATION_VERSION would leave already-checked notes unchecked
// against it. Each version pins the hash of every rule source; a change needs a new version and a new entry here.
const RULE_HASHES: Record<number, string> = {
  2: '713b08cb0d5c66fad954435cfe51b57bd41a13ff60c87b85a3d25477bc709893',
  3: '57ced0678529edf7d9fabb8104b826d8420e73b9395f03329815aa67201a8ec7',
  4: '207b077b132a260cef40ccd602f4efb31e08e2be60165c459d290b29bff0b2bf', // F4-18 (cycle 4; unreleased, re-pinned after the #89 review)
};
test('fix round 6: rules cannot change without raising MODERATION_VERSION', async () => {
  const { createHash } = await import('node:crypto');
  const m = await import('./moderation.ts');
  const { PROMO } = await import('../scripts/compliance.ts');
  const src = JSON.stringify([
    m.HOLD.map(String), PROMO.map(String), m.LONG_WORDS.map((r) => [r.rule, r.label, String(r.re)]),
    m.HOLD_V2.map((r) => [r.rule, r.label, String(r.re), r.words ?? false, r.claim ?? false, r.since ?? 1, r.when ? String(r.when) : '']),
    m.TALK_RULES.map(String),
  ]);
  const hash = createHash('sha256').update(src).digest('hex');
  const pinned = RULE_HASHES[m.MODERATION_VERSION];
  assert.ok(pinned, `no rules hash pinned for MODERATION_VERSION ${m.MODERATION_VERSION}: add { ${m.MODERATION_VERSION}: '${hash}' } to RULE_HASHES`);
  assert.equal(hash, pinned, `the moderation rules changed: bump MODERATION_VERSION (give new rules since: <new version>) and pin { <new version>: '${hash}' } in RULE_HASHES`);
});

// ---- Fix round 7 (period word before the rate word, "mo" as a period, a split word, reflective timing) ----

// [text, expected label]
const BYPASS_R7: [string, string][] = [
  // item 1: a period word before the rate word; "mo" (no slash) after a figure when a rate word is there
  ['monthly avg 30%', 'return claim'], ['Monthly average 30% on my setup.', 'return claim'], ['weekly avg: 5%', 'return claim'],
  ['avg 30% mo', 'return claim'], ['averaging 30% mo on this', 'return claim'], ['my average is 12% mo.', 'return claim'],
  // item 2: one word split by a space
  ['guar anteed returns', 'promotion'], ['guaran teed profits every week', 'promotion'],
];
const NEGATIVE_R7: string[] = [
  // item 1: "mo" with no rate word, and third-party period rates
  '30% mo', 'Up 30% mo and then gave it back.', 'Monthly avg volume rose 30%.', 'monthly avg 30% for the index, mostly beta.',
  'Annual average inflation 3% this decade.', 'avg 30% mo range on this name',
  // item 2: ordinary word pairs are never joined into a phrase-rule word
  'Semis out perform when rates fall, so I sized up.', 'I sold the rest at the open.', 'Bear case: guidance cut, sold.',
  // item 3: the timing phrase as the trader's own past or reflective choice
  'Time to buy was right after the selloff, which I did.', 'Time to buy was right after the selloff.', 'Time to sell, which I did at 52.',
];

test('fix round 7: period-first rate claims, "mo" rate claims and split words are held with the expected label', () => {
  for (const [t, label] of BYPASS_R7) {
    assert.deepEqual(moderateDetail(t), { status: 'held', rule: label }, JSON.stringify(t));
    assert.equal(moderateDetail(sanitizeUserText(t)).status, 'held', JSON.stringify(sanitizeUserText(t)));
  }
  // the calls to act stay held
  for (const t of ['Time to buy!', 'Time to buy $XYZ, everyone.', 'Guys, time to sell.', "It's time to buy."]) assert.equal(moderate(t), 'held', t);
});

test('fix round 7: "mo" without a rate word, third-party rates, word pairs and reflective timing publish (no rule)', () => {
  for (const t of NEGATIVE_R7) {
    assert.deepEqual(moderateDetail(t), { status: 'published', rule: null }, JSON.stringify(t));
    assert.deepEqual(moderateDetail(sanitizeUserText(t)), { status: 'published', rule: null }, JSON.stringify(t));
  }
});

test('fix round 7: the start-up re-check holds version 2 notes only on what version 3 added', () => {
  for (const t of ['monthly avg 30%', 'avg 30% mo', 'guar anteed returns']) {
    assert.equal(moderateDetail(t, { after: 1 }).status, 'held', t);
    assert.equal(moderateDetail(t, { after: 2 }).status, 'held', t);
    assert.deepEqual(moderateDetail(t, { after: 3 }), { status: 'published', rule: null }, t);
  }
  // a version 2 rule is not re-applied to a version 2 note
  assert.deepEqual(moderateDetail('my avg is 30% a month', { after: 2 }), { status: 'published', rule: null });
  assert.ok(HOLD_V2.some((r) => r.since === 3));
  // F4-18 (version 4) adds only its own rules; every earlier rule is still version 3 or older.
  const F4_18 = new Set(['domain-cc', 'cashtag', 'bio-pointer', 'follow-for', 'trading-room']);
  assert.ok(HOLD_V2.every((r) => (r.since ?? 1) <= 3 || (F4_18.has(r.rule) && r.since === 4)));
  assert.ok(HOLD_V2.filter((r) => F4_18.has(r.rule)).every((r) => r.since === 4));
});
