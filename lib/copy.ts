// Fixed product copy for F-1 (docs/features/logs/F-1/plan.md §2, the UX lead's strings verbatim).
// Every string here is tested against the banned-claims list (lib/copy.test.ts). Change copy here only.
// F-1 PR-3 fix round 4 (UX lead demand 2): every count goes through lib/format.ts (thousands grouped: "2,828").
import { count, counted, toneWord } from './format.ts';
import { CLOSES_PAGE } from './paging.ts';
import { EXCLUSION_DAYS } from './discovery/weights.ts';
import { tone, type Tone } from './open-split.ts'; // A11Y-FIXES #23 (group 3)

export const SIGNIN = {
  title: 'Publish your trades',
  sub: 'Read-only. We can never place trades or move money.',
  emailLabel: 'Email',
  emailButton: 'Send me a link',
  divider: 'or',
  brokerage: 'Connect a brokerage instead',
  provider: (label: string) => `Continue with ${label}`,
  attest: 'I am 18 or older and accept the ',
  terms: 'Terms',
  and: ' and ',
  privacy: 'Privacy Policy',
  attestError: 'Confirm you are 18 or older to continue.',
  emailError: 'Enter an email address to get a link.',
  providerError: 'That sign-in did not complete. Try again or use an email link.',
  linkSent: 'Check your email. The link works for 15 minutes.',
  sendAgain: 'Send again',
  linkExpired: 'That link has expired. Send a new one?',
  linkUsed: 'That link was already used. Send a new one?',
  newLink: 'Send a new link',
  sendFailed: 'We could not send your link. Try again.',
  sentAgain: 'Sent again.',
  tooMany: 'Too many links sent. Try again in a few minutes.',
  back: '← Back',
  devLink: 'Dev sign-in',
} as const;

// Security hardening (2026-11-01), F14: the emailed link opened in a browser other than the one that asked for it.
export const EMAIL_CONFIRM = {
  title: 'Continue signing in',
  forAddress: (masked: string) => `This link signs in the account for ${masked}.`,
  button: 'Continue signing in',
  notYou: 'Not your address, or you did not ask for a link? Close this page.',
} as const;

// S2 trust notice. Only the integrated vendor is named (POLICY T1); every statement is one the vendor publishes itself.
export const TRUST_NOTICE = {
  title: 'Before you connect',
  lines: [
    'Read-only. Stock Social can never place trades or move money.',
    'Your broker password is not shared with SnapTrade or with us when your broker uses a login handoff.',
    'SnapTrade reports an independent audit of its security controls.',
    'Every account under this login and your full trade history are included. Nothing is imported until you confirm on the next screen.',
  ],
  vendorLink: "SnapTrade's security page",
  vendorLinkNote: "opens SnapTrade's site",
  howLink: 'How records are calculated',
  primary: 'Connect brokerage (read-only)',
  signInFirst: 'Sign in first, then connect.',
  emailOption: 'Sign in with an email link',
  settingsLink: 'Settings',
  profileLink: 'Your profile',
} as const;
// The vendor's own security page, linked from the notice. Configurable so the owner can point at the page the vendor publishes.
export const VENDOR_SECURITY_URL = process.env.NEXT_PUBLIC_VENDOR_SECURITY_URL || 'https://snaptrade.com/security';

// Own profile, first screen after sign-in (the committee's item 9): one status line, no celebration.
export const PROFILE = {
  youreIn: "You're in. Next: connect your brokerage.",
  changeHandle: 'Change handle',
  // Fix round 8 (tester re-run 4): counts pluralized ("1 earlier position", "2 imported trades"), never "(s)".
  // Fixes cycle 4 (C4-2; F-28's true-cause wording; UX lead, committee): the count also holds sells after an oversell,
  // whose entry was recorded, so it never says "no matching entry". It counts sells (one per sell,
  // users.excluded_positions) and names both causes without saying which applied.
  excludedPositions: (n: number) => `${counted(n, 'sell')} excluded: a short sale or earlier history means no buy in the imported history can be matched to ${n === 1 ? 'it' : 'them'} for certain.`,
  excludedFuture: (n: number) => `${counted(n, 'imported trade')} excluded: dated in the future by the broker.`,
  // Corporate actions (POLICY F3c, committee 2026-11-01): sells the importer can't price exactly, counted, never guessed.
  // ponytail: shown on the public profile only; the owner's /me/record line shows excluded_positions alone — fix: add
  // excluded_corporate to the session user row (lib/session.ts, protected) and a line there.
  // Fixes cycle 3 (F3-15, F3-1): neutral cause words; the count also holds broker trade rows with no usable price, share
  // count or date (lib/trades.ts).
  excludedCorporate: (n: number) => `${counted(n, 'trade')} excluded: a share move, corporate action or broker row the importer can't price.`,
  // F-24 (council cycle 5 RT-2; final review: POLICY F3c "excluded and counted" requires the line): sells counted, not
  // priced, while a broker row that may repeat an earlier one is checked (users.excluded_held). Neutral cause words, no
  // claim. ponytail: the committee's wording; the owner's final wording is an owner item.
  // ponytail: shown on the public profile and in record tools only; the owner's /me/record line needs the session user row
  // (lib/session.ts, protected) — fix: add excluded_held there with a line, as for excluded_corporate above.
  // ponytail: rows a give-up left held (a busy account; failed or multi-page widened reads) are no longer being checked
  // until a later pass, yet the line says "checks" — fix: a second line for given-up rows once the owner words it.
  excludedHeld: (n: number) => `${counted(n, 'sell')} excluded while the importer checks a broker row that may repeat an earlier one.`,
} as const;

// S4 consent (the UX lead's strings): the depth of the import, named before anything is read.
// Privacy work (2026-11-01): the consent screen's public-scope line, owner copy.
// ponytail: the status line publishes record-state dates this line does not name (lib/privacy-fields.ts#RECORD_STATE_FIELDS)
// — the owner must add "connection status dates (last update, disconnected, account removed)" (and the connection date an
// idle record falls back to) before real users connect (POLICY P6); lib/privacy-fields.test.ts then pins the new line.
export const CONSENT_SCOPE_LINE = 'Public: percent returns, symbols, dates, holding periods, institution names, account count, and your current open positions with unrealized percent. Private: quantities, prices, fees and account numbers. Your public record is also used to describe your trading style and to order traders for readers.';

export const CONSENT = {
  title: 'Confirm what gets imported',
  // Committee fix (item 7): no lead line (the notice already said it) and one scope line, so the primary fits 375×667.
  lines: (found: number, paper: number) => [
    'Full trade history your broker provides, from every account under this login',
    `${counted(found, 'account')} found${paper > 0 ? ` (${count(paper)} simulated, not imported)` : ''}`,
    // Privacy work (2026-11-01, owner copy): the public-scope line names every public and private field
    // (lib/privacy-fields.ts derives its field lists from this line and lib/privacy-fields.test.ts holds them equal).
    CONSENT_SCOPE_LINE,
    'A broker account can belong to one profile, ever.',
    'Your record stays public if you disconnect; deleting your profile removes it.',
  ],
  // No clock time: a UTC time is in a zone the trader does not live in (committee item 7).
  deadline: 'Decide within 24 hours, or this link is removed automatically.',
  primary: 'Import my record',
  secondary: "Don't import",
} as const;

// S5 / S8 body by connection state (plan §8 item 3): the empty-record line only once the import is finished.
export const RECORD_BODY = {
  importing: 'Your trades appear here as they import.',
  connected: 'No closed trades yet. Your record starts with your first close.',
  none: 'No trades yet.',
  // Fix round 4: the count is the closed trades listed under the banner, never the raw activities imported.
  // PR-2b fix round 2 (business lead 3): "your" only to the owner; visitors and link previews read "this record".
  banner: (closes: number, owner: boolean) => `Importing ${owner ? 'your' : 'this'} record · ${counted(closes, 'closed trade')} so far`,
  // F-1 PR-3 fix round 7 (business lead re-sit, demand 3): before the first close the headline counts what the import
  // has read, so it moves within seconds instead of reading "0 closed trades so far" for a minute. The owner's banner
  // only (visitors and link previews keep the closed-trades count). Switches to `banner` once closed trades exist.
  bannerRead: (read: number) => `Importing your record · ${counted(read, 'activity', 'activities')} read from your broker`,
  finished: 'Import finished.',
  // PR-2b (S5): the rows read so far, updated after every step (not a live region); the count of distinct activities.
  // Fix round 2 (business lead 2): one noun per count. "Trades" counts closed trades only; these rows are activities.
  imported: (n: number) => `${counted(n, 'activity', 'activities')} imported`,
  // F-1 PR-3 fix round 4 (UX lead note 1): the same count, announced (a hidden live region, at most once per 5 s) so a
  // screen reader hears the import move while the closed-trades count is still 0 (closes appear at the rebuild).
  importedSoFar: (n: number) => `${counted(n, 'activity', 'activities')} imported so far`,
  // Fix round 2 (engineer, Low): a poll answered 401/403 (signed out in another tab) stops polling and says so.
  signedOut: 'Signed out in another tab.',
  signInAgain: 'Sign in again',
  // Plan §8 item 2: after 60 s with no new rows, the owner learns the hourly tick carries on without the tab.
  stillSending: 'Your broker is still sending history. You can leave; the import continues.',
  // F-1 PR-3 fix round 4 (UX lead note 2): when the last step was deferred (the vendor timed out, rate-limited or was
  // down), the broker is not sending anything: say so instead.
  stillWaiting: 'Still waiting for your broker. You can leave; the import continues.',
  paperExcluded: (n: number) => `${counted(n, 'simulated account')} excluded: simulated trades are never part of a record.`,
  positionsTitle: 'Open positions',
  // A failed import is never shown as a whole record (TR-3): the line is visible to everyone, the retry to the owner.
  failed: 'The import did not finish, so this record may be incomplete.',
  retry: 'Try again',
} as const;
// F-7: 'public' / 'public_demo' (a fictional fixture) is a record built from public filings (lib/connections.ts#recordStates).
export type RecordState = 'importing' | 'connected' | 'failed' | 'none' | 'public' | 'public_demo';
// The S8 empty-record line belongs to a finished import only; a failed one says so instead.
// Committee fix (item 8): the importing line only while nothing is listed yet; with trades listed the banner says it.
export const recordBodyCopy = (state: RecordState, closes: number): string | null =>
  closes > 0 ? null : state === 'importing' ? RECORD_BODY.importing : state === 'connected' ? RECORD_BODY.connected : RECORD_BODY.none;

