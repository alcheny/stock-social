// Fixed product copy for F-1 (docs/features/logs/F-1/plan.md §2, the UX lead's strings verbatim).
// Every string here is tested against the banned-claims list (lib/copy.test.ts). Change copy here only.

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
} as const;
// The vendor's own security page, linked from the notice. Configurable so the owner can point at the page the vendor publishes.
export const VENDOR_SECURITY_URL = process.env.NEXT_PUBLIC_VENDOR_SECURITY_URL || 'https://snaptrade.com/security';

// Own profile, first screen after sign-in (the committee's item 9): one status line, no celebration.
export const PROFILE = {
  youreIn: "You're in. Next: connect your brokerage.",
  changeHandle: 'Change handle',
} as const;

// S4 consent (the UX lead's strings): the depth of the import, named before anything is read.
export const CONSENT = {
  title: 'Confirm what gets imported',
  linked: 'Your brokerage is linked. Nothing has been imported yet.',
  lines: (found: number, paper: number) => [
    'Full trade history your broker provides',
    'Every account under this login',
    `${found} account${found === 1 ? '' : 's'} found${paper > 0 ? ` (${paper} simulated, not imported)` : ''}`,
    'Closed trades are published on your public profile as percent returns. No amounts, quantities or prices.',
    'A broker account can belong to one profile, ever.',
    'Your record stays public if you disconnect; deleting your profile removes it.',
  ],
  deadline: (when: string) => `Decide by ${when}, or this link is removed automatically.`,
  primary: 'Import my record',
  secondary: "Don't import",
} as const;

// S5 / S8 body by connection state (plan §8 item 3): the empty-record line only once the import is finished.
export const RECORD_BODY = {
  importing: 'Your trades appear here as they import.',
  connected: 'No closed trades yet. Your record starts with your first close.',
  none: 'No trades yet.',
  banner: (n: number) => `Importing your record · ${n} trade${n === 1 ? '' : 's'} so far`,
  finished: 'Import finished.',
  paperExcluded: (n: number) => `${n} simulated account${n === 1 ? '' : 's'} excluded: simulated trades are never part of a record.`,
  positionsTitle: 'Open positions',
  // A failed import is never shown as a whole record (TR-3): the line is visible to everyone, the retry to the owner.
  failed: 'The import did not finish, so this record may be incomplete.',
  retry: 'Try again',
} as const;
export type RecordState = 'importing' | 'connected' | 'failed' | 'none';
// The S8 empty-record line belongs to a finished import only; a failed one says so instead.
export const recordBodyCopy = (state: RecordState, closes: number): string | null =>
  state === 'importing' ? RECORD_BODY.importing : closes > 0 ? null : state === 'connected' ? RECORD_BODY.connected : RECORD_BODY.none;

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
  feed: 'Back to feed',
} as const;

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

export const FOOTER = { terms: 'Terms', privacy: 'Privacy', how: 'How records are calculated' } as const;

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
export function allCopy(): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'string') out.push(v);
    else if (typeof v === 'function') { const r = (v as (...a: never[]) => unknown)(...(['x', 2, 1] as never[])); Array.isArray(r) ? r.forEach(walk) : out.push(String(r)); }
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  [SIGNIN, TRUST_NOTICE, PROFILE, CONSENT, RECORD_BODY, SHARE_CARD, RESULT, HOW, SETTINGS, FOOTER, LEGAL_PLACEHOLDER, LOGIN_MAIL].forEach(walk);
  return out;
}
