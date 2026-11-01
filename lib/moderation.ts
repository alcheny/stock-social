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
// Fix round 1: `words` rules also run on the leet and squashed forms ("pa1d signals", "V I P signals", "mirr0r my
// trades"); `claim` rules hold a match only when it is a claim (claimShape below), not ordinary talk about a figure.
export type HoldRule = { rule: string; label: string; re: RegExp; words?: boolean; claim?: boolean };

// A closed list of top-level domains: "BRK.B", "3.5x", "v2.0", "10-K", "Q3/FY25", "approx.5", "U.S.", "e.g." and
// "Inc." never look like a domain (the name needs 2+ characters with a letter, the ending must be on this list).
const TLD = '(?:com|net|org|io|co|gg|app|xyz|info|biz|ly|link|club|live|tv|uk|ru|cc|site|online|shop|pro|vip|ai|chat|group|trade|finance|money|de|me|to|fm|page)';
// Endings strong enough to count with spaces around the dot ("example . com", "example .io"): never an English word.
// ponytail: spaced endings that are English words (".me", ".to", ".co", ".live", ".trade") publish — "nice trade . me
// too" would hold otherwise; the unspaced forms are held.
const TLD_SPACED = '(?:com|net|org|io|gg|xyz|app|info|biz)';
// A dot, also bracketed or parenthesised ("example[.]org", "example(.)net").
const DOT = String.raw`(?:\.|\s*[[(]\s*\.\s*[)\]]\s*)`;
const NUM = String.raw`[+]?\d[\d.,]*\s*(?:%|x\b)`; // a figure: 40%, 12.5 %, 10x
const NUM_ANY = String.raw`(?:${NUM}|%\s*\d[\d.,]*)`; // also "%04": the form a bidi-reversed figure leaves behind
const TIME_TOTAL = String.raw`(?:ytd|year[- ]to[- ]date|this (?:year|month|week|quarter)|last (?:year|month|week|quarter)|(?:a|per|each|every) (?:year|month|week|day|annum)|monthly|annuali[sz]ed|annually|yearly|p\.a\.|pa\b|\/\s*(?:yr|year|mo|month|wk|week|day)\b)`;
// First person as the subject of a gain ("I made", "we're up", "I was up"), and the verbs of a gain.
const FP = String.raw`(?:i|we|i've|we've|i'm|we're|i'd|we'd|i have|we have|i am|we are|i was|we were)`;
const GAIN = String.raw`(?:made|make|making|returned|return|returning|gained|gain|earned|netted|banked|profited|compounded|averaged|averaging|booked|cleared|up)`;
const CLAUSE = String.raw`(?:^|[.!?;:\n]\s+|[.!?;\n])`; // the start of the text or of a sentence