// The share card (fix round 3): its states mirror the profile's. "Demo data" only for a demo profile (source='demo');
// "Broker connected" only for a finished import with no closes; an import still running shows no stats; a failed one
// says so and carries the profile's incomplete line; a real trader with nothing consented gets no label.
export const SHARE_CARD = {
  verified: '✓ Verified from broker',
  connected: '✓ Broker connected',
  importing: 'Importing record',
  importingBody: 'Import in progress',
  importingNote: 'Stats appear when the import finishes.',
  failed: 'Import did not finish',
  demo: 'Demo data',
  empty: 'No closed trades yet',
  // F-4: the record card's own words (lib/record-card.ts). The card always names its trust state (Verified, Demo,
  // or the reason it is neither); the square and story pictures travel without a link preview, so their demo label
  // says what demo means.
  notVerified: 'Not verified',
  noBroker: 'No broker connected',
  demoImage: 'Demo data, not a real broker record',
  perTrade: 'average per trade',
  likely: (low: string, high: string) => `likely between ${low} and ${high}`,
  lossesIncluded: 'losses included',
  // F-4 (2026-11-01): the running sum of per-trade returns, for every trader until F-5 (position size) is built.
  chartCaption: 'Sum of trade returns, in order · position size not shown',
  // F-6 on the card (committee 2026-11-01): realized and unrealized apart, in words, percent only, no symbols.
  perClosedTrade: 'average per closed trade',
  openFull: (n: number) => `Still open: ${n} ${n === 1 ? 'position' : 'positions'}`,
  openShort: (n: number) => `${n} open, unrealized`,
  openNote: 'unrealized, not sold yet',
  openAlt: 'Still open, unrealized as of the last sync:',
} as const;
// The profile's link-preview text (app/u/[handle]/page.tsx). Committee round 1, demand 10: "0% win rate" when there are
// no wins (the old `pct(0, 0).slice(1)` dropped the digit and printed "% win rate").
export const winRateText = (winRate: number) => `${(winRate * 100).toFixed(0)}% win rate`;
export type ShareCardText = { label: string | null; tone: 'ok' | 'muted' | 'warn'; body: string | null; note: string | null };
// body null = show the stats; note null = show the evidence line.
export function shareCardText(x: { state: RecordState; demo: boolean; verified: boolean; empty: boolean }): ShareCardText {
  const body = x.empty ? SHARE_CARD.empty : null;
  if (isPublicRecord(x.state)) return { label: publicLabel(x.state), tone: 'muted', body, note: PUBLIC.imageLine }; // F-7
  if (x.demo) return { label: SHARE_CARD.demo, tone: 'muted', body, note: null };
  if (x.state === 'importing') return { label: SHARE_CARD.importing, tone: 'muted', body: SHARE_CARD.importingBody, note: SHARE_CARD.importingNote };
  if (x.state === 'failed') return { label: SHARE_CARD.failed, tone: 'warn', body, note: RECORD_BODY.failed };
  if (!x.empty && x.verified) return { label: SHARE_CARD.verified, tone: 'ok', body, note: null };
  if (x.state === 'connected') return { label: x.empty ? SHARE_CARD.connected : null, tone: 'ok', body, note: null };
  return { label: null, tone: 'muted', body, note: null };
}

// Reviewer fix (POLICY F3a, A1): the profile card's alt text names the card's own label for the record state, so a demo,
// importing or failed record is never described as verified.
export const profileCardAlt = (handle: string, t: ShareCardText) =>
  `Trading record card for @${handle} on Stock Social${t.label ? `: ${imageLabel(t.label)}` : ''}`;

// Fix round 6 (POLICY F3, TR-3): the trader's other performance images (single-trade card, month recap card, story
// image) follow the profile card's rule, from the same record state. No image draws the check mark: the image font has
// no glyph for it (it rendered as an empty box), so the word carries the meaning. The story keeps its own wording for a
// whole verified record. stats false = an import still running: no whole-record stats line. note = the incomplete line.
export type ImageKind = 'profile' | 'trade' | 'month' | 'story';
export const imageLabel = (label: string | null) => label && label.replace(/^\u2713\s*/, '');
export const STORY_VERIFIED = 'Imported read-only from the broker';
export type ImageTrust = { label: string | null; tone: ShareCardText['tone']; stats: boolean; note: string | null };
export function imageTrust(kind: ImageKind, x: { state: RecordState; demo: boolean; verified: boolean; empty: boolean }): ImageTrust {
  const t = shareCardText(x);
  const label = t.label === SHARE_CARD.verified && kind === 'story' ? STORY_VERIFIED : imageLabel(t.label);
  return { label, tone: t.tone, stats: wholeRecordView(x).stats, note: t.note };
}

// Reviewer fix (TR-3, POLICY F3a): the trade and month pages' "Their whole record" block and their link previews follow
// the profile's record-state rule, the same one the images use. An import still running: no whole-record stats (win
// rate, average return, evidence, New record), one importing line instead. A failed import: the stats with the
// incomplete line. Demo data never imports, so it always shows its stats.
export const WHOLE_RECORD = {
  importing: 'Import in progress. Stats appear when the import finishes.',
  soFar: (closes: number) => `${counted(closes, 'closed trade')} so far`,
} as const;
// F-10 / F-12: the record strip's own words (lib/record-strip.ts builds the strip; SHARE_CARD and WHOLE_RECORD give the
// rest). "Too early to tell" stays until the design system council settles the short-record wording. The link names the
// trader's record, never "full" or "whole" (POLICY F3a).
export const RECORD_STRIP = {
  early: 'Too early to tell',
  rangeLabel: '95% range',
  link: (handle: string) => `@${handle}'s record`,
} as const;
export type WholeRecordView = { stats: boolean; line: string | null; tone: 'muted' | 'warn' | null };
export function wholeRecordView(x: { state: RecordState; demo: boolean }): WholeRecordView {
  if (isPublicRecord(x.state)) return { stats: true, line: `${PUBLIC.badge}. ${PUBLIC.notJoined}`, tone: null }; // F-7: previews only
  if (x.demo) return { stats: true, line: null, tone: null };
  if (x.state === 'importing') return { stats: false, line: WHOLE_RECORD.importing, tone: 'muted' };
  if (x.state === 'failed') return { stats: true, line: RECORD_BODY.failed, tone: 'warn' };
  return { stats: true, line: null, tone: null };
}
// The link-preview text for the whole record: the count, then either the stats or the importing line.
export function wholeRecordPreview(x: { state: RecordState; demo: boolean; verified: boolean; trades: number }, stats: string): string {
  const v = wholeRecordView(x);
  if (!v.stats) return `${WHOLE_RECORD.soFar(x.trades)} · ${WHOLE_RECORD.importing}`;
  return `${v.line ? `${v.line} ` : ''}${recordCountText(x)} · ${stats}`;
}

// Fix round 6: the whole-record count in a link preview's description says "verified" only when the profile would
// (a whole record, every trade from the broker); "demo" for a demo profile; plain "closed" otherwise.
export function recordCountText(x: { state: RecordState; demo: boolean; verified: boolean; trades: number }): string {
  if (isPublicRecord(x.state)) return `${counted(x.trades, 'closed trade')} from public filings`; // F-7: never "verified"
  const kind = x.demo ? 'demo' : x.verified && x.trades > 0 && (x.state === 'connected' || x.state === 'none') ? 'verified' : 'closed';
  return counted(x.trades, `${kind} trade`);
}

// S6 declined / expired, S6c no real account, S7 errors (role="alert").
export const RESULT = {
  declined: 'Import not started. Nothing is connected.',
  expiredPrefix: 'The time to decide ran out.',
  none: 'No real brokerage account found.',
  noneAction: 'Connect a different brokerage',
  abandoned: 'Connection not completed. Nothing was saved.',
  failed: 'Your brokerage stopped the connection before the import finished.',
  stale: 'Your brokerage stopped sending history before the import finished.',
  notFound: 'Connection not found.',
  notFoundAction: 'Connect a brokerage',
  claimedAction: 'Try another login',
  again: 'Connect again',
  retry: 'Try again',
  notNow: 'Not now',
  // S7a second action (plan §8 item 1): the redirect flow on the same attempt.
  continueNewPage: 'Continue in a new page',
  feed: 'Back to feed',
} as const;

// S3 portal modal (the UX lead's strings): loading, the 3 s line, the persistent redirect link.
export const PORTAL = {
  title: 'Connect your brokerage',
  opening: 'Opening…',
  slow: 'Taking longer than usual.',
  newPage: 'Open in a new page instead',
  close: 'Close',
  frameTitle: 'SnapTrade connection portal',
  // Fix round 2 (business lead 1, UX lead 1): after load, only after 8 s of silence, beside the secondary button.
  blank: 'Page blank? Open it in a new page.',
  // Fix round 2 (UX lead note 4): the app's one line before the vendor's own page after a blocked popup.
  popupBlocked: "Your browser blocked the embedded window; continuing on the vendor's page.",
  continue: 'Continue',
  // Fix round 2 (engineer, Low): the mint rate limit.
  tooMany: 'Too many tries. Wait a few minutes, then try again.',
} as const;

