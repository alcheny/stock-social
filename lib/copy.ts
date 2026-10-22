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
} as const;
// The vendor's own security page, linked from the notice. Configurable so the owner can point at the page the vendor publishes.
export const VENDOR_SECURITY_URL = process.env.NEXT_PUBLIC_VENDOR_SECURITY_URL || 'https://snaptrade.com/security';

// Own profile, first screen after sign-in (the committee's item 9): one status line, no celebration.
export const PROFILE = {
  youreIn: "You're in. Next: connect your brokerage.",
  changeHandle: 'Change handle',
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

// Everything above, flattened, for the banned-list test.
export function allCopy(): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'string') out.push(v);
    else if (typeof v === 'function') out.push(String((v as (s: string) => string)('x')));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  [SIGNIN, TRUST_NOTICE, PROFILE, LEGAL_PLACEHOLDER, LOGIN_MAIL].forEach(walk);
  return out;
}