// ponytail: the phrase rules are English only — a non-English promotion publishes unless it carries a link, a contact
// shape or a figure claim; add per-language lists when non-English theses show up in the review queue.
export const HOLD_V2: HoldRule[] = [
  // Contact details first, so an address is named as contact rather than as a link.
  { rule: 'email', label: 'contact details', re: /\b[a-z0-9._%+-]+\s*(?:@|\(at\)|\[at\])\s*[a-z0-9-]+\s*(?:\.|\(dot\)|\[dot\]|\sdot\s)\s*[a-z]{2,}\b/i },
  { rule: 'phone', label: 'contact details', re: /(?<![\d.,])(?:\+\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?![\d.,]*\d)/ },
  // International numbers in groups ("+44 20 7946 0958"); a figure like "+4%" or "+40" is never one.
  { rule: 'phone', label: 'contact details', re: /(?<![\w.,+])\+\d{1,3}(?:[\s.-]\(?\d{2,4}\)?){2,4}(?![\d.,]*\d|\s*%)/ },
  // "@name", "@ name_1" (spaced: only a handle-shaped name, so "sold @ the open" publishes), "(at)name".
  // ponytail: a spaced "@ plainword" (no digit or _) publishes — it can't be told from "sold @ the open"; hold it too if
  // the review queue shows such contacts.
  { rule: 'at-contact', label: 'contact details', re: /(?<![\w.@])@[a-z_][a-z0-9_.]{2,}|(?<![\w.@])@\s+(?=[a-z0-9_.]*[_\d])[a-z_][a-z0-9_.]{2,}|[([]\s*at\s*[)\]]\s*[a-z_][a-z0-9_.]{2,}/i },
  { rule: 'contact-words', label: 'contact details', words: true, re: /\b(?:dm|pm|message|text|inbox|ping|e-?mail|hmu|whisper)\s+me\b|\bd[\s.\-_]*m\b[\s.\-_]*me\b|\bhit me up\b|\b(?:reach|contact) me\b|\badd me (?:on|at|via)\b|\bmy (?:channel|server|inbox|newsletter|course|dms?)\b|\bdms? (?:are|is) open\b/i },
  // Links and domains.
  { rule: 'url', label: 'link', re: /\b(?:h[tx]{2}ps?:\/\/|www\.)\S+/i },
  { rule: 'domain', label: 'link', re: new RegExp(String.raw`\b[a-z0-9-]*[a-z][a-z0-9-]*${DOT}${TLD}(?:\/\S*)?(?![\w.-]*\w)`, 'i') },
  { rule: 'domain', label: 'link', re: new RegExp(String.raw`\b[a-z0-9-]*[a-z][a-z0-9-]*(?:\s+\.\s*|\s*\.\s+)${TLD_SPACED}\b(?![\w.-]*\w)`, 'i') },
  { rule: 'domain-spelt', label: 'link', re: new RegExp(String.raw`\b(?!(?:the|an|this|that|like|of|post)\b)[a-z0-9-]{2,}\s*[([]?\s*dot\s*[)\]]?\s*${TLD}\b`, 'i') },
  // Copy trading and mirroring.
  { rule: 'copy-trading', label: 'copy trading', words: true, re: /\b(?:copy|mirror|auto[\s-]?copy)[\s-]?trad(?:e|es|ing|er|ers)\b|\b(?:copy|mirror|shadow)\s+(?:my|our|me|us)\b/i },
  { rule: 'follow-trades', label: 'copy trading', words: true, re: /\bfollow\s+(?:my|our)\s+(?:trades?|positions?|portfolio|moves?|entries|plays?)\b/i },
  // Signal or alert selling and paid groups.
  { rule: 'signals', label: 'promotion', words: true, re: /\b(?:paid|premium|vip|private)[\s_-]+(?:signals?|alerts?|group|channel|chat|room|community|server|membership)\b|\b(?:signals?|alerts?)[\s_-]+(?:group|channel|service|subscription|room)\b|\b(?:subscribe|subscription|sign up|join)\b[^.\n]{0,30}\b(?:signals?|alerts?|vip|premium|membership)\b|\b(?:selling|sell|buy|get|grab)\s+my\s+(?:signals?|alerts?)\b/i },
  // Picks, tips and price targets (a target with a figure, or someone's own: "analyst price targets" is talk).
  { rule: 'picks', label: 'picks or tips', words: true, re: /\b(?:my|our|top|hot|free|daily|weekly|best)\s+(?:stock\s+)?(?:picks?|tips?)\b|\bpicks? of the (?:day|week|month)\b|\bstock tips?\b|\bprice[\s_-]*targets?\s*(?:of|is|at|to|=|:)?\s*\$?\d|\b(?:my|our)\s+price[\s_-]*targets?\b/i },
  // Product, verified and official claims.
  { rule: 'product-name', label: 'platform claim', words: true, re: /\bstock[\s_-]*social\b/i },
  { rule: 'verified', label: 'platform claim', words: true, re: /ver[il]f[il]ed/i },
  { rule: 'official', label: 'platform claim', words: true, re: /\bofficial\s+(?:account|page|profile|team|partner|channel|trader|signals?|source|member|staff|admin)\b|\b(?:i am|i'm|we are|we're)\s+(?:the\s+|an?\s+)?(?:official|admin|moderator|staff)\b|\b(?:endorsed|sponsored)\s+by\b/i },
  // Stated returns, only as claims (decision 3; fix round 1): a first-person or possessive subject with a gain figure
  // (claimShape: a time total in the same sentence, or a big figure), or a sentence that opens with a figure and a time
  // total ("up 60% ytd", "YTD: +85%") — the first person left out. Price talk with another subject ("revenue grew 20%
  // a year", "shares fell 3% each day this week", "the index made 15% this year") publishes.
  { rule: 'return-first-person', label: 'return claim', claim: true, re: new RegExp(String.raw`\b${FP}\s+(?:[\w']+\s+){0,2}?(?:${GAIN}\s+(?:[\w']+\s+){0,2}?${NUM_ANY}|\+\d[\d.,]*\s*%)|\b(?:made|returned|gained|earned|netted|banked)\s+(?:me|us)\s+(?:[\w']+\s+){0,2}?${NUM_ANY}`, 'i') },
  { rule: 'return-possessive', label: 'return claim', claim: true, re: new RegExp(String.raw`\b(?:my|our)\s+(?:[\w']+\s+){0,2}?(?:returns?|gains?|profits?|performance|account|portfolio|port|p&l|pnl|equity)(?![\w&])[^.\n%]{0,30}?${NUM_ANY}|${NUM}\s+(?:returns?|gains?|profits?)\s+(?:on|in|for)\s+(?:my|our)\b|(?<![\w'])(?:portfolio|port|account|p&l|pnl)\s+(?:is\s+|was\s+)?(?:up\s+|(?=\+))${NUM_ANY}`, 'i') },
  { rule: 'return-time-total', label: 'return claim', re: new RegExp(String.raw`${CLAUSE}(?:(?:up|\+)\s*)?${NUM_ANY}\s*(?:(?:returns?|gains?|profits?|up|total|so far)\s+)?${TIME_TOTAL}(?![a-z])|${CLAUSE}${TIME_TOTAL}\s*[:,-]?\s*${NUM_ANY}`, 'i') },
];