// FIXES-LABELS
// ---- FIXES-LABELS ---- (docs/features/logs/fixes-labels/plan.md §2): D-03, D-05, D-07, D-24 copy. Params are already
// formatted strings (count()/counted()/dateText() output). The F3 line itself stays in lib/share.ts (DISCLAIMER), never
// here: this block is walked by allCopy(), whose banned list includes "guarantee". The F-11 status strings live in their
// own block at the end of this file.
export type TrustKind = 'verified' | 'demo' | 'mixed';
export const FIXES_LABELS = {
  // D-03 / fix #2: one state name, "Demo". Demo trades are never called verified.
  tickerTitle: {
    verified: (s: string) => `${s} verified trades · Stock Social`,
    demo: (s: string) => `${s} Demo trades · Stock Social`,
    mixed: (s: string) => `${s} closed trades, includes Demo · Stock Social`,
  },
  tickerCount: {
    verified: (n: string, s: string) => `${n} verified closed trades in ${s}`,
    demo: (n: string, s: string) => `${n} Demo closed trades in ${s}, not from a real broker`,
    mixed: (n: string, s: string) => `${n} closed trades in ${s}, some Demo`,
  },
  tickerExplainer: {
    verified: 'Verified closed trades in this stock from connected accounts, newest first. Percentages only. Few trades means a wide range, and that is expected.',
    // QA round 2 (N9): the page note under the figures says "not from a real broker" once (FIXES_LABELS.demoPage).
    demo: 'Demo closed trades in this stock, newest first. Percentages only. Few trades means a wide range, and that is expected.',
    mixed: 'Closed trades in this stock, newest first: some from connected accounts, some Demo. Percentages only. Few trades means a wide range, and that is expected.',
  },
  demoNote: 'Demo trades, not from a real broker.',
  mixedNote: 'Includes Demo trades, marked Demo. The figures include them.',
  demoPage: 'This page shows Demo trades only, not from a real broker.',
  indexTitle: 'Trades by stock · Stock Social',
  indexDescription: 'Closed trades by stock: trade counts and traders, percentages only, losses included. Demo trades are marked Demo.',
  indexIntro: 'Stocks with closed trades from connected accounts or Demo data. Open a stock to see its trades, losses included. Percentages only.',
  indexAria: 'Stocks with closed trades',
  compareTitle: {
    verified: (a: string, b: string) => `${a} vs ${b} verified trades · Stock Social`,
    demo: (a: string, b: string) => `${a} vs ${b} Demo trades · Stock Social`,
    mixed: (a: string, b: string) => `${a} vs ${b} closed trades, includes Demo · Stock Social`,
  },
  compareExplainer: {
    verified: 'Verified closed trades in each stock, side by side. Percentages only. Few trades means a wide range, and that is expected.',
    demo: 'Demo closed trades in each stock, side by side. Not from a real broker. Percentages only. Few trades means a wide range, and that is expected.',
    mixed: 'Closed trades in each stock, side by side; some are Demo. Percentages only. Few trades means a wide range, and that is expected.',
  },
  // ponytail: the mixed compare description keeps "Sample data" (DS-20 wants it gone) only because lib/compare.test.ts:74 asserts it — whoever owns that test changes it to "Demo trades, not from a real broker." and this tail with it
  compareTail: { demo: ' Demo trades, not from a real broker.', mixed: ' Includes Demo trades. Sample data, not from a real broker.' },
  compareOverlap: {
    verified: (n: number, a: string, b: string) => (n === 0 ? 'No trader has closed verified trades in both yet.' : `${n} trader${n === 1 ? '' : 's'} closed verified trades in both ${a} and ${b}.`),
    demo: (n: number, a: string, b: string) => (n === 0 ? 'No trader has closed trades in both yet.' : `${n} trader${n === 1 ? '' : 's'} closed trades in both ${a} and ${b}.`),
    // QA round 1 (finding 2): a pair with Demo trades counts verified traders and says the Demo trades are left out.
    mixed: (n: number, a: string, b: string) => `${n === 0 ? `No trader has closed verified trades in both ${a} and ${b} yet.` : `${n} trader${n === 1 ? '' : 's'} closed verified trades in both ${a} and ${b}.`} Demo trades are not counted here.`,
  },
  // D-07: facts, the traders' records as subject, one measure on both sides (D-10), no verdict. `n` is counted() text
  // ("1 closed trade", "12 closed trades"), so one trade reads in the singular.
  baselineHeading: 'Closed trades recorded here: this stock and other stocks',
  // QA round 1 (finding 3): the range is the 95% range of the average per trade (the profile's wording), not the spread
  // of the trades (the dot plot's "range").
  baselineThis: (sym: string, n: string, traders: string, range: string | null) => `${n} in ${sym} by ${traders}${range ? `: 95% range of the average per trade ${range}` : ''}.`,
  baselineOthers: (n: string, range: string | null) => `${n} in other stocks recorded here${range ? `: 95% range of the average per trade ${range}` : ''}.`,
  baselineNote: 'Side by side for context only. Different traders, sizes and timing. Not a rating of any stock.',
  // Code review: on a stock with some Demo trades, both sides are verified trades only (the other stocks' side always is).
  // QA round 1 (finding 12): the pane's and month page's footers on a Demo record name Demo, not connected accounts.
  paneFoot: { real: "Closed trades from connected accounts are published, losses included. Options and positions with no recorded entry aren't shown.", demo: 'Demo trades, not from a real broker, losses included.' },
  monthFoot: { real: "Recaps list the month's closed trades from connected accounts, and none can be hidden.", demo: "Recaps list the month's Demo trades, not from a real broker, and none can be hidden." },
  baselineMixedNote: 'Both sides count verified trades only. The Demo trades in this stock are left out of this comparison.',
  baselineThisTile: 'This stock',
  baselineOthersTile: 'Other stocks recorded here',
  // D-24: months show numbers and a range only.
  // Code review: "One of N", not "1 of N" (which reads as a position, "month 1").
  monthOf: (n: string) => (n === '1' ? 'The only month on record' : `One of ${n} months on record`),
  // D-05: chart ends and the at-rest subline.
  chartSub: (rangeLabel: string, d: string) => `${rangeLabel} · last close ${d}`,
  chartEnds: (a: string, b: string) => `First close ${a}, last close ${b}`,
} as const;

// The profile's "Connected:" line names the institutions the vendor returned for consented real accounts; with none
// (a pre-F-1 record) it says "the broker", never a placeholder. PR-3 (carried Low 1, POLICY F3a): never "your broker",
// since visitors and link previews read this line, and "your" is only ever said to the owner.
export const connectedLine = (institutions: string[], accounts: number): string => {
  const names = institutions.map((s) => s.trim()).filter(Boolean);
  return `Connected: ${names.length ? names.join(', ') : 'the broker'} (${counted(accounts, 'account')})`;
};

// The profile's link-preview text. With no closes there is no stats line (never "0 closed trades · % win rate"): the
// profile's own empty-record words instead. While importing, the banner line (no stats, TR-3).
export function profileDescription(x: { state: RecordState; demo: boolean; verified: boolean; trades: number; stats: string }): string {
  if (isPublicRecord(x.state)) return `${PUBLIC.badge} · ${PUBLIC.notJoined} ${recordCountText(x)} · ${x.stats}`; // F-7 (C15)
  if (x.state === 'importing' && !x.demo) return RECORD_BODY.banner(x.trades, false); // public text: never "your"
  const failed = x.state === 'failed' && !x.demo ? `${RECORD_BODY.failed} ` : '';
  if (x.trades === 0) return x.state === 'failed' ? `${failed}${SHARE_CARD.empty}.` : x.state === 'connected' ? RECORD_BODY.connected : RECORD_BODY.none;
  return `${failed}${recordCountText(x)} · ${x.stats}`;
}

// /how (POLICY F3): what Verified means and what is excluded, in the words of lib/trades.ts. Percent only.
export const HOW = {
  title: 'How records are calculated',
  verifiedTitle: 'What "Verified" means',
  verified: 'Verified means imported read-only from the trader\u2019s broker through the integrated vendor. It does not verify identity, completeness or skill, and it is not an endorsement by a broker or by the vendor. Demo profiles carry a Demo badge instead.',
  mathTitle: 'The math',
  math: [
    'Each closed trade is one sell, matched to earlier buys of the same symbol in the same account, first in, first out.',
    'Return is the percent change between the matched buys and the sell, after the fees the broker reported. Nothing is weighted by size.',
    'Headline stats are the win rate and the average return per trade. Max drawdown is per-trade and equal-weight, not an account return.',
    'Only percentages are stored and shown: no amounts, quantities or prices.',
    // Corporate actions (F3c, PR #40).
    'When the broker reports a stock split, reverse split or stock dividend with an exact ratio, earlier buys are adjusted to match and the holding period still starts at the first buy. Fractional shares paid out as cash are not counted as trades.',
  ],
  excludedTitle: 'What is excluded, and counted',
  excluded: [
    // OPTIONS (docs/features/logs/options/plan.md D8): the options bullets replace "Options, short sales and other
    // activity the importer cannot price correctly." (word order kept so "short sales" and "Options" still lead).
    'Short options and short sales: their risk has no fixed amount to measure a percent against.',
    'Exercised or assigned options, and share trades held over the day of an exercise or assignment in that stock. These are left out of the options average, so it does not include contracts that ended in the money.',
    'Options on futures or other non-stock underlyings, contracts adjusted after a corporate action, and contracts past expiry with no closing record.',
    'Transfers in, and sells with no recorded entry in the imported history (shown as excluded sells, never guessed).',
    // Fixes cycle 4 (C4-2; UX lead, committee).
    'After a sell of more shares than the imported history holds (an earlier holding, a transfer in or a short sale), or a stock split, stock dividend or other corporate action on a stock the history shows none of, the later sells of that holding in that account (under its new symbol after a rename) are excluded and counted too, wins and losses alike: the history can\u2019t show which buys are left.',
    // Fixes cycle 4 (UX lead, round 4): the disclosure of F-30's accepted residual (lib/trades.ts ponytail in `replay`).
    'Some brokers send only the date of a trade. On those, a buy and a sell of one stock on the same day are read buy first, so a same-day short sale with no earlier sign of one can appear as a long trade (a known limit).',
    'Stock splits and other corporate actions whose ratio is not known exactly, spin-offs and transfers in: the trades they touch are excluded and counted, never guessed.',
    // Fixes cycle 3, F3-1 (lib/trades.ts): unusable broker trade rows are counted, never dropped.
    'Trade rows the broker sent without a usable price, share count or date: the trades they touch are excluded and counted, never guessed. With no share count, that includes the later trades of the same stock in the same account; with no date, all of its trades there.',
    'A sell of more shares than the imported history holds (for example after a stock split the broker did not report) is excluded whole, wins and losses alike.',
    'Simulated ("paper") accounts.',
    'Accounts and brokers that are not connected.',
  ],
  freezeTitle: 'Disconnecting and deleting',
  freeze: 'A record freezes when a brokerage is disconnected and stays public. Deleting the profile removes it; the handle is held for a year.',
} as const;

// S9 /settings: deleting a profile takes two taps; only the second deletes.
export const SETTINGS = {
  title: 'Settings',
  deleteTitle: 'Delete my profile',
  deleteExplain: 'Deleting removes your profile, record, sign-in details and the brokerage link at the vendor. Your handle is held for a year.',
  deleteAction: 'Delete my profile',
  keep: 'Keep it',
  confirm: 'This cannot be undone.',
  signOut: 'Sign out',
} as const;

