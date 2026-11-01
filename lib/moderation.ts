// SERVER-ONLY: imports the compliance scanner's PROMO list (scripts/compliance.ts, which also loads node:fs and
// node:child_process; its CLI runs only under `import.meta.main`, lib/moderation-v2.test.ts proves the import runs
// nothing). Never import this file from a client component.
import { PROMO } from '../scripts/compliance.ts';
import { leet, skeleton, squash } from './text-safety.ts';

export type ThesisStatus = 'held' | 'published';
// Fix round 2: the plain explanation of each label, shown to the author (lib/report-copy.ts#heldLine).
export { RULE_EXPLAIN } from './report-copy.ts';

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
// Fix round 2: `claim: 'timed'` (a subject-dropped claim) holds only with a time total, or a span plus context; never
// on the size of the figure alone ("Up 25% after earnings" is price talk).
export type HoldRule = { rule: string; label: string; re: RegExp; words?: boolean; claim?: boolean | 'timed' };

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
// Fix round 2: "qtr" and "yr" forms too ("40% this qtr", "40% a yr").
const TIME_TOTAL = String.raw`(?:ytd|year[- ]to[- ]date|this (?:year|month|week|quarter|qtr|yr)|last (?:year|month|week|quarter|qtr|yr)|(?:a|per|each|every) (?:year|yr|month|week|day|annum|quarter|qtr)|monthly|annuali[sz]ed|annually|yearly|p\.a\.|pa\b|\/\s*(?:yr|year|mo|month|wk|week|day)\b)`;
// Fix round 2: a span ("in 2 weeks", "over the last 6 months", "since spring", "since 2025") counts as a time total only
// in a sentence with first-person or system context (CTX below): "shares fell 40% in 2 weeks" is price talk.
// ponytail: spans in days are left out ("I made 8% in 3 days" is how a single trade is described) — add them if the
// review queue shows "N% in N days" promotions.
const MONTH = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const SPAN = String.raw`(?:(?:in|over|within)\s+(?:the\s+)?(?:(?:past|last|first)\s+)?(?:\d+|a|one|two|three|four|five|six|seven|eight|nine|ten|twelve|few)\s+(?:weeks?|wks?|months?|mos?|years?|yrs?|quarters?|qtrs?)\b|since\s+(?:${MONTH}|spring|summer|fall|autumn|winter|(?:19|20)\d\d|the start of the year|new year)\b)`;
// First-person or system context for a span: a pronoun, "this/the system|strategy|setup|method", or a sentence that
// opens with a claim verb ("Made 30% since 2025").
const CTX = String.raw`\b(?:i|we|i'm|we're|i've|we've|me|us|my|our)\b|\b(?:this|the)\s+(?:system|strategy|setup|method)\b|^\s*(?:made|returned|gained|earned|netted|banked|compounded|averaged|doubled|tripled)\b`;
// First person as the subject of a gain ("I made", "we're up", "I was up"), and the verbs of a gain.
const FP = String.raw`(?:i|we|i've|we've|i'm|we're|i'd|we'd|i have|we have|i am|we are|i was|we were)`;
const GAIN = String.raw`(?:made|make|making|returned|return|returning|gained|gain|earned|netted|banked|profited|compounded|averaged|averaging|booked|cleared|up)`;
// The start of the text or of a sentence. Fix round 2: a stop right after a digit is a decimal point ("3.2% a year"),
// never a sentence break.
const CLAUSE = String.raw`(?:^|[.!?;:\n]\s+|(?<!\d)[.!?;]|\n)`;