// Fix round 1: a first-person or possessive figure is a claim when the same sentence has a time total, or the figure is
// big: 20% or more, a multiple of 2x or more, or a reversed "%NN" (only a bidi spoof leaves that shape). "I was up 12%
// then gave it back" and "my gains were small, 3%" are ordinary talk.
// ponytail: a single-trade gain under 20% with no time total publishes even in the first person ("I made 18% on this")
// — the verified record shows that trade anyway; lower BIG_CLAIM if the review queue shows such notes misleading.
export const BIG_CLAIM = 20;
const TIME_RE = new RegExp(TIME_TOTAL, 'i');
const FIG_RE = new RegExp(String.raw`%\s*\d[\d.,]*|[+]?(\d[\d,]*(?:\.\d+)?)\s*(%|x\b)`, 'gi');
function claimShape(text: string, at: number, match: string): boolean {
  const figs = [...match.matchAll(FIG_RE)];
  const last = figs[figs.length - 1];
  if (last) {
    if (last[0].startsWith('%')) return true;
    const v = parseFloat((last[1] ?? '').replace(/,/g, ''));
    if (last[2]?.toLowerCase() === 'x' ? v >= 2 : v >= BIG_CLAIM) return true;
  }
  const head = text.slice(0, at), tail = text.slice(at + match.length);
  const from = Math.max(head.search(/(?:[.!?](?=\s)|\n)(?!.*(?:[.!?](?=\s)|\n))/s) + 1, 0);
  const cut = tail.search(/[.!?](?=\s|$)|\n/);
  const sentence = head.slice(from) + match + (cut < 0 ? tail : tail.slice(0, cut));
  return TIME_RE.test(sentence);
}
const globalCopy = new Map<RegExp, RegExp>();
function ruleHolds(r: HoldRule, f: string): boolean {
  if (!r.claim) return r.re.test(f);
  let g = globalCopy.get(r.re);
  if (!g) globalCopy.set(r.re, (g = new RegExp(r.re.source, r.re.flags + 'g')));
  for (const m of f.matchAll(g)) if (claimShape(f, m.index!, m[0])) return true;
  return false;
}