// F-1 PR-3 fix round 4 (UX lead demand 1, TR-1): the profile's closed trades in windows of 50, every one reachable.
export const CLOSES_PAGING = {
  size: CLOSES_PAGE,
  showing: (start: number, shown: number, total: number) =>
    start === 0 ? `Showing ${count(shown)} of ${counted(total, 'closed trade')}` : `Showing ${count(start + 1)}–${count(start + shown)} of ${counted(total, 'closed trade')}`,
  more: (n: number) => `Show ${count(n)} more`,
  newest: 'Back to the newest',
} as const;

export const FOOTER = { terms: 'Terms', privacy: 'Privacy', how: 'How records are calculated', skip: 'Skip to disclaimer and legal links' } as const;

// F-13 (first-visit line, swipe hint, nav)
// D27's line and SW-1's hint verbatim (lib/f13-copy.test.ts); a decided line changes only by the owner or a council
// amendment. The design system council (PR #48, §2.5 R5) proposes new wording for the line: an owner item in the PR.
// `demo`, `how` and `dismiss` follow that council's labels (not part of D27's decided text).
// If F-7 public profiles enter the feed, `line` becomes false for them and goes back to the idea board (2026-11-01).
export const FIRST_VISIT = {
  line: 'Verified trades, straight from the broker. Losses included.',
  how: FOOTER.how, // the arrow is drawn aria-hidden (app/first-visit.tsx)
  dismiss: 'Dismiss this note',
  demo: 'Demo records are marked Demo.',
  hint: 'Swipe ← for profile',
} as const;
export const NAV = { stocks: 'Trades by stock' } as const;
// Fix #9 (POLICY F3a): the Verified badge's title and the footer's Verified sentence share this one definition.
export const VERIFIED_MEANING = 'Imported read-only from the trader’s broker. It doesn’t verify identity or imply endorsement.';
export const verifiedMeansFooter = () => `“Verified” means ${VERIFIED_MEANING[0].toLowerCase()}${VERIFIED_MEANING.slice(1)}`;
// end F-13



// A11Y-FIXES: feed (group 2)
// #18 (WCAG 2.5.3, 4.1.2): the card's Like button is named by its visible text ("Like" / "Liked", state in aria-pressed);
// this note is its accessible description.
// ponytail: LIKES.likeLabel is now unused but kept in place (shared block of the feed's copy) — delete it with the next LIKES edit.
export const A11Y_FEED = {
  likeNote: 'Only you can see likes.',
} as const;
// end A11Y-FIXES feed



// A11Y-FIXES: copy, titles (group 3)
// #5: the join and share copy now come from fix cycle 2 (#59, PUBLIC_SHORT and the share prompt).
// #8 (POLICY F3a): the trade and month images' alts, the recap description and the back links now come from F-10/F-12
// (lib/trade-share.ts, lib/recap.ts, RECORD_STRIP.link), which carry no completeness claim (lib/a11y-fixes.test.ts).
// #10 (POLICY P2, F3a): a demo profile says it is demo data; "connected accounts" only on a broker record.
export const DEMO_PROFILE = {
  line: 'Demo data, not a real broker record.',
  connectedOnly: 'Only trades from connected accounts are shown.',
} as const;
// #23 (POLICY A1; WCAG 1.4.1, 1.3.1): the word beside a percent, from the printed sign (lib/open-split.ts#tone), so
// "0.0%" is never called a gain or a loss.
// F-19 (#57): the words live in lib/format.ts (toneWord), one vocabulary; signWord reads them by the printed sign.
export const SIGN_WORD: Record<Tone, string> = { up: toneWord('up'), down: toneWord('down'), flat: toneWord('flat') };
export const signWord = (x: number): string => toneWord(tone(x));
// #20, #21: route titles and the root 404 page now come from fix cycle 2 (#59); app/t/[symbol] calls notFound().
// end A11Y-FIXES copy

// Privacy work (2026-11-01): the launch gate's closed states (lib/launch-gate.ts, committee D6–D8). No date, no promise.
export const LAUNCH = {
  closed: "Sign-up isn't open yet. Existing accounts can still sign in.",
  closedAfter: "Sign-up isn't open yet. That sign-in isn't linked to an account.",
  connectClosed: "Connecting a brokerage isn't open yet.",
  // UX lead re-sit 4: while sign-up is closed /login is only for existing accounts.
  signInTitle: 'Sign in',
} as const;

export const LEGAL_PLACEHOLDER = {
  termsTitle: 'Terms of Service',
  privacyTitle: 'Privacy Policy',
  placeholder: 'Placeholder: the owner supplies the final text before launch.',
} as const;

export const LOGIN_MAIL = {
  subject: 'Your Stock Social sign-in link',
  text: (url: string) => `Open this link to sign in to Stock Social. It works once, for 15 minutes.\n\n${url}\n\nIf you did not ask for it, ignore this email.`,
} as const;

// OPTIONS (docs/features/logs/options/plan.md D5, D6, D8): the option words, the plan's own. Functions take numbers and
// already formatted percents only (this file does not format returns). No direction, outcome or urgency words, and no
// countdown: an expiry is an absolute date (expiryText).
const optionPart = (n: number, one: string) => counted(n, one);
const OPTION_LINE_HEAD = (n: number, winPct: string) => `Options: ${counted(n, 'trade')} · ${winPct} wins · `;
export const OPTIONS = {
  // Fix round 3 (user test, business lead B4): the headline's qualifier reads "Excluding options" everywhere.
  shareLabel: 'Excluding options',
  // D5: the one line while the consent gate is closed. Zero parts are dropped.
  gated: (closes: number, open: number) => {
    const parts = [closes > 0 ? optionPart(closes, 'option trade') : '', open > 0 ? optionPart(open, 'open option') : ''].filter(Boolean);
    // Fix round 3 (UX N6): plain words; the link to /how is its own short link (howLink).
    // Legal re-sign (fix round 4): these words exactly.
    return `${parts.join(' and ')} imported. Option results aren't shown on this record.`;
  },
  howLink: 'How options are counted',
  // Fix round 3 (business lead B2): the options grid's row label.
  gridLabel: (n: number) => `Options · ${counted(n, 'trade')}`,
  // Fix round 3 (item 8): an option row's link names the whole row and where it goes.
  rowName: (underlying: string, chip: string, exp: string, figure: string) => `${underlying} ${String(chip).toLowerCase()}, ${exp}, ${figure}, stock page`,
  // D6: "Options: 14 trades · 36% wins · -22.0% avg (-41.0% to -3.0%)".
  line: (n: number, winPct: string, avg: string, range: string | null) => `${OPTION_LINE_HEAD(n, winPct)}${avg} avg${range ? ` ${range}` : ''}`,
  lineHead: (n: number, winPct: string) => OPTION_LINE_HEAD(n, winPct),
  short: (closed: number, open: number) => `Short options not shown: ${count(closed)} closed, ${count(open)} open. Their risk has no fixed amount to measure a percent against.`,
  // Fix round 1 (QA 8): share closes removed by the exercise-day rule are named as share trades, never option trades.
  technical: (n: number, shares = 0) => `${counted(n, 'option trade')} excluded: exercised, assigned or adjusted contracts and others the importer can't price exactly${shares > 0 ? `, and ${counted(shares, 'share trade')} held over an exercise or assignment day` : ''}.`,
  exerciseShares: (n: number) => `Excluded: ${counted(n, 'share trade')} held over an exercise or assignment day.`,
  // Fix round 1 (QA 9): open options the importer can't price exactly (not futures).
  openOther: (n: number) => `${counted(n, 'open option')} not shown: the importer can't price ${n === 1 ? 'it' : 'them'} exactly.`,
  listTitle: 'Option trades',
  // Fix round 2 (re-review C): the pane's closing note follows the gate: options are not shown while gated (or absent),
  // and summarized in the options line once open.
  paneNote: (open: boolean) => open
    ? "Closed share trades from connected accounts are published, losses included; option trades are summarized above. Positions with no recorded entry aren't shown."
    : "Closed trades from connected accounts are published, losses included. Options and positions with no recorded entry aren't shown.",
  call: 'Call option',
  put: 'Put option',
  unsupported: (n: number) => `Plus ${counted(n, 'open position')} not shown: futures and similar contracts are out of scope.`,
  noShareCloses: 'No closed share trades yet',
  chartNone: 'The chart shows share trades. None yet.',
  chartShareOnly: ' · excluding options',
  howTitle: 'Options',
  // Legal re-sign (fix round 4): these words exactly.
  how: 'Option results are shown only on records whose trader has consented to publishing them. Until then a record shows how many option trades and open options were imported, and its headline stats exclude options.',
  // Legal re-sign (fix round 4): alt text says exactly this phrase, lower case, after the figures it qualifies.
  altQualifier: 'excluding options',
  howMath: [
    // Fix round 1 (QA 7): per-contract fees can take a very cheap contract far below -100%.
    'An option trade\u2019s return is on what the contracts cost, fees included: a contract that expires worthless shows \u2212100%, and fees can take it lower, by a lot on very cheap contracts.',
    // Fix round 3: the summary is its own stats row; the headline excludes options (the label's words).
    'Option trades are summarized in their own row, with a range once there are 5 independent bets. The headline stats, chart, range and the order of traders exclude options.',
  ],
} as const;
const EXPIRY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
/** D6 (BL5, L6): the one expiry format, everywhere: "exp Dec 19, 2026". An absolute date only. */
export const expiryText = (isoDay: string) => `exp ${EXPIRY.format(new Date(`${isoDay.slice(0, 10)}T00:00:00Z`))}`;

