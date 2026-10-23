// Fixed product copy for F-1 (docs/features/logs/F-1/plan.md §2, the UX lead's strings verbatim).
// Every string here is tested against the banned-claims list (lib/copy.test.ts). Change copy here only.
// F-1 PR-3 fix round 4 (UX lead demand 2): every count goes through lib/format.ts (thousands grouped: "2,828").
import { count, counted } from './format.ts';
import { CLOSES_PAGE } from './paging.ts';

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
  excludedPositions: (n: number) => `${counted(n, 'earlier position')} excluded: no matching entry in the imported history.`,
  excludedFuture: (n: number) => `${counted(n, 'imported trade')} excluded: dated in the future by the broker.`,
} as const;

// S4 consent (the UX lead's strings): the depth of the import, named before anything is read.
export const CONSENT = {
  title: 'Confirm what gets imported',
  // Committee fix (item 7): no lead line (the notice already said it) and one scope line, so the primary fits 375×667.
  lines: (found: number, paper: number) => [
    'Full trade history your broker provides, from every account under this login',
    `${counted(found, 'account')} found${paper > 0 ? ` (${count(paper)} simulated, not imported)` : ''}`,
    'Closed trades are published on your public profile as percent returns. No amounts, quantities or prices.',
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
export type RecordState = 'importing' | 'connected' | 'failed' | 'none';
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
} as const;
export type ShareCardText = { label: string | null; tone: 'ok' | 'muted' | 'warn'; body: string | null; note: string | null };
// body null = show the stats; note null = show the evidence line.
export function shareCardText(x: { state: RecordState; demo: boolean; verified: boolean; empty: boolean }): ShareCardText {
  const body = x.empty ? SHARE_CARD.empty : null;
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
export type WholeRecordView = { stats: boolean; line: string | null; tone: 'muted' | 'warn' | null };
export function wholeRecordView(x: { state: RecordState; demo: boolean }): WholeRecordView {
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
  ],
  excludedTitle: 'What is excluded, and counted',
  excluded: [
    'Options, short sales and other activity the importer cannot price correctly.',
    'Transfers in, and sells with no recorded entry in the imported history (shown as excluded positions, never guessed).',
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

export const LEGAL_PLACEHOLDER = {
  termsTitle: 'Terms of Service',
  privacyTitle: 'Privacy Policy',
  placeholder: 'Placeholder: the owner supplies the final text before launch.',
} as const;

export const LOGIN_MAIL = {
  subject: 'Your Stock Social sign-in link',
  text: (url: string) => `Open this link to sign in to Stock Social. It works once, for 15 minutes.\n\n${url}\n\nIf you did not ask for it, ignore this email.`,
} as const;

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
};
// Fix round 1 (UX follow-ups 5 and 9): the polite announcement when cards are appended, and the no-JS page's position.
export const FEED_COUNTS = {
  added: (n: number) => `${n} more ${n === 1 ? 'trade' : 'trades'} loaded`,
  position: (from: number, to: number) => `Trades ${from} to ${to}`,
};

export function allCopy(): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'string') out.push(v);
    else if (typeof v === 'function') { const r = (v as (...a: never[]) => unknown)(...(['x', 2, 1] as never[])); Array.isArray(r) ? r.forEach(walk) : out.push(String(r)); }
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  [SIGNIN, TRUST_NOTICE, PROFILE, CONSENT, RECORD_BODY, SHARE_CARD, WHOLE_RECORD, RESULT, PORTAL, HOW, SETTINGS, CLOSES_PAGING, FOOTER, LEGAL_PLACEHOLDER, LOGIN_MAIL, FEED, FEED_COUNTS].forEach(walk);
  return out;
}