// Figures written to dodge the rules read as figures: "40 percent", "40 pct" → "40%", "4O%" → "40%".
export function figures(s: string): string {
  return s.replace(/(\d)\s*(?:per\s?cent|pct)\b/gi, '$1%')
    .replace(/(?<![a-z])[+]?[\do][\do.,]*(?=\s*%)/gi, (m) => (/\d/.test(m) ? m.replace(/o/gi, '0') : m));
}

// Fix round 1: a word spelt out letter by letter with dots, spaces or dashes ("t.i.p.s", "V I P").
const SPELT: Record<string, string> = { tips: 'picks or tips', picks: 'picks or tips', signals: 'promotion', alerts: 'promotion', vip: 'promotion' };
const SPELT_RE = /(?<![\p{L}\p{N}])\p{L}(?:[\s.\-_]+\p{L}(?![\p{L}\p{N}])){2,}/gu;
function speltLabel(s: string): string | null {
  for (const m of s.matchAll(SPELT_RE)) {
    const w = m[0].replace(/[\s.\-_]/g, '');
    if (Object.hasOwn(SPELT, w)) return SPELT[w];
  }
  return null;
}

// Word lists of 8+ characters also match in leet and squashed forms ("v3r1f13d", "s t o c k s o c i a l",
// "c0py-trading"). Never applied to shorter words, numbers or $tickers (lib/text-safety.ts#leet).
export const LONG_WORDS: HoldRule[] = [
  { rule: 'product-name', label: 'platform claim', re: /stock\s?social/ },
  { rule: 'verified', label: 'platform claim', re: /ver[il]f[il]ed/ },
  { rule: 'official', label: 'platform claim', re: /official\s?(?:account|page|profile|team|partner)/ },
  { rule: 'copy-trading', label: 'copy trading', re: /(?:copy|mirror)\s?trad/ },
];

// Text displayed under a right-to-left override reads backwards; matching also sees each overridden run reversed, so
// a figure spoofed that way is read the way a viewer would see it.
const unOverride = (s: string) => s.replace(/‮([^‬⁩\n]*)/g, (_, run: string) => Array.from(run).reverse().join(''));

// The full verdict: status plus the label of the first rule that matched (null when published). Matching runs on the
// raw text and its skeleton (figures read as figures); `words` rules and LONG_WORDS also on leet and squashed forms.
export function moderateDetail(text: string): { status: ThesisStatus; rule: string | null } {
  const raw = String(text ?? '');
  const sk = figures(skeleton(raw));
  const forms = [...new Set([raw, sk, figures(skeleton(unOverride(raw)))])];
  const wordForms = [...new Set([...forms, ...[sk, ...leet(sk)].flatMap((f) => [f, squash(f)])])];
  for (const r of HOLD_V2) if ((r.words ? wordForms : forms).some((f) => ruleHolds(r, f))) return { status: 'held', rule: r.label };
  const spelt = speltLabel(sk);
  if (spelt) return { status: 'held', rule: spelt };
  for (const re of [...HOLD, ...PROMO]) if (forms.some((f) => re.test(f))) return { status: 'held', rule: 'promotion' };
  const long = [sk, ...leet(sk)].flatMap((f) => [f, squash(f)]);
  for (const r of LONG_WORDS) if (long.some((f) => r.re.test(f))) return { status: 'held', rule: r.label };
  return { status: 'published', rule: null };
}

export function moderate(text: string): ThesisStatus {
  return moderateDetail(text).status;
}