// Everything above, flattened, for the banned-list test.
// F-2 PR-1: the feed's paging and end card (plan §1 PR-1). "today's": the order is seeded per UTC day; the list is
// capped (FEED_CANDIDATES), so the end card claims no completeness. The UX lead may rewrite it within that rule.
export const FEED = {
  end: 'End of today\u2019s feed.',
  publish: 'Publish your trades',
  more: 'Show more',
  failed: 'Couldn\u2019t load more.',
  retry: 'Retry',
  stale: 'Load today\u2019s feed',
  endLabel: 'End of feed',
  // Fix round 1 (UX follow-ups 2 and 8).
  loading: 'Loading\u2026',
  seeRecord: 'See your record',
  // Fix round 2 (UX, carried over): page 1's level-1 heading (visually hidden; later pages name their positions).
  heading: 'Trade feed',
};
// Fix round 1 (UX follow-ups 5 and 9): the polite announcement when cards are appended, and the no-JS page's position.
export const FEED_COUNTS = {
  added: (n: number) => `${n} more ${n === 1 ? 'trade' : 'trades'} loaded`,
  position: (from: number, to: number) => `Trades ${from} to ${to}`,
  // Fix round 2 (UX follow-up 2): the live line names the positions, so it changes on every append (the same text twice
  // is not announced again) and matches the no-JS page's heading.
  loaded: (from: number, to: number) => `Trades ${from} to ${to} loaded`,
};

// F-2 PR-2: follow and "Not interested" (plan §1 PR-2). Private: no count, the trader is never told. The durations come
// from the constant (O3: the owner may change it; the copy follows).
export const FOLLOW = {
  follow: 'Follow',
  following: 'Following',
  first: (h: string) => `Following @${h}. Only you can see this.`,
  followed: (h: string) => `Following @${h}.`,
  unfollowed: (h: string) => `Unfollowed @${h}.`,
  undo: 'Undo',
  failed: 'Couldn\u2019t save that. Try again.',
  more: (h: string) => `More for @${h}`,
  notInterested: (h: string) => `Not interested in @${h}`,
  hidden: `Hidden for ${EXCLUSION_DAYS} days.`,
  hiddenFrom: (h: string) => `@${h} is hidden from your feed for ${EXCLUSION_DAYS} days. Their profile stays public.`,
  title: 'Following and hidden traders',
  followingHeading: 'Following',
  private: 'Only you can see these lists. Traders are never told.',
  hiddenHeading: 'Not interested',
  hiddenExplain: 'Hidden from your feed. Their profiles stay public.',
  until: (d: string) => `until ${d}`,
  showAgain: 'Show again',
  showAgainFor: (h: string) => `Show @${h} again`,
  back: (h: string) => `@${h} is back in your feed.`,
  noneFollowing: 'You don\u2019t follow anyone yet.',
  noneHidden: 'No one is hidden.',
  settingsLink: 'Following and hidden traders',
  // Known-limits sweep (lists): each list pages 50 at a time; "Back to the newest" reuses CLOSES_PAGING.newest.
  olderFollowing: 'Older follows',
  olderHidden: 'Older hidden traders',
  olderExpired: 'Older expired hides',
};

// F-2 PR-4: private likes and rejected trades. No count anywhere; a like is a quiet state only the viewer sees.
export const LIKES = {
  more: (sym: string) => `More for this ${sym} trade`,
  like: 'Like',
  liked: 'Liked',
  likeLabel: 'Like. Only you can see likes.',
  saidLiked: 'Liked. Only you can see likes.',
  saidUnliked: 'Like removed.',
  mark: 'Liked by you',
  signIn: 'Sign in to like trades.',
  signInLink: 'Sign in',
  close: 'Close',
  hide: 'Hide this trade',
  hidden: 'Trade hidden. You won\u2019t see it again.',
  tray: 'Hide trade',
  title: 'Liked trades',
  private: 'Only you can see your likes. Traders are never told and no one sees a count. Likes help order your own feed.',
  none: 'You haven\u2019t liked a trade yet. Double-tap a trade in the feed to like it.',
  remove: 'Remove',
  removeFor: (s: string) => `Remove like on ${s}`,
  closed: (s: string, d: string) => `${s}, closed ${d}`,
  older: 'Older likes',
  back: 'Following and hidden traders',
  link: 'Liked trades',
};

// F-2 PR-3: the suggestions section (plan §1 PR-3), the same for every viewer. No performance number on a row (a number
// would make it a performance screen: the pane it opens carries the record and the disclaimer); reasons are fixed
// templates with no ticker slot, each true against its inputs (lib/discovery/section.ts#reasonFor). Scanned by
// lib/copy.test.ts against PROMO and the suggestion word list (no buy, sell, hold, pick, signal, advice, price target;
// no "Suggested", "Recommended", "Top", "Best", "AI").
// Fix round 1: the UX lead's heading and line (true signed in or out; the order is the TR-9 lower bound, losses equal);
// one reason, the holding period (business lead demand 2); the tray says "Hide" so it is whole once revealed.
export const SECTION = {
  heading: "Other traders' records",
  explain: 'Ordered by how much evidence each record has. Losses count the same as gains.',
  holds: ['under a day', '1 to 7 days', '1 to 4 weeks', '1 to 6 months', 'over 6 months'].map((b) => `Typical holding period: ${b}`),
  skip: 'Skip to the disclaimer',
  tray: 'Hide',
  close: 'Close',
  incomplete: 'Import did not finish',
};

// F-2 PR-3b: "Similar trades" on a profile (owner decision O2). True signed out; no performance number on a row.
const HOLD_SPANS = ['under a day', '1 to 7 days', '1 to 4 weeks', '1 to 6 months', 'over 6 months'];
export const SIMILAR = {
  heading: 'Similar trades',
  explain: (handle: string) => `Other traders’ closed trades, held about as long as @${handle}’s typical trade, losses included.`,
  trade: 'Trade page →',
  held: HOLD_SPANS.map((b) => `Held ${b}`),
  closed: (symbol: string, day: string) => `${symbol} · closed ${day}`,
};

// ---- F-2 PR-5: hidden trades, personalization switches, personal section (docs/features/logs/F-2/plan-pr5-ux-lead.md) ----
// Durations come from the constants (lib/discovery/personal.ts#FADE_DAYS = 90), never typed twice.
const F2_DAYS = 90;
const HIDDEN_LINE_MAX = 1_000; // lib/likes.ts#HIDDEN_COUNT_MAX: past it the line says "1,000+"
export const HIDDEN_TRADES = {
  title: 'Hidden trades',
  explain: 'Trades you hid stay out of your feed until you show them again. Only you can see this list.',
  closed: (symbol: string, day: string) => `${symbol}, closed ${day}`,
  trade: 'Trade page →',
  showAgain: 'Show again',
  showAgainFor: (handle: string, symbol: string, day: string) => `Show again: @${handle}, ${symbol} closed ${day}`,
  back: (handle: string) => `@${handle}'s trade is back in your feed.`,
  none: "You haven't hidden a trade.",
  older: 'Older hidden trades',
  backLink: 'Following and hidden',
  // The feed's line, signed in and only when N > 0.
  line: (n: number) => `${n > HIDDEN_LINE_MAX ? `${HIDDEN_LINE_MAX.toLocaleString('en-US')}+` : n} ${n === 1 ? 'trade' : 'trades'} hidden by you.`,
  showThem: 'Show them',
  // The accessible name starts with the visible text (WCAG 2.5.3, review fix 4).
  showThemFor: (n: number) => `Show them: ${n > HIDDEN_LINE_MAX ? `${HIDDEN_LINE_MAX.toLocaleString('en-US')}+` : n} hidden ${n === 1 ? 'trade' : 'trades'}`,
};
export const PERSONALIZE = {
  title: 'Personalize your feed',
  link: 'Personalize your feed',
  on: 'On',
  off: 'Off',
  feedTitle: 'Personalize my feed',
  feedExplain: `Uses your follows, likes, hidden traders and hidden trades to order your feed and its “More like what you read” section. Each choice counts for ${F2_DAYS} days, fading over that time. Off: you get the order everyone gets, minus what you hid.`,
  activityTitle: 'Personalize with my activity',
  activityExplain: `Off unless you turn it on. When on, Stock Social records which records you see, how long you look, and which you skip or open, while you're signed in. Only the last ${F2_DAYS} days are used to order your feed. The record is kept until you clear it or delete your account.`,
  activityPaused: 'Not recorded or used while Personalize my feed is off.',
  clear: 'Clear my activity',
  saved: {
    feedOn: 'Personalize my feed is on.',
    feedOff: 'Personalize my feed is off. You get the order everyone gets, minus what you hid.',
    activityOn: 'Activity is on. Recording starts now.',
    activityOff: "Activity is off. Nothing new is recorded, and what was recorded isn't used. Clear my activity deletes it.",
    cleared: 'Your activity is cleared.',
    nothing: 'There was no activity to clear.',
  },
  // The feed's order line, signed in, personalize On, at least one choice in the window.
  // Names only the kinds of choice that count now (business lead Q11).
  orderLine: (follows: unknown, likes: unknown, hides: unknown, activity: unknown) => {
    const kinds = [follows && 'follows', likes && 'likes', hides && 'hides', activity && 'activity'].filter(Boolean) as string[];
    const list = kinds.length > 1 ? `${kinds.slice(0, -1).join(', ')} and ${kinds.at(-1)}` : kinds[0] ?? 'choices';
    return `Ordered using your ${list}.`;
  },
  change: 'Change',
  changeFor: 'Change: how your feed is ordered',
  // /me/following: "Not interested" rows that ran their 90 days (stored until removed, owner 2026-11-01).
  expiredHeading: 'No longer applied',
  expiredExplain: `These hides ran their ${F2_DAYS} days and no longer change your feed. They stay saved until you remove them.`,
  ended: (d: string) => `ended ${d}`,
  remove: 'Remove',
  removeFor: (handle: string) => `Remove @${handle}`,
  groupOn: (group: string) => `${group}: On`,
  groupOff: (group: string) => `${group}: Off`,
};
// /how (Q12: the documented method, POLICY F1): how a signed-in viewer's feed is ordered.
export const HOW_PERSONAL = {
  title: 'How your feed is ordered',
  // Fixes cycle 3, F3-7 (POLICY F1): the base order first. 48 and 10 are lib/feed.ts#RECENCY_HOURS and
  // lib/confidence.ts#RANK_MIN_BETS, written out so this client-safe file never imports the feed's database code; the test
  // in lib/fixes-cycle3.test.ts ties them.
  text: `Sign is never used, so a loss ranks like a gain of the same size. The base order uses how large each return is and how recent the close is (a close counts about a third as much after each 48 hours). Records with at least 10 independent bets whose likely range sits clearly above or below zero come first, a clear loss as much as a clear gain. Signed out, everyone gets the same order. Signed in, your own follows, likes and hides move traders up or down in your feed; with "Personalize with my activity" on, so do the records you look at, open or skip. Each choice counts for ${F2_DAYS} days, fading over that time. With "Personalize my feed" off you get the order everyone gets, minus what you hid. No security is ever suggested.`,
};
// H4 (business lead demand 6): the facts the Privacy Policy must state about F-2's preference data, from the same
// constants as the code. lib/discovery/f2-privacy.test.ts checks the policy page once it has text.
export const PREFERENCE_DATA = [
  'stored until you remove it or delete your account',
  `only the last ${F2_DAYS} days are used to order your feed`,
  'activity is recorded only if you turn on Personalize with my activity',
  'Clear my activity deletes it at once',
];
// Approval council fix #12: the empty feed in plain words (no developer instructions in the product).
export const FEED_EMPTY = {
  title: 'No trades yet',
  body: 'Verified records appear here once traders connect a broker.',
  publish: 'Publish your own',
};
export const SECTION_PERSONAL = {
  heading: 'More like what you read',
  explain: 'Traders like the ones you follow, like and read, ordered by how much evidence each record has. Losses count the same as gains.',
  similarHold: (handle: string) => `Similar holding period to @${handle}`,
  symbolsRead: 'Trades symbols you read',
  newToYou: 'New to you',
};
// ---- F-6 · Open positions in every number (docs/features/logs/F-6/plan.md §3) ----
// Percent and counts only (POLICY P3). Up and down are always printed, so an all-losing set reads "0 up, 5 down" (TR-4).
// `fmt` is lib/trades.ts#pct, passed in so this file keeps no dependency on the trade math.
type OpenCounts = { n: number; up: number; down: number; flat: number };
// A count and its word never wrap apart (business lead D4: no orphaned "0" at 360 px).
const upDown = (o: OpenCounts) => `${count(o.up)}\u00a0up, ${count(o.down)}\u00a0down${o.flat > 0 ? `, ${count(o.flat)}\u00a0flat` : ''}`;
// One date format for every "as of" (orchestrator review nit 6): the oldest read, UTC; the year only when it is not the
// current one.
export const asOfDay = (d: Date, now: Date = new Date()) =>
  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC', ...(d.getUTCFullYear() === now.getUTCFullYear() ? {} : { year: 'numeric' }) });
