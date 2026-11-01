// SERVER-ONLY: imports the compliance scanner's PROMO list (scripts/compliance.ts, which also loads node:fs and
// node:child_process; its CLI runs only under `import.meta.main`, lib/moderation-v2.test.ts proves the import runs
// nothing). Never import this file from a client component.
import { PROMO } from '../scripts/compliance.ts';
import { leet, skeleton, squash } from './text-safety.ts';

export type ThesisStatus = 'held' | 'published';

// Phase 1 moderation = rules + held-for-review queue (DESIGN §2.8). Hold, never silently drop.
// No g/y flags: those make RegExp#test stateful across calls.
// FROZEN (lib/moderation.test.ts snapshots it): new rules go in HOLD_V2 below.
export const HOLD: RegExp[] = [
  /guarantee/i, /risk[- ]?free/i, /can'?t lose/i, /\b100x\b/i, /to the moon/i,
  /dm me|join my|link in bio|t\.me\/|discord\.gg|whatsapp/i,
  /\b(buy|load up on) (now|before)\b/i, /financial advice/i,
];

// Labels are plain category words shown to the author ("Held for review: <label>").
export type HoldRule = { rule: string; label: string; re: RegExp };

// A closed list of top-level domains: "BRK.B", "3.5x", "v2.0", "10-K", "Q3/FY25", "approx.5", "U.S.", "e.g." and
// "Inc." never look like a domain (the name needs 2+ characters with a letter, the ending must be on this list).
const TLD = '(?:com|net|org|io|co|gg|app|xyz|info|biz|ly|link|club|live|tv|uk|ru|cc|site|online|shop|pro|vip|ai|chat|group|trade|finance|money)';
const NUM = String.raw`[+]?\d[\d.,]*\s*(?:%|x\b)`; // a figure: 40%, 12.5 %, 10x
const NUM_ANY = String.raw`(?:${NUM}|%\s*\d[\d.,]*)`; // also "%04": the form a bidi-reversed figure leaves behind
const TIME_TOTAL = String.raw`(?:ytd|year[- ]to[- ]date|this (?:year|month|week)|last (?:year|month|week)|(?:a|per|each|every) (?:year|month|week|day)|monthly|annuali[sz]ed|annually|p\.a\.)`;