// Fix round 2: "verified" as a claim. VF is the word (also "verifled"); the shapes: the word followed by an agent (by,
// via, on, through), an adjective on the trader, the record or the returns ("verified trader", "verified returns"), a
// state of the self or the record ("I'm verified", "my record is verified"), the product name beside it, or the
// word on its own. The verb with an object ("verified the guidance") and "unverified" publish.
const VF = 'ver[il]f[il]ed';
const VERIFIED_RE = new RegExp(String.raw`\b${VF}\s+(?:by|via|on|through)\b|\b${VF}\s+(?:[\w'-]+\s+)?(?:traders?|accounts?|profiles?|records?|returns?|results?|trades?|track record|performance|gains?|p&l|pnl|members?|users?|badge|status|investors?|portfolios?|history|seller|pro|expert|here)\b|\b(?:i'm|im|we're|i've been|we've been)\s+(?:(?:now|fully|officially|also|a|an|the)\s+)*${VF}\b|\b(?:i|we|everything|all|my\s+[\w']+|our\s+[\w']+|account|record|records|trades|returns|results|profile|performance|history|portfolio)\s+(?:(?:now|fully|also|all)\s+)?(?:is|are|am|was|were|be|been|got|get|gets|became|has been|have been)\s+(?:(?:now|fully|officially|also|all|a|an|the)\s+)*${VF}\b|stock[\s_-]*social\s*${VF}|${VF}\s*(?:on\s+)?stock[\s_-]*social|^\W*${VF}\W*$`, 'i');
// Fix round 2: copy trading as a solicitation or an offer only.
const COPY_WORD = String.raw`(?:copy|mirror|auto[\s-]?copy)[\s-]?trad(?:e|es|ing|er|ers)`;
const COPY_RE = new RegExp(String.raw`\b${COPY_WORD}\b\s*(?:(?:is|are|now|spots?|slots?|seats?)\s+)*(?:open|live|available|launch\w*|start\w*|here|spots?|slots?|seats?|access|service|group|sign[\s-]?ups?|with me|for (?:all|everyone|free|members|subscribers))\b|\b(?:join|try|start|offer(?:ing)?|launch(?:ing)?|my|our|free|paid)\s+(?:the\s+)?${COPY_WORD}\b|\b(?:copy|mirror|replicate|tail|shadow|clone)\s+(?:my|our)\s+(?:[\w-]+\s+)?(?:trades?|moves?|positions?|entries|plays?|portfolio|picks?|calls?)\b|\b(?:copy|mirror|tail|shadow|clone)\s+(?:me|us)\b|\btrade\s+(?:with|alongside)\s+(?:me|us)\b|\bauto[\s-]?cop(?:y|ies|ying)\b`, 'i');

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
  { rule: 'contact-words', label: 'contact details', words: true, re: /\b(?:dm|pm|msg|message|text|txt|sms|inbox|ping|e-?mail|hmu|whisper)\s+me\b|\bd[\s.\-_]*m\b[\s.\-_]*me\b|\bhit me up\b|\b(?:reach|contact) me\b|\badd me (?:on|at|via)\b|\bmy (?:channel|server|inbox|newsletter|course|dms?)\b|\bdms? (?:are|is) open\b/i },
  // Fix round 2: "find me at|on <handle>" and "my <messenger word> is <handle>". A handle here has an underscore, or
  // 3+ letters then 2+ digits, so "my stop is 52", "my plan is simple", "my risk is 1R" and "my exit is fy25" publish.
  // Not run on the squashed forms (they drop the underscore).
  { rule: 'find-me', label: 'contact details', re: /\bfind (?:me|us) (?:at|on|as|under|via)\s+(?:[\w']+\s+){0,3}?@?(?:(?=[a-z0-9_.]*_)|(?=[a-z]{3,}\d{2,}))[a-z][a-z0-9_.]{3,}/i },
  { rule: 'messenger-handle', label: 'contact details', re: /\b(?:my|our)\s+(?:[a-z]+\s+){0,2}?[a-z]+\s+(?:is|=|:|-)\s+@?(?:(?=[a-z0-9_.]*_)|(?=[a-z]{3,}\d{2,}))[a-z][a-z0-9_.]{3,}/i },
  // ponytail: phone digits spelt as words ("five5five 123 4567") publish — add a number-word reading to the phone
  // rule if the review queue shows them.
  // Links and domains.
  { rule: 'url', label: 'link', re: /\b(?:h[tx]{2}ps?:\/\/|www\.)\S+/i },
  { rule: 'domain', label: 'link', re: new RegExp(String.raw`\b[a-z0-9-]*[a-z][a-z0-9-]*${DOT}${TLD}(?:\/\S*)?(?![\w.-]*\w)`, 'i') },
  { rule: 'domain', label: 'link', re: new RegExp(String.raw`\b[a-z0-9-]*[a-z][a-z0-9-]*(?:\s+\.\s*|\s*\.\s+)${TLD_SPACED}\b(?![\w.-]*\w)`, 'i') },
  { rule: 'domain-spelt', label: 'link', re: new RegExp(String.raw`\b(?!(?:the|an|this|that|like|of|post)\b)[a-z0-9-]{2,}\s*[([]?\s*dot\s*[)\]]?\s*${TLD}\b`, 'i') },
  // Copy trading and mirroring.
  // Fix round 2 (business lead, decision 2 revised): only the solicitation or the offer holds — "copy trading is open",
  // "join copy trading", copy/mirror/replicate/tail + my/our trades, "copy me", "trade with me", auto-copy. Talk about
  // copy trading ("copy trading names were hot") publishes.
  { rule: 'copy-trading', label: 'copy trading', words: true, re: COPY_RE },
  { rule: 'follow-trades', label: 'copy trading', words: true, re: /\bfollow\s+(?:my|our)\s+(?:trades?|positions?|portfolio|moves?|entries|plays?)\b/i },
  // Signal or alert selling and paid groups.
  // Fix round 2: "subscribers get the entries first", "my alerts go out at 9" (alerts sold as a service).
  { rule: 'alert-service', label: 'promotion', words: true, re: /\bsubscribers?\s+(?:get|receive|see|hear|got)\b[^.\n]{0,30}\b(?:entries|exits|alerts?|signals?|trades?|picks?|setups?|first|early|before)\b|\b(?:my|our)\s+(?:[\w-]+\s+)?(?:alerts|signals|calls)\s+(?:go(?:es)? out|went out|drops?|are sent|get sent|come out|are posted|get posted)\b/i },
  { rule: 'signals', label: 'promotion', words: true, re: /\b(?:paid|premium|vip|private)[\s_-]+(?:signals?|alerts?|group|channel|chat|room|community|server|membership)\b|\b(?:signals?|alerts?)[\s_-]+(?:group|channel|service|subscription|room)\b|\b(?:subscribe|subscription|sign up|join)\b[^.\n]{0,30}\b(?:signals?|alerts?|vip|premium|membership)\b|\b(?:selling|sell|buy|get|grab)\s+my\s+(?:signals?|alerts?)\b/i },
  // Picks, tips and price targets (a target with a figure, or someone's own: "analyst price targets" is talk).
  // Fix round 2: a singular "my pick" / "my tip" is talk ("my pick was flat", "My tip: size small"); plural own picks
  // ("my top 3 picks"), a dated pick ("today's pick") and a target price or "PT" with a figure hold.
  { rule: 'picks', label: 'picks or tips', words: true, re: /\b(?:my|our)\s+(?:[\w'-]+\s+){0,2}?(?:stock\s+)?(?:picks|tips)\b|\b(?:top|hot|free|daily|weekly|best)\s+(?:\d+\s+)?(?:stock\s+)?(?:picks?|tips?)\b|\b(?:today|tomorrow|tonight|this week|the week|the day)['’]?s\s+(?:stock\s+)?(?:picks?|tips?)\b|\bpicks? (?:of the (?:day|week|month)|for (?:today|tomorrow|this week))\b|\bstock tips?\b|\b(?:price[\s_-]*targets?|target[\s_-]*price|pt)\s*(?:of|is|at|to|=|:)?\s*\$?\d|\b(?:my|our)\s+price[\s_-]*targets?\b/i },
  // Product, verified and official claims.
  { rule: 'product-name', label: 'platform claim', words: true, re: /\bstock[\s_-]*social\b/i },
  // Fix round 2 (business lead, decision 2 revised): "verified" holds only as a claim about the self, the account, the
  // record, the trades or the platform; "an unverified rumor" and "Verified the guidance raise" publish.
  { rule: 'verified', label: 'platform claim', words: true, re: VERIFIED_RE },
  { rule: 'official', label: 'platform claim', words: true, re: /\bofficial\s+(?:account|page|profile|team|partner|channel|trader|signals?|source|member|staff|admin)\b|\b(?:i am|i'm|we are|we're)\s+(?:the\s+|an?\s+)?(?:official|admin|moderator|staff)\b|\b(?:endorsed|sponsored)\s+by\b/i },
  // Stated returns, only as claims (decision 3; fix round 1): a first-person or possessive subject with a gain figure
  // (claimShape: a time total in the same sentence, or a big figure), or a sentence that opens with a figure and a time
  // total ("up 60% ytd", "YTD: +85%") — the first person left out. Price talk with another subject ("revenue grew 20%
  // a year", "shares fell 3% each day this week", "the index made 15% this year") publishes.
  { rule: 'return-first-person', label: 'return claim', claim: true, re: new RegExp(String.raw`\b${FP}\s+(?:[\w']+\s+){0,2}?(?:${GAIN}\s+(?:[\w']+\s+){0,2}?${NUM_ANY}|\+\d[\d.,]*\s*%)|\b(?:made|returned|gained|earned|netted|banked)\s+(?:me|us)\s+(?:[\w']+\s+){0,2}?${NUM_ANY}`, 'i') },
  { rule: 'return-possessive', label: 'return claim', claim: true, re: new RegExp(String.raw`\b(?:my|our)\s+(?:[\w']+\s+){0,2}?(?:returns?|gains?|profits?|performance|account|portfolio|port|p&l|pnl|equity)(?![\w&])[^.\n%]{0,30}?${NUM_ANY}|${NUM}\s+(?:returns?|gains?|profits?)\s+(?:on|in|for)\s+(?:my|our)\b|(?<![\w'])(?:portfolio|port|account|p&l|pnl)\s+(?:is\s+|was\s+)?(?:up\s+|(?=\+))${NUM_ANY}`, 'i') },
  { rule: 'return-time-total', label: 'return claim', re: new RegExp(String.raw`${CLAUSE}(?:(?:up|\+)\s*)?${NUM_ANY}\s*(?:(?:returns?|gains?|profits?|up|total|so far)\s+)?(?:${TIME_TOTAL}|annual)(?![a-z])|${CLAUSE}${TIME_TOTAL}\s*[:,-]?\s*${NUM_ANY}|${CLAUSE}(?:returns?|gains?|profits?|performance|p&l|pnl)\s*(?:${TIME_TOTAL}|so far)\s*[:=,-]?\s*(?:(?:is|are|was|were|of|at)\s+)?${NUM_ANY}`, 'i') },
  // Fix round 2: the subject left out ("Made 60% this year", "Up 85% since spring on my setup", "40% in 2 weeks on my
  // system"): held with a time total, or a span plus first-person or system context (claim: 'timed').
  { rule: 'return-dropped', label: 'return claim', claim: 'timed', re: new RegExp(String.raw`${CLAUSE}(?:(?:made|returned|gained|earned|netted|banked|compounded|averaged|up)\s+(?:[\w']+\s+){0,2}?|(?=\+))${NUM_ANY}|${CLAUSE}(?:(?:up|\+)\s*)?${NUM_ANY}\s*(?:(?:returns?|gains?|profits?|up|total|so far)\s+)?${SPAN}`, 'i') },
  // Fix round 2: a multiple of the trader's own money, no figure needed ("Doubled my money", "Tripled the account").
  { rule: 'return-multiple', label: 'return claim', re: /\b(?:doubled|tripled|quadrupled)\s+(?:my|our|the)\s+(?:money|account|portfolio|port|capital|savings|stack|equity|net worth)\b|\b(?:my|our)\s+(?:money|account|portfolio|port|capital|savings|stack|equity|net worth)\s+(?:has\s+|have\s+|just\s+)?(?:doubled|tripled|quadrupled)\b/i },
];

// Fix round 1: a first-person or possessive figure is a claim when the same sentence has a time total, or the figure is
// big: 20% or more, a multiple of 2x or more, or a reversed "%NN" (only a bidi spoof leaves that shape). "I was up 12%
// then gave it back" and "my gains were small, 3%" are ordinary talk.
// ponytail: a single-trade gain under 20% with no time total publishes even in the first person ("I made 18% on this")
// — the verified record shows that trade anyway; lower BIG_CLAIM if the review queue shows such notes misleading.
export const BIG_CLAIM = 20;
const TIME_RE = new RegExp(TIME_TOTAL, 'i');
const FIG_RE = new RegExp(String.raw`%\s*\d[\d.,]*|[+]?(\d[\d,]*(?:\.\d+)?)\s*(%|x\b)`, 'gi');
const SPAN_RE = new RegExp(SPAN, 'i');
const CTX_RE = new RegExp(CTX, 'i');
function claimShape(text: string, at: number, match: string, timed = false): boolean {
  const figs = [...match.matchAll(FIG_RE)];
  const last = figs[figs.length - 1];
  if (last && !timed) {
    if (last[0].startsWith('%')) return true;
    const v = parseFloat((last[1] ?? '').replace(/,/g, ''));
    if (last[2]?.toLowerCase() === 'x' ? v >= 2 : v >= BIG_CLAIM) return true;
  }
  const head = text.slice(0, at), tail = text.slice(at + match.length);
  const from = Math.max(head.search(/(?:[.!?](?=\s)|\n)(?!.*(?:[.!?](?=\s)|\n))/s) + 1, 0);
  const cut = tail.search(/[.!?](?=\s|$)|\n/);
  const sentence = head.slice(from) + match + (cut < 0 ? tail : tail.slice(0, cut));
  if (TIME_RE.test(sentence)) return true;
  // Fix round 2: a span counts in a first-person or possessive claim, and in a dropped-subject one with context.
  return SPAN_RE.test(sentence) && (!timed || CTX_RE.test(sentence.replace(/^[\s.!?;:]+/, '')));
}
const globalCopy = new Map<RegExp, RegExp>();
function ruleHolds(r: HoldRule, f: string): boolean {
  if (!r.claim) return r.re.test(f);
  let g = globalCopy.get(r.re);
  if (!g) globalCopy.set(r.re, (g = new RegExp(r.re.source, r.re.flags + 'g')));
  for (const m of f.matchAll(g)) if (claimShape(f, m.index!, m[0], r.claim === 'timed')) return true;
  return false;
}

// Figures written to dodge the rules read as figures: "40 percent", "40 pct" → "40%", "4O%" → "40%".
// Fix round 2: number words before a percent read as digits ("two hundred percent" → "200%").
const UNITS: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const NUM_WORD = `(?:${Object.keys(UNITS).join('|')}|hundred|thousand)`;
const NUM_WORDS_RE = new RegExp(String.raw`\b${NUM_WORD}(?:[\s-]+(?:and[\s-]+)?${NUM_WORD})*(?=\s*(?:per\s?cent|pct|%))`, 'gi');
function wordsToNumber(w: string): number {
  let total = 0, cur = 0;
  for (const t of w.toLowerCase().split(/[\s-]+/)) {
    if (t === 'and') continue;
    if (t === 'hundred') cur = (cur || 1) * 100;
    else if (t === 'thousand') { total += (cur || 1) * 1000; cur = 0; } else cur += UNITS[t] ?? 0;
  }
  return total + cur;
}
export function figures(s: string): string {
  return s.replace(NUM_WORDS_RE, (m) => String(wordsToNumber(m))).replace(/(\d)\s*(?:per\s?cent|pct)\b/gi, '$1%')
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
  { rule: 'verified', label: 'platform claim', re: VERIFIED_RE },
  { rule: 'official', label: 'platform claim', re: /official\s?(?:account|page|profile|team|partner)/ },
  { rule: 'copy-trading', label: 'copy trading', re: COPY_RE },
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