export const OPEN = {
  realizedLabel: 'Realized · closed trades',
  unrealizedLabel: 'Unrealized · open positions at current value',
  avgUnrealized: 'avg unrealized / position',
  // "6 open positions · 1 up, 5 down · −23.0% avg unrealized"; one position: "… · −4.0% unrealized".
  line: (o: OpenCounts & { avg: number }, fmt: (x: number) => string = String) =>
    `${counted(o.n, 'open position')} · ${upDown(o)} · ${fmt(o.avg)} ${o.n === 1 ? 'unrealized' : 'avg unrealized'}`,
  // The tile's caption under the big count (UX lead D2: the number is not repeated).
  positions: (o: OpenCounts) => `${o.n === 1 ? 'open position' : 'open positions'} · ${upDown(o)}`,
  combinedLabel: 'Including open positions at current value:',
  combinedTail: (n: number) => ` avg / result (${counted(n, 'result')})`,
  // The evidence line's scope, first (business lead D2): in place of "Past results: ", or before "Too early to tell".
  evidencePrefix: 'Closed trades: ',
  // The unrealized row's date (business lead D3); `day` from asOfDay.
  asOfLabel: (day: string) => ` · as of ${day}`,
  chartNote: 'Chart: closed trades only. Not plotted: ',
  asOf: (day: string) => `Unrealized, at current value, as of ${day}. Not in the closed-trade figures or the chart.`,
  feedLabel: 'Also open:',
  feedCounts: (o: OpenCounts) => ` ${counted(o.n, 'position')} · ${upDown(o)} · `,
  feedTail: (n: number, day: string) => `${n === 1 ? ' unrealized' : ' avg unrealized'}, as of ${day}`,
  tickerTitle: (symbol: string) => `Open positions in ${symbol}`,
  // Stock pages are dated too: a record that stopped refreshing never reads as current (orchestrator review 1).
  tickerTraders: (traders: number, day: string) => `, held by ${counted(traders, 'trader')}, as of ${day}.`,
  tickerNote: 'Not included in the figures above, which cover closed trades. These are open positions, not a prediction or a rating of the stock.',
  // No closed trades in the stock: there are no figures above to point to (review N2).
  tickerNoteBare: 'These are open positions, not a prediction or a rating of the stock.',
  compare: (line: string, day: string) => `Open positions as of ${day}: ${line} (not in the figures above).`,
  compareBare: (line: string, day: string) => `Open positions as of ${day}: ${line}.`,
  how: [
    'Open positions are shown at current value from the broker, each account’s holding separately, averaged with equal weight, with the date they were last read.',
    'The combined figure counts each closed trade and each open position as one result.',
    'The chart and the range cover closed trades only.',
    'Stock pages show only a total of open positions in that stock, never who holds them; each trader’s open positions are on their profile.',
  ],
};
// Every OPEN string as shown, for the copy walk below (its walker calls functions with placeholder arguments, which the
// count and date copy cannot take).
function openCopy(): string[] {
  const o = { n: 3, up: 1, down: 1, flat: 1, avg: -0.05 }, one = { n: 1, up: 0, down: 1, flat: 0, avg: -0.04 }, day = asOfDay(new Date(0));
  return [OPEN.realizedLabel, OPEN.unrealizedLabel, OPEN.avgUnrealized, OPEN.line(o), OPEN.line(one), OPEN.positions(o), OPEN.positions(one),
    OPEN.combinedLabel, OPEN.combinedTail(9), OPEN.evidencePrefix, OPEN.asOfLabel(day), OPEN.chartNote, OPEN.asOf(day), OPEN.feedLabel,
    OPEN.feedCounts(o), OPEN.feedTail(3, day), OPEN.feedTail(1, day), OPEN.tickerTitle('ABC'), OPEN.tickerTraders(2, day), OPEN.tickerNote,
    OPEN.tickerNoteBare, OPEN.compare('x', day), OPEN.compareBare('x', day), ...OPEN.how];
}

export function allCopy(): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'string') out.push(v);
    else if (typeof v === 'function') { const r = (v as (...a: never[]) => unknown)(...(['x', 2, 1] as never[])); Array.isArray(r) ? r.forEach(walk) : out.push(String(r)); }
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  [LAUNCH, SIGNIN, TRUST_NOTICE, PROFILE, CONSENT, RECORD_BODY, SHARE_CARD, WHOLE_RECORD, RECORD_STRIP, RESULT, PORTAL, HOW, SETTINGS, CLOSES_PAGING, FOOTER, LEGAL_PLACEHOLDER, LOGIN_MAIL, FEED, FEED_COUNTS, FOLLOW, SECTION, SIMILAR, LIKES, HIDDEN_TRADES, PERSONALIZE, SECTION_PERSONAL, HOW_PERSONAL, PREFERENCE_DATA, FEED_EMPTY, FIXES_LABELS, STATUS_LINE /* FIXES-LABELS: status */, openCopy(), /* OPTIONS */ OPTIONS,
    /* F-16 */ HIDDEN_NOTICE, RETIRED_NOTICE, HIDDEN_OWN, TRUST_LINE, TAKEDOWN].forEach(walk);
  return out;
}