// ponytail: the phrase rules are English only — a non-English promotion publishes unless it carries a link, a contact
// shape or a figure claim; add per-language lists when non-English theses show up in the review queue.
export const HOLD_V2: HoldRule[] = [
  // Contact details first, so an address is named as contact rather than as a link.
  { rule: 'email', label: 'contact details', re: /\b[a-z0-9._%+-]+\s*(?:@|\(at\)|\[at\])\s*[a-z0-9-]+\s*(?:\.|\(dot\)|\[dot\]|\sdot\s)\s*[a-z]{2,}\b/i },
  { rule: 'phone', label: 'contact details', re: /(?<![\d.,])(?:\+\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?![\d.,]*\d)/ },
  { rule: 'at-contact', label: 'contact details', re: /(?<![\w.@])@[a-z_][a-z0-9_.]{2,}/i },
  { rule: 'contact-words', label: 'contact details', re: /\b(?:dm|pm|message|text|inbox|ping|e-?mail|hmu|whisper)\s+me\b|\bhit me up\b|\b(?:reach|contact|add) me\b|\bmy (?:channel|server|inbox|newsletter|course)\b/i },
  // Links and domains.
  { rule: 'url', label: 'link', re: /\b(?:https?:\/\/|www\.)\S+/i },
  { rule: 'domain', label: 'link', re: new RegExp(String.raw`\b[a-z0-9-]*[a-z][a-z0-9-]*\.${TLD}(?:\/\S*)?(?![\w.-]*\w)`, 'i') },
  { rule: 'domain-spelt', label: 'link', re: new RegExp(String.raw`\b(?!(?:the|an|this|that|like|of|post)\b)[a-z0-9-]{2,}\s*[([]?\s*dot\s*[)\]]?\s*${TLD}\b`, 'i') },
  // Copy trading and mirroring.
  { rule: 'copy-trading', label: 'copy trading', re: /\b(?:copy|mirror|auto[\s-]?copy)[\s-]?trad(?:e|es|ing|er|ers)\b|\b(?:copy|mirror|shadow)\s+(?:my|our|me|us)\b/i },
  { rule: 'follow-trades', label: 'copy trading', re: /\bfollow\s+(?:my|our)\s+(?:trades?|positions?|portfolio|moves?|entries|plays?)\b/i },
  // Signal or alert selling and paid groups.
  { rule: 'signals', label: 'promotion', re: /\b(?:paid|premium|vip|private)\s+(?:signals?|alerts?|group|channel|chat|room|community|server|membership)\b|\b(?:signals?|alerts?)\s+(?:group|channel|service|subscription|room)\b|\b(?:subscribe|subscription|sign up|join)\b[^.\n]{0,30}\b(?:signals?|alerts?|vip|premium|membership)\b|\b(?:selling|sell|buy|get|grab)\s+my\s+(?:signals?|alerts?)\b/i },
  // Picks, tips and price targets.
  { rule: 'picks', label: 'picks or tips', re: /\b(?:my|our|top|hot|free|daily|weekly|best)\s+(?:stock\s+)?(?:picks?|tips?)\b|\bpicks? of the (?:day|week|month)\b|\bstock tips?\b|\bprice targets?\b/i },
  // Product, verified and official claims.
  { rule: 'product-name', label: 'platform claim', re: /\bstock[\s_-]*social\b/i },
  { rule: 'verified', label: 'platform claim', re: /verified/i },
  { rule: 'official', label: 'platform claim', re: /\bofficial\s+(?:account|page|profile|team|partner|channel|trader|signals?|source|member|staff|admin)\b|\b(?:i am|i'm|we are|we're)\s+(?:the\s+|an?\s+)?(?:official|admin|moderator|staff)\b|\b(?:endorsed|sponsored)\s+by\b/i },
  // Stated returns, only as claims (decision 3): first person or possessive, or a figure tied to a time total.
  { rule: 'return-first-person', label: 'return claim', re: new RegExp(String.raw`\b(?:i|we|i've|we've|i'm|we're|i have|we have|i am|we are)\s+(?:\w+\s+){0,2}?(?:made|returned|gained|earned|netted|banked|profited|up)\s+(?:\w+\s+){0,2}?${NUM_ANY}`, 'i') },
  { rule: 'return-possessive', label: 'return claim', re: new RegExp(String.raw`\b(?:my|our)\s+(?:\w+\s+){0,2}?(?:returns?|gains?|profits?|performance|account|portfolio|p&l|pnl)\b[^.\n%]{0,30}?${NUM_ANY}|${NUM}\s+(?:returns?|gains?|profits?)\s+(?:on|in|for)\s+(?:my|our)\b`, 'i') },
  { rule: 'return-time-total', label: 'return claim', re: new RegExp(String.raw`${NUM_ANY}\s*(?:(?:returns?|gains?|profits?|up|total|so far)\s+)?${TIME_TOTAL}(?![a-z])|\b${TIME_TOTAL}\s*[:,-]?\s*${NUM_ANY}`, 'i') },
];

// Word lists of 8+ characters also match in leet and squashed forms ("v3r1f13d", "s t o c k s o c i a l",
// "c0py-trading"). Never applied to shorter words, numbers or $tickers (lib/text-safety.ts#leet).
export const LONG_WORDS: HoldRule[] = [
  { rule: 'product-name', label: 'platform claim', re: /stock\s?social/ },
  { rule: 'verified', label: 'platform claim', re: /verified/ },
  { rule: 'official', label: 'platform claim', re: /official\s?(?:account|page|profile|team|partner)/ },
  { rule: 'copy-trading', label: 'copy trading', re: /(?:copy|mirror)\s?trad/ },
];

// Text displayed under a right-to-left override reads backwards; matching also sees each overridden run reversed, so
// a figure spoofed that way is read the way a viewer would see it.
const unOverride = (s: string) => s.replace(/‮([^‬⁩\n]*)/g, (_, run: string) => Array.from(run).reverse().join(''));

// The full verdict: status plus the label of the first rule that matched (null when published). Matching runs on the
// raw text and its skeleton; LONG_WORDS also on leet and squashed forms.
export function moderateDetail(text: string): { status: ThesisStatus; rule: string | null } {
  const raw = String(text ?? '');
  const forms = [...new Set([raw, skeleton(raw), skeleton(unOverride(raw))])];
  for (const r of HOLD_V2) if (forms.some((f) => r.re.test(f))) return { status: 'held', rule: r.label };
  for (const re of [...HOLD, ...PROMO]) if (forms.some((f) => re.test(f))) return { status: 'held', rule: 'promotion' };
  const sk = skeleton(raw);
  const long = [sk, ...leet(sk)].flatMap((f) => [f, squash(f)]);
  for (const r of LONG_WORDS) if (long.some((f) => r.re.test(f))) return { status: 'held', rule: r.label };
  return { status: 'published', rule: null };
}

export function moderate(text: string): ThesisStatus {
  return moderateDetail(text).status;
}