// ---- F-3 · Record tools and billing (docs/features/logs/F-3/plan.md; legal committee conditions in
// docs/features/logs/F-3/committee-2026-11-01.md). Additive block; its own checks are in lib/record-tools.test.ts.
const billingDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
export const RECORD_TOOLS = {
  title: 'Record tools',
  what: 'Put 2 to 4 public trader records side by side in the order you choose, save the comparison, and keep private notes only you can see.',
  free: 'Trader records stay free to view without a subscription.',
  trader: 'Record tools is included with your connected record.',
  removedNotice: 'A trader in your views or notes deleted their account; they and your note were removed.',
  dismiss: 'OK',
  removedAdvance: 'If a trader deletes their account, they leave your views and your note about them is deleted.',
  lapsed: 'Your subscription has ended. The comparison is off; your saved views and notes stay here to read, edit, download or delete.',
  endsOn: (d: Date) => `Your subscription ends on ${billingDate(d)}. Record tools stays on until then.`,
  pastDue: (d: Date) => `Your last payment did not go through. You keep Record tools until ${billingDate(d)}. Update your card in Manage subscription.`,
  viewsTitle: 'Your saved views',
  noViews: 'No saved views yet. Create one to compare 2 to 4 traders.',
  traders: (n: number) => (n === 1 ? '1 trader' : `${n} traders`),
  newViewLabel: 'Name (optional)',
  createView: 'Create view',
  viewsFull: 'You have 20 saved views, the maximum. Delete one to create another.',
  notesTitle: 'Your notes',
  noNotes: 'No notes yet.',
  allViews: 'All views',
  renameSummary: 'Rename view',
  renameLabel: 'View name',
  saveName: 'Save name',
  addLabel: 'Add a trader by exact handle',
  addButton: 'Add',
  followLabel: 'Or choose someone you follow',
  followChoose: 'Choose…',
  // Known-limits sweep (lists): shown only when more than FOLLOW_OPTIONS_MAX (lib/record-tools.ts) are followed.
  followMore: 'Showing the first 100 you follow, A to Z. Type a handle above to add anyone else.',
  followMoreNew: 'Showing the first 100 you follow, A to Z. Add anyone else by handle after you create the view.',
  addHint: 'Add 2 to 4 traders to compare.',
  addOneMore: 'Add one more trader to compare.',
  full: 'This view has 4 traders, the maximum. Remove one to add another.',
  position: (i: number, n: number) => `${i} of ${n}`,
  moveUp: 'Move up', moveDown: 'Move down', remove: 'Remove',
  noteLabel: (h: string) => `Private note about @${h} (only you can see it)`,
  noteCount: (n: number) => `${n.toLocaleString('en-US')} of 2,000 characters`,
  saveNote: 'Save note', deleteNote: 'Delete note',
  noteSummary: (h: string, has: boolean) => (has ? `Your private note about @${h}` : `Add a private note about @${h}`),
  lockedAdd: 'Adding and comparing traders needs a subscription. Your views and notes stay yours.',
  deleteView: 'Delete view',
  deleteViewConfirm: (name: string) => `Delete "${name}"? Your notes stay.`,
  keep: 'Keep it',
  updated: (d: Date) => `Updated ${billingDate(d)}`,
  rows: { closed: 'Closed trades', winRate: 'Win rate', avg: 'Avg return / trade', range: '95% range', low: 'Lower end of range', evidence: 'Evidence', drawdown: 'Max drawdown (per-trade, equal-weight)', excluded: 'Sells excluded (no certain entry)' },
  importing: 'Importing: figures appear when the import finishes.',
  noTrades: 'No closed trades yet.',
  messages: {
    created: 'View created.', renamed: 'Name saved.', added: (i: number, n: number) => `Trader added in position ${i} of ${n}.`,
    moved: (i: number, n: number) => `Trader moved to position ${i} of ${n}.`, removed: 'Trader removed from this view. Your note stays.',
    deleted: 'View deleted.', noteSaved: 'Note saved.', noteDeleted: 'Note deleted.',
    unknown: 'No trader has that exact handle.', duplicate: 'That trader is already in this view.', name: 'Give the view a name.',
    noteLong: 'Notes can be up to 2,000 characters.', noteSelf: 'You cannot keep a note about your own record.',
  },
  account: 'Account', download: 'Download my data', open: 'Open Record tools',
} as const;
export const BILLING = {
  title: 'Subscribe to Record tools',
  testMode: 'Test mode, no real charge',
  whatYouGet: 'What you get: side-by-side comparison of 2 to 4 public records, up to 20 saved views, and one private note per trader. Trader records stay free to view without a subscription.',
  planMonthly: 'Monthly: $9.99 per month plus applicable sales tax',
  planAnnual: 'Yearly: $99.99 per year plus applicable sales tax',
  noTrial: 'No free trial. You are charged today.',
  renewMonthly: (next: Date) => `Monthly renews automatically every month at $9.99 plus tax. If you subscribe today, the next charge is on ${billingDate(next)}.`,
  renewAnnual: (next: Date) => `Yearly renews automatically every year at $99.99 plus tax. If you subscribe today, the next charge is on ${billingDate(next)}.`,
  cancelHow: 'To cancel: Account → Cancel subscription. Within 14 days of your first charge or of a yearly renewal, canceling ends it at once with a full refund; after that, it takes effect at the end of the paid period: you keep access until that date and are not charged again.',
  refund: 'Cancel within 14 days of your first charge, or of a yearly renewal, for a full refund. Otherwise there are no partial refunds, except for billing errors, a discontinued feature, or where the law requires one.',
  card: "You enter your card details on the payment processor's page. Stock Social never sees your card number.",
  agreeMonthly: 'I agree my subscription renews automatically at $9.99 per month plus tax until I cancel.',
  agreeAnnual: 'I agree my subscription renews automatically at $99.99 per year plus tax until I cancel.',
  subscribeMonthly: 'Subscribe: $9.99/month',
  subscribeAnnual: 'Subscribe: $99.99/year',
  notNow: 'Not now',
  signIn: 'Sign in to subscribe',
  errAgree: 'Tick the box to agree to automatic renewal.',
  errPlan: 'Choose a plan.',
  errCheckout: 'We could not open checkout. Nothing was charged. Try again.',
  errPortal: 'We could not open the billing page. Nothing changed. Try again.',
  unavailable: 'Subscriptions are not available right now. Trader records stay free to view.',
  notOpen: 'Subscriptions are not open yet. Trader records stay free to view.',
  accountTitle: 'Account',
  activating: 'Activating your subscription…',
  activatingSlow: 'Activation is taking longer than usual. You do not need to pay again; refresh this page in a minute.',
  checkAgain: 'Check again',
  plan: (p: 'monthly' | 'annual') => (p === 'annual' ? 'Plan: Yearly, $99.99 per year plus tax' : 'Plan: Monthly, $9.99 per month plus tax'),
  renewsOn: (d: Date, p: 'monthly' | 'annual') => `Renews on ${billingDate(d)} at ${p === 'annual' ? '$99.99' : '$9.99'} plus tax.`,
  receipt: 'Your receipt from the payment processor shows the total charged, including tax.',
  endsOn: (d: Date) => `Your subscription ends on ${billingDate(d)}. You keep Record tools until then and will not be charged again.`,
  keepIt: 'To keep it, open Manage subscription.',
  contact: (c: string) => `Billing questions: ${c}`,
  manage: 'Manage subscription',
  cancel: 'Cancel subscription',
  none: 'You have no subscription.',
  seeTools: 'See Record tools',
  lapsed: 'You have no active subscription. Your saved views and notes stay available to read, edit, download or delete.',
  subscribeAgain: 'Subscribe again',
  confirming: 'Your payment is being confirmed. You do not need to pay again. To stop it, open Manage subscription.',
  traderCanceled: 'Your subscription was canceled when you connected a brokerage. The unused part is refunded automatically; the payment processor emails you the details.',
  refunded: 'Your subscription ended with a refund.',
  downloadHelp: 'A JSON file with your saved views, notes and subscription status.',
  deleteBilling: 'If you subscribe to Record tools, deleting cancels it first; you are not charged again. We keep only the record of what you agreed to at checkout, for 3 years, without your name or email.',
  deleteNotes: "If you publish a record, other subscribers' private notes about you are deleted and you are removed from their saved views.",
} as const;
export { billingDate };
// ---- F-7 public-record traders (docs/features/logs/F-7/plan.md Round 4 item 1, Round 5 items 3-6; legal C9-C12, C15, C18,
// C24). Never "Verified"; no advice, signals or completeness claims (lib/f7-trust.test.ts walks every string).
export const isPublicRecord = (s: string): s is 'public' | 'public_demo' => s === 'public' || s === 'public_demo';
const publicLabel = (s: 'public' | 'public_demo') => (s === 'public_demo' ? `Demo · ${PUBLIC.badge}` : PUBLIC.badge);
const sales = (n: number) => counted(n, 'sale'), BUILT = 'Built from public filings.';
export const PUBLIC = {
  badge: 'Public filing', badgeTitle: 'Built from public filings, not from a broker connection. Not Verified: it does not verify identity or completeness.', kind: 'Company insider',
  notJoined: `${BUILT} This person has not joined Stock Social, has not connected a broker, has not reviewed this record and does not endorse it.`,
  since: (first: string, checked: string) => `Record since ${first} · last checked ${checked}`, notYet: 'not yet', correction: 'Request a correction or removal →',
  caveat: 'Filings can be late, amended or missing.', stale: 'This record may be out of date.',
  imageLine: 'This person has not joined Stock Social.', // the share image's line (the alt and unfurl carry notJoined)
  // The trade and month images' alt (og and twitter): the label and the not-joined line, never Verified or an amount.
  imageAlt: (what: string, s: 'public' | 'public_demo'): string => `${what} on Stock Social: ${publicLabel(s)}. ${PUBLIC.notJoined}`,
  cardLine: 'Company insider · from a public filing', cardFooter: 'See their record, wins and losses →',
  filing: 'Filing ↗', filingName: (symbol: string, day: string) => `Public filing for the ${symbol} sale closed ${day}, opens another site`,
  sold: 'Sold: filing ↗', bought: 'Bought: filing ↗', boughtName: (symbol: string) => `Public filing for the ${symbol} purchase, opens another site`, soldName: (symbol: string) => `Public filing for the ${symbol} sale, opens another site`,
  // F4-10 (cycle 4, C4-14; WCAG 2.5.3, 2.4.4): the trade page's filing link names start with their visible words and
  // tell purchases apart ("purchase 1 of 2"); the sale's names its close date. Replaces boughtName and soldName above on
  // the trade page.
  // Code review: the links are one per filing (a filing can hold several purchases), so they are numbered as filings.
  boughtNameOf: (symbol: string, n: number, of: number) => `Bought: filing${of > 1 ? ` ${n} of ${of}` : ''} for the ${symbol} purchase, opens another site`,
  soldNameOn: (symbol: string, day: string) => `Sold: filing for the ${symbol} sale closed ${day}, opens another site`,
  openTitle: 'Open positions', openNote: 'Only shares bought in open-market purchases shown in the filings and not yet sold. This is not the person’s full holdings, and current value isn’t available from the filings, so no percent is shown.',
  recap: 'Recaps list the month\u2019s closed trades built from public filings, and none can be hidden.',
  paneFoot: 'Closed trades built from public filings, losses included. Sales that can’t be priced from the filings are excluded and counted on the profile.',
  excluded: {
    no_price: (n: number) => `${sales(n)} excluded: no priced open-market purchase before them in the filings (for example shares received as pay).`,
    unreconciled: (n: number) => `${sales(n)} excluded: holdings didn't reconcile, possibly a stock split.`,
    derivative: (n: number) => `${counted(n, 'derivative transaction')} excluded: options and other derivatives are not matched.`, gift: (n: number) => `${counted(n, 'gift')} excluded: not an open-market sale.`,
    other: (n: number) => `${counted(n, 'other disposal')} excluded: not an open-market sale (for example shares withheld for tax).`, indirect: (n: number) => `${counted(n, 'transaction')} in indirectly held shares excluded.`,
  } as Record<string, (n: number) => string>,
  excludedOther: (n: number) => `${counted(n, 'transaction')} excluded for another reason.`,
  how: { title: 'Public filing records', link: 'Corrections and removal requests', lines: [
    'Some profiles are built from company insiders’ transaction reports on the securities regulator’s public filing system. These people have not joined Stock Social.',
    'Only open-market purchases and open-market sales are matched, first in, first out, per security. Returns come from the prices in the reports, before fees.',
    'Shares received any other way (grants, exercises, gifts, earlier holdings) have no known cost, so a sale that uses them is excluded and counted, never estimated. Indirect holdings and derivatives are excluded too.',
    'Filings can be late, amended or missing. An amendment replaces what it amends and the record is rebuilt.', 'Open positions show symbols only: the filings give no current price. "Public filing" is not Verified and does not verify identity or completeness.'] },
  page: { title: 'Public filing records', askTitle: 'Ask for a correction or removal', unset: 'Requests open before launch.',
    description: 'What Public filing records are: built from company insiders’ public transaction reports. The person has not joined Stock Social and has not reviewed the record.',
    ask: 'If this is your record, or something in it is wrong, write to the address below. We will review your request and reply.', lines: [
      'Profiles marked "Public filing" are built from company insiders’ transaction reports on the securities regulator’s public filing system, not from a broker connection.',
      'The person has not joined Stock Social, has not connected a broker, has not reviewed the record and does not endorse it.',
      'Only open-market purchases matched to later open-market sales are shown, as percentages. Sales that can’t be priced from the filings, indirect holdings and derivatives are excluded and counted on each profile.',
      'Filings can be late, amended or missing, so a record can be out of date or partial.'] },
};
// The profile's exclusion lines, one per reason above 0, in a fixed order; a reason this release doesn't name is still counted.
export function publicExclusions(excluded: Record<string, number>): string[] {
  const known = Object.keys(PUBLIC.excluded), other = Object.entries(excluded).filter(([k, n]) => !known.includes(k) && n > 0).reduce((a, [, n]) => a + n, 0);
  return [...known.filter((k) => (excluded[k] ?? 0) > 0).map((k) => PUBLIC.excluded[k](excluded[k])), ...(other ? [PUBLIC.excludedOther(other)] : [])];
}

// Fixes cycle 2 (trust rows, approval council 2026-11-01), fix #5 (POLICY P6/P3). The join card makes no claim about
// what is public (the connect step lists it exactly); it says what stays private. Never "only percentages": the handle,
// name, symbols, dates, broker name, open positions and published reasons are public too.
export const PUBLIC_SHORT = {
  join: 'Read-only broker connection. Sizes, prices and balances stay private. 18+.',
  // The owner's share prompt: built from lib/privacy-fields.ts PUBLIC_FIELDS (one list, no hand-kept copy), plus the
  // profile's own fields and the trader's published reasons.
  sharePrompt: (fieldWords: string[]) =>
    `Public: your handle, display name, any reasons you publish, ${fieldWords.slice(0, -1).join(', ')}, and ${fieldWords.at(-1)}. Losses are included. Never sizes, prices or balances. Your broker login stays private.`,
};

// ---- F-19 · What's-this line (first slice: the constant and its test, lib/range-note.f19.test.ts). The range printed
// beside an average is the arithmetic range of the average per trade (lib/record-card.ts#cardEvidence), not the spread
// of single trades.
// ponytail: not shown on any screen yet — the F-19 sweep rework places it on the stats-row What's-this after F-18 merges.
export const RANGE_NOTE = 'the range is for the average, not one trade';

// FIXES-LABELS: status
// F-11 / D-12 / fix #4 (docs/features/logs/fixes-labels/plan.md §2, docs/features/F-11): the record status line, in the
// design system council's settled wording (PR #48, §2.3 R3 and the StatusLine rows). Facts only: idle means no sync,
// never no closes; no verdict and no completeness words. Params are already formatted dates (lib/date-text.ts) and
// labels; lib/record-status.ts is the only caller.
export const STATUS_LINE = {
  since: (d: string) => `Record since ${d}`, // ‹Mon D, YYYY›
  lastClose: (d: string) => `Last close ${d}`,
  updated: (when: string) => `updated ${when}`, // ‹relative› on live pages, ‹Mon D, YYYY› on cached renders
  justNow: 'just now', // under a minute
  idle: (d: string) => `not updated since ${d}`, // no successful sync for 30 days; a fact, per record
  frozen: (d: string) => `Disconnected ${d} · record frozen`, // outranks every freshness date
  instDisconnected: (inst: string, d: string) => `${inst} disconnected ${d}`, // one of several connections
  removed: (d: string) => `Account removed ${d}`, // TR-5, on the account's row
  removedNumbered: (label: string, d: string) => `${label} removed ${d}`, // QA round 2 (N8): "Account 2 of 2 removed ‹date›"
  // QA round 2 (N7): every live account removed. PR #85 review (B1): not "record frozen" (that comes from a confirmed
  // disconnect only), so the live "updated" part follows on line 2.
  allRemoved: (d: string) => `No account connected since ${d}`,
  disconnectedNumbered: (label: string, d: string) => `${label} disconnected ${d}`, // PR #85 review (nit 2): a row of a disconnected connection on a partly disconnected record
  accountLine: (label: string, inst: string) => `${label} · ${inst}`,
  accountOf: (i: number, n: number) => `Account ${i} of ${n}`,
  // The council's row 1 says "Demo"; "Demo data" is kept because an existing test asserts it on the profile
  // (app.spec:152). One-token change once that expectation moves.
  demoLink: 'Demo data',
  accountsLabel: 'Accounts in this record',
};
// ---- CHORES-3 (approval council cycle 3 chores; docs/features/logs/chores-cycle3/plan.md) ----
// K20: the home link preview. The design system council's positioning line (docs/direction/design-system-2026-11-01.md
// :27) and, while demo records exist, its Demo sentence (:441). No product name, logo, figure or completeness claim
// before the name is cleared (POLICY T5a). D27's first-visit line (FIRST_VISIT.line) is not changed.
// C3-39: Record tools' entry points while checkout is closed for the viewer (each matches /tools' own line).
export const CHORES_3 = {
  position: 'Closed trades imported read-only from connected broker accounts. Losses included.',
  homeTitle: 'Closed trades imported read-only from connected broker accounts.',
  losses: 'Losses included.',
  demo: 'Demo records are marked Demo.',
  seeToolsNotOpen: 'See Record tools (not open yet)',
  seeToolsUnavailable: 'See Record tools (not available right now)',
  backToFeed: 'Back to the feed',
} as const;
// end CHORES-3

// ---- F-16 · Trust and safety slice (docs/features/F-16-trust-and-safety-slice.md; plan
// docs/features/logs/F-16-F-17/plan.md §0.6, §5.4). Additive block. PRODUCT_NAME is used by the new F-16/F-17 copy
// only (existing literals stay); a future rename (POLICY T5a) then changes one constant.
export const PRODUCT_NAME = 'Stock Social';
// The neutral 404 notices of app/u/[handle]/not-found.tsx (plan §2.1). Never "reported", "review" or a reason, no
// name, figure or badge, no link to a new handle. Unknown handles keep app/not-found.tsx's generic page and title.
export const HIDDEN_NOTICE = {
  title: `Profile not available · ${PRODUCT_NAME}`,
  h1: 'Profile not available',
  line: 'This profile is not available right now.',
  // Fix round 1 (review item 2): the name shown in a viewer's own lists (follows, Not interested, Record tools views)
  // for a trader the owner hid, in place of their display name; the row and its unfollow or remove keep working.
  name: 'Profile not available',
} as const;
export const RETIRED_NOTICE = {
  title: `Handle no longer in use · ${PRODUCT_NAME}`,
  h1: 'This handle is no longer in use',
  line: 'Links to this address no longer lead to a profile.',
} as const;
// Q9 (plan §2.1): the one private line a hidden trader sees on their own profile's notice. Neutral: never "reported",
// "review" or a reason. Rendered only to that signed-in trader, on a private, no-store 404.
// Fix round 1 (review item 7): the download is Record tools' "Download my data" (/account/export: saved views, notes and
// subscription status), so the line says what it holds and links to it, beside the settings link.
export const HIDDEN_OWN = {
  line: 'Only you see this: your profile is not shown to others right now. Your settings still work, and you can still download your saved views and notes.',
  settings: 'Settings',
  download: 'Download my data',
} as const;
// The anti-impersonation line (plan §5.4, v2 B7; app/trust-foot.tsx). Draft: the owner flips `approved` after approving
// the wording (F-16 Open questions); until then it renders only in the sandbox (lib/takedown.ts#impersonationLineShown).
// Plain text, names no platform, says nothing about identity or verification. Literally true while no record-based
// message exists (the only mail is the sign-in link, LOGIN_MAIL).
export const TRUST_LINE = {
  approved: false,
  text: `${PRODUCT_NAME} never messages anyone about a trading record. Anyone who contacts you elsewhere using this profile isn't acting for ${PRODUCT_NAME}.`,
} as const;
// The notices and takedown page (plan §5.7; app/takedown/page.tsx). Draft until the owner flips `approved` (and sets
// TAKEDOWN_CONTACT, a role mailbox). No legal-status wording, agent title or reply time (lib/f16-static.test.ts).
export const TAKEDOWN = {
  approved: false,
  title: `Notices and takedown requests · ${PRODUCT_NAME}`,
  draft: 'Draft: this wording has not been approved yet.',
  h1: 'Notices and takedown requests',
  lines: [
    `Use this page to tell us about something on ${PRODUCT_NAME} that you believe infringes your copyright, impersonates you or someone else, shares personal information or breaks the law.`,
    'To report a profile, use "Report this profile" on it instead.', // fix round 2 (BL6)
    'Include the page address, what is wrong and how we can reply. For a copyright notice, say which of your works it uses.',
    'Sending a notice does not remove anything by itself. A person reads each one.',
  ],
  contactTitle: 'Where to send it',
  unset: 'The contact address is not set yet.',
  link: 'Notices and takedown requests',
} as const;
// end F-16

// F-23 · Public payload precision (docs/features/F-23-public-payload-precision.md)
export const F23_COPY = {
  // The chart's end line when the first and last close fall on one UTC day (one date, not the same date twice).
  chartEndsOne: (a: string) => `First and last close ${a}`,
} as const;
// end F-23
// FIXES-CYCLE4-PART2 (F4-4, F4-8; docs/features/logs/fixes-cycle4/committee-part2-2026-11-01.md). Additive: no existing
// constant changes.
export const FIXES_CYCLE4_PART2 = {
  // F4-4 (C4-9; business lead, POLICY F3a): the month list's heading on every record (the F-7 form), never "All trades".
  monthHeading: 'Closed trades this month',
  // F4-4: the foot of a trader with option closes names closed share trades and keeps TR-1's "none can be hidden"
  // (FL.monthFoot itself is unchanged for every other trader).
  monthFootShares: {
    real: "Recaps list the month's closed share trades from connected accounts, and none can be hidden.",
    demo: "Recaps list the month's Demo share trades, not from a real broker, and none can be hidden.",
  },
  // F4-8 (C4-12; UX lead): the home preview's sentence while the feed can show a public-filing record. It mirrors the
  // Demo sentence (CHORES_3.demo) and reuses the root description's "built from public filings" (app/layout.tsx).
  homePublic: 'Records built from public filings are marked Public filing.',
} as const;
// end FIXES-CYCLE4-PART2
