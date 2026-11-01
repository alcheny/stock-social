// SERVER-ONLY: imports the compliance scanner's PROMO list (scripts/compliance.ts, which also loads node:fs and
// node:child_process; its CLI runs only under `import.meta.main`, lib/moderation-v2.test.ts proves the import runs
// nothing). Never import this file from a client component.
import { PROMO } from '../scripts/compliance.ts';
import { leet, skeleton, squash, squashSpans } from './text-safety.ts';

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
// Fix round 3: `claim: 'total'` (a figure with a time total, held unless it is a small figure about this one trade),
// `claim: 'dollar'` (a dollar gain, held with a time total or span) and `when` (a per-match check, the price target).
// Fix round 5 (item 3): `since`, the rules version (MODERATION_VERSION) that added the rule; unset means 1. The start-up
// re-check (lib/thesis-review.ts#remoderateAll) holds a note only on rules added after the version it was checked at.
export type HoldRule = {
  rule: string; label: string; re: RegExp; words?: boolean; claim?: boolean | 'timed' | 'total' | 'dollar';
  when?: (sentence: string, m: RegExpMatchArray) => boolean; since?: number;
};
// Fix round 5 (item 3): the rules version. Version 0 is main's rules (the frozen HOLD on the raw text only: every note
// saved before this branch was checked with them); version 1 is every rule in this file. Raise it, and give each rule
// added after it `since: <the new version>`, whenever a rule is added, so the re-check holds only on the new rules
// and leaves notes already checked (and notes the owner released) alone.
// Fix round 6: version 2 adds the period-rate rules (since: 2), the spelled-out phrase variants, the narrower call-to-act
// exemption and the script g look-alike (lib/text-safety.ts); lib/moderation-v2.test.ts pins a hash of the rules per
// version, so a rule change without a new version fails there.
// Fix round 7: version 3 adds the period-first and "mo" rate rule (since: 3), the split-word join (splitWordLabel) and
// the reflective timing exemption (REFLECT).
// F4-18 (cycle 4): version 4 adds the country-code domain, payment cashtag and solicitation paraphrase rules
// (since: 4).
export const MODERATION_VERSION = 4;

// A closed list of top-level domains: "BRK.B", "3.5x", "v2.0", "10-K", "Q3/FY25", "approx.5", "U.S.", "e.g." and
// "Inc." never look like a domain (the name needs 2+ characters with a letter, the ending must be on this list).
const TLD = '(?:com|net|org|io|co|gg|app|xyz|info|biz|ly|link|club|live|tv|uk|ru|cc|site|online|shop|pro|vip|ai|chat|group|trade|finance|money|de|me|to|fm|page)';
// Endings strong enough to count with spaces around the dot ("example . com", "example .io"): never an English word.
// ponytail: spaced endings that are English words (".me", ".to", ".co", ".live", ".trade") publish — "nice trade . me
// too" would hold otherwise; the unspaced forms are held.
const TLD_SPACED = '(?:com|net|org|io|gg|xyz|app|info|biz)';
// F4-18 (cycle 4, version 4): common country-code endings for the domain-cc rule. CC holds bare; CC_GUARDED (English
// words, and endings written after a ticker for its exchange) needs a second-level part or a path.
const CC = '(?:ca|au|jp|kr|sg|fr|es|nl|ch|se|dk|fi|pl|cz|pt|ie|ar|cl|za|ng|ke|ae|il|gr|ro|hu|ua|ph|vn|pk|eu|ws|su|nu)';
const CC_GUARDED = '(?:in|it|is|no|at|be|my|us|id|cn|hk|tw|mx|nz|sa|br)';
// F4-18: a "$handle" (a letter first, so "$500" is an amount); CASHTAG_HANDLE is handle-shaped: a digit, "_" or "-",
// or 6+ letters (longer than a ticker).
const CASHTAG = String.raw`(?<![\w$])\$[a-z][a-z0-9_-]{1,19}(?![\w-])`;
const CASHTAG_HANDLE = String.raw`(?<![\w$])\$(?=[a-z0-9_-]*(?:[0-9_-]|[a-z]{6}))[a-z][a-z0-9_-]{2,19}(?![\w-])`;
// A dot, also bracketed or parenthesised ("example[.]org", "example(.)net").
const DOT = String.raw`(?:\.|\s*[[(]\s*\.\s*[)\]]\s*)`;
// A domain name: 2+ characters with a letter, starting where no name character precedes it (linear per start).
const NAME = String.raw`(?<![a-z0-9-])(?=[a-z0-9-]*[a-z])[a-z0-9-]{2,}`;
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
const CTX = String.raw`\b(?:i|we|i'm|we're|i've|we've|me|us|my|our)\b|\b(?:this|the)\s+(?:system|strategy|setup|method)\b|^\s*(?:made|returned|gained|earned|netted|banked|compounded|averaged|average|avg|doing|pulling|doubled|tripled)\b`;
// First person as the subject of a gain ("I made", "we're up", "I was up"), and the verbs of a gain.
const FP = String.raw`(?:i|we|i've|we've|i'm|we're|i'd|we'd|i have|we have|i am|we are|i was|we were)`;
// Fix round 5 (item 4): "average" and "avg" too ("I average 30% a month"). "doing" and "pulling" are in RATE (below):
// they hold only with a time total, since "I'm doing 25% trims" is position talk.
const GAIN = String.raw`(?:made|make|making|returned|return|returning|gained|gain|earned|netted|banked|profited|compounded|averaged|averaging|average|avg|booked|cleared|up)`;
const RATE = String.raw`(?:doing|pulling(?:\s+in)?|averag(?:e|es|ing|ed)|avg)`;
// The start of the text or of a sentence. Fix round 2: a stop right after a digit is a decimal point ("3.2% a year"),
// never a sentence break.
const CLAUSE = String.raw`(?:^|[.!?;:\n]\s+|(?<!\d)[.!?;]|\n)`;

// Fix round 6 (item 1): a period ("weekly", "a month", "per wk", "/mo"), a rate word, and a period adjective.
// ponytail: a rate word reaches its figure across at most 4 words ("my avg over the last few weeks is 5% a week" with
// more words between publishes); widen it if the review queue shows such claims.
// Not a period of return: a range, a move or a volume of that period ("the 1.5% daily range").
const PERIOD_NOT = String.raw`(?!\s*(?:range|moves?|swings?|volatility|vol|volume|candles?|bars?|closes?|trend|limit|cap|charts?)\b)`;
const PERIOD = String.raw`(?:weekly|monthly|yearly|daily|annually|annuali[sz]ed|p\.a\.|(?:a|per|each|every)\s+(?:week|wk|month|mo|year|yr|day|annum|quarter|qtr)\b|\/\s*(?:wk|week|mo|month|yr|year|day)\b)${PERIOD_NOT}`;
const AVG = String.raw`(?:avg|average|averag(?:es|ed|ing))`;
const PER_ADJ = String.raw`(?:weekly|monthly|yearly|daily|annually|annual)`;

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
  { rule: 'contact-words', label: 'contact details', words: true, re: /\b(?:dm|pm|msg|message|text|txt|sms|inbox|ping|e-?mail|hmu|whisper)\s+me\b|\bd[\s.\-_]*m\b[\s.\-_]*me\b|\bhit me up\b|\b(?:reach|contact) me\b|\badd me (?:on|at|via)\b|\bmy (?:channel|server|inbox|newsletter|course|dms?)\b|\bdms? (?:are|is) open\b|\bdms?\s+open\b|\b(?:dms?|pm|msg|message)\s+(?:me\s+)?(?:for|4)\s+(?:(?:the|my|our|more|daily|free)\s+)?(?:entries|entry|setups?|alerts?|signals?|picks?|access|plays?|calls?)\b/i },
  // Fix round 2: "find me at|on <handle>" and "my <messenger word> is <handle>". A handle here has an underscore, or
  // 3+ letters then 2+ digits, so "my stop is 52", "my plan is simple", "my risk is 1R" and "my exit is fy25" publish.
  // Not run on the squashed forms (they drop the underscore).
  { rule: 'find-me', label: 'contact details', re: /\bfind (?:me|us) (?:at|on|as|under|via)\s+(?:[\w']+\s+){0,3}?@?(?:(?=[a-z0-9_.]*_)|(?=[a-z]{3,}\d{2,}))[a-z][a-z0-9_.]{3,}/i },
  // Fix round 3: a short messenger word names the place, so any handle after it holds ("my tg: name", "find me on tele:
  // name"); room words (server, group, channel, chat) only with ":" or "=", so "my group is small" publishes.
  { rule: 'messenger-word', label: 'contact details', re: /\b(?:my|our)\s+(?:tele|tg|insta|ig|snap|sc)\s*(?:is|=|:|-|at|@|on)\s*@?[a-z][a-z0-9_.]{3,}|\b(?:my|our)\s+(?:server|group|channel|chat)\s*[:=]\s*@?[a-z][a-z0-9_.]{3,}|\bfind (?:me|us) (?:at|on|as|under|via)\s+(?:the\s+)?(?:tele|tg|insta|ig|snap|sc)\b/i },
  { rule: 'messenger-handle', label: 'contact details', re: /\b(?:my|our)\s+(?:[a-z]+\s+){0,2}?[a-z]+\s+(?:is|=|:|-)\s+@?(?:(?=[a-z0-9_.]*_)|(?=[a-z]{3,}\d{2,}))[a-z][a-z0-9_.]{3,}/i },
  // ponytail: phone digits spelt as words ("five5five 123 4567") publish — add a number-word reading to the phone
  // rule if the review queue shows them.
  // Links and domains.
  { rule: 'url', label: 'link', re: /\b(?:h[tx]{2}ps?:\/\/|www\.)\S+/i },
  // Fix round 3 (QA item 8): the name is one run of [a-z0-9-] that starts where no such character precedes it, and its
  // letter is checked by a lookahead, so matching is linear per start ("A-A-A-…" was polynomial with nested runs).
  // Fix round 5 (item 2): also on the squashed forms, where a spaced-out domain is joined with its dots ("e x a m p l e .
  // c o m").
  { rule: 'domain', label: 'link', words: true, re: new RegExp(String.raw`${NAME}${DOT}${TLD}(?:\/\S*)?(?![\w.-]*\w)`, 'i') },
  { rule: 'domain', label: 'link', words: true, re: new RegExp(String.raw`${NAME}(?:\s+\.\s*|\s*\.\s+)${TLD_SPACED}\b(?![\w.-]*\w)`, 'i') },
  // Fix round 3: also on the squashed forms ("example dot c o m"); "dot" in prose ("connect the dots", "the dotcom
  // bubble", "looked dotcom bubble crazy") publishes.
  { rule: 'domain-spelt', label: 'link', words: true, re: new RegExp(String.raw`(?<![a-z0-9-])(?!(?:the|an|this|that|like|of|post)\b)[a-z0-9-]{2,}\s*[([]?\s*dot\s*[)\]]?\s*${TLD}\b(?![\s-]*(?:bubble|era|boom|bust|crash|mania|days|stocks?|names|companies)\b)`, 'i') },
  // Fix round 3: a domain with the dot left out, where the shape still says link: "www example com", "example com/join".
  // ponytail: a bare "example com" with no www and no path publishes ("the company com" style text can't be told from
  // it) — hold it too if the review queue shows such links.
  { rule: 'domain-dotless', label: 'link', re: new RegExp(String.raw`(?<![a-z0-9-])www\s+[a-z0-9-]+\s+${TLD}\b|${NAME}\s+${TLD_SPACED}\/[\w/]`, 'i') },
  // F4-18 (cycle 4, C4-19; version 4): bare domains on common country-code endings, F-9's "Hold … links and domains".
  // Endings that are never an English word or a common exchange suffix hold bare ("example.fr", "example.com.au"); the
  // rest (CC_GUARDED: English words, and endings traders write after a ticker, "XYZ.HK") hold only after a second-level
  // part ("example.co.in", "example.com.br") or with a path ("example.it/room").
  // ponytail: "example.hk", "example.in" and the other guarded endings publish bare — hold them if the review queue
  // shows such links (a ticker suffix list would tell them apart).
  { rule: 'domain-cc', label: 'link', words: true, since: 4, re: new RegExp(String.raw`${NAME}(?:\.[a-z0-9-]+)*${DOT}${CC}(?:\/\S*)?(?![\w.-]*\w)|${NAME}\.(?:co|com|net|org|gov|edu|ac)${DOT}(?:${CC}|${CC_GUARDED})(?:\/\S*)?(?![\w.-]*\w)|${NAME}${DOT}${CC_GUARDED}\/[\w/]`, 'i') },
  // F4-18 (version 4): a payment cashtag: a "$handle" next to a payment word ("Tips welcome: $handle", "$handle for
  // tips", "send tips to $handle"). A ticker ("$XYZ for the dividend") and a "$" amount ("Paid $40 a share") publish:
  // the handle starts with a letter, and a bare "send", "pay" or "tips" counts only with a handle-shaped tag (a digit,
  // "_" or "-", or 6+ letters: longer than a ticker).
  { rule: 'cashtag', label: 'contact details', since: 4, re: new RegExp(String.raw`\b(?:cash\s*tag|tip\s*jar|tips?\s+(?:me|welcome|appreciated)|donations?\s+(?:welcome|appreciated)|(?:payment|pay|money|cash)\s*app|send\s+me\s+(?:money|cash|tips?|a tip)|pay\s+me|tip\s+me|donate)\b[^.!?\n]{0,30}?${CASHTAG}|${CASHTAG}[^.!?\n]{0,30}?\b(?:cash\s*tag|tip\s*jar|for\s+(?:tips|donations)|(?:payment|pay|money|cash)\s*app|tips?\s+(?:welcome|appreciated)|donations?\s+(?:welcome|appreciated))\b|\b(?:tips?|tipping|donat\w*|send|pay(?:ments?)?)\s+(?:(?:to|at|via|on|me)\s+)?${CASHTAG_HANDLE}`, 'i') },
  // F4-18 (version 4): solicitation paraphrases next to the frozen "link in bio": pointing at the bio ("Check my bio for
  // the link", "details in bio"), "Follow me for more calls" and running a trading room ("I run a trading room, ask me
  // how to get in"). "I updated my bio", "My bio says I swing trade", "I left a trading group" and "Ask me how I sized
  // it" publish.
  { rule: 'bio-pointer', label: 'promotion', words: true, since: 4, re: /\b(?:check(?:\s+out)?|see|visit|tap|click|hit|go\s+to|head\s+to|look\s+at)\s+(?:the\s+)?(?:links?\s+in\s+)?(?:my|our|the)\s+bio\b|\b(?:links?|details|info|more|access|invites?|sign[\s-]?up)\s+(?:is\s+|are\s+)?(?:in|on|at)\s+(?:my\s+|our\s+|the\s+)?bio\b|\b(?:my|our)\s+bio\s+(?:for|has|have)\s+(?:the\s+|a\s+|more\s+)?(?:links?|details|info|access|invites?|sign[\s-]?up|group|room|signals?|alerts?)\b/i },
  { rule: 'follow-for', label: 'promotion', words: true, since: 4, re: /\bfollow\s+(?:(?:me|us)\s+)?(?:here\s+)?(?:for|4)\s+(?:(?:more|daily|weekly|the|my|our|free|real[\s-]?time|live)\s+)*(?:calls?|picks?|plays?|alerts?|signals?|entries|setups?|trades|updates|ideas|content)\b/i },
  { rule: 'trading-room', label: 'promotion', words: true, since: 4, re: /\b(?:i|we)\s+(?:run|host|own|lead|manage|started|moderate)\s+(?:a|an|my|our)\s+(?:(?:small|private|little|free|paid|live)\s+)?(?:day[\s-]?)?(?:trading|stock|options?|investing)\s+(?:room|group|chat|server|channel|community|club)\b|\bask\s+(?:me|us)\s+(?:how\s+(?:to\s+)?(?:get(?:ting)?\s+in|join(?:ing)?|sign(?:ing)?\s+up|access)|about\s+(?:joining|getting\s+in|access|the\s+(?:room|group|chat|server|channel)))\b/i },
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
  { rule: 'picks', label: 'picks or tips', words: true, re: /\b(?:my|our)\s+(?:[\w'-]+\s+){0,2}?(?:stock\s+)?(?:picks|tips)\b|\b(?:free|daily|weekly)\s+(?:\d+\s+)?(?:stock\s+)?(?:picks?|tips?)\b|\b(?:top|hot|best)\s+(?:\d+\s+)?(?:stock\s+)?(?:picks|tips?)\b|\b(?:top|hot|best)\s+(?:stock\s+)?pick\s+(?:for|of)\s+(?:today|tomorrow|tonight|this week|next week|the (?:day|week|month))\b|\b(?:today|tomorrow|tonight|this week|the week|the day)['’]?s\s+(?:(?:top|hot|best|free)\s+)?(?:stock\s+)?(?:picks?|tips?)\b|\bpicks? (?:of the (?:day|week|month)|for (?:today|tomorrow|this week))\b|\bstock tips?\b|\b(?:my|our)\s+price[\s_-]*targets?\b/i },
  // Fix round 3: a price target holds with my/our, a "$", or a stated price, except a small scale-out number ("PT 1",
  // "pt 2") and someone else's target ("Analysts' PT is 300", "PT 60 from the bank upgrade").
  { rule: 'price-target', label: 'picks or tips', words: true, when: ptHolds, re: /(?:\b(my|our)\s+)?\b(?:price[\s_-]*targets?|target[\s_-]*price|pt)\s*(?:of|is|at|to|=|:)?\s*(\$)?\s*(\d[\d.,]*)/i },
  // Product, verified and official claims.
  { rule: 'product-name', label: 'platform claim', words: true, re: /\bstock[\s_-]*social\b/i },
  // Fix round 2 (business lead, decision 2 revised): "verified" holds only as a claim about the self, the account, the
  // record, the trades or the platform; "an unverified rumor" and "Verified the guidance raise" publish.
  { rule: 'verified', label: 'platform claim', words: true, re: VERIFIED_RE },
  { rule: 'official', label: 'platform claim', words: true, re: /\bofficial\s+(?:account|page|profile|team|partner|channel|trader|signals?|source|member|staff|admin)\b|\b(?:i am|i'm|we are|we're)\s+(?:the\s+|an?\s+)?(?:official|admin|moderator|staff)\b|\b(?:endorsed|sponsored)\s+by\b/i },
  // Fix round 3 (committee: advice, calls and win-rate claims are held; POLICY F1/F2): urging others to buy or get in
  // now, rating calls, and claims never to lose. Past tense ("I bought it now that the base is set"), a hit target
  // ("Target was 52, hit it.") and a negation ("wouldn't buy it now") publish.
  { rule: 'hype', label: 'promotion', re: new RegExp(String.raw`(?<!(?:n't|not|never|no)\s+)\bbuy\s+(?:it\s+|this\s+|them\s+|these\s+|here\s+)?(?:right\s+)?(?:now|today)\b(?!\s+pay\s+later\b)|\bload(?:ing)?\s+up\s+(?:now|today|here|before|while)\b|(?:^|[.!?,;:]\s*)load\s+up\s*(?:[.!?]|$)|\b(?:buy|load up|get in|grab)\b[^.!?\n]{0,25}\bbefore\s+(?:it|this|they)\s+(?:rips?|runs?|moons?|pops?|explodes?|flies|takes off|skyrockets?)\b|\bstrong\s+buy\b(?=\s*(?:[.!,;:)\-–—]|$|(?:target|now|here|today|imo|right|on|at|for|from|zone|all day)\b))|(?<!(?:n't|not|never|to|could|can)\s+)\bget\s+in\s*(?:(?:now|before|while)\b|early\s*(?:[.!,;]|$|(?:before|while|on|here)\b)|[.!]|$)|\b(?:everyone|everybody|you|y'all|you all|people|ppl)\s+(?:should|must|needs? to|gotta|have to|has to|better)\s+(?:buy|load|get in|grab|own)\b|\bbuy[\s,!.]+buy\b|\b(?:i|we)\s+(?:never|rarely|almost never)\s+lose\b(?!\s+(?:sleep|sight|track|focus|more|much|than|over|patience|interest|discipline))`, 'i') },
  // Fix round 4: "next 10 bagger" holds only as an offer (an offer word in the sentence, or "!"), never as a question
  // or with a doubt ("Next 10 bagger? Doubt it.").
  { rule: 'hype-bagger', label: 'promotion', when: baggerHolds, re: /\bnext\s+(?:\d+|ten|hundred)[\s-]*baggers?\b(?!\s*\?)(\s*!)?/i },
  // Fix round 4: a win rate or accuracy figure is a claim about the trader's own record unless the sentence gives it a
  // third-party subject and no first person ("Analysts have a 70% hit rate on this name", "the trial had a 70% success
  // rate"); "92% win rate", "Verified 92% win rate" and "My signals are 95% accurate" stay held.
  { rule: 'win-rate', label: 'return claim', when: winRateHolds, re: /(?<![\d.])\d[\d.]*\s*%\s*(?:win(?:ning)?[\s-]*(?:rate|ratio)|wins|winners|winning|accurate|accuracy|hit[\s-]*rate|success(?:\s+rate)?)\b|\b(?:win(?:ning)?[\s-]*(?:rate|ratio)|accuracy|hit[\s-]*rate|success rate)\s*(?:of|is|was|=|:|at)?\s*\d[\d.]*\s*%/i },
  // A dollar gain with a time total or span ("Made $50k this month"); "Sold $5k of it" and "Revenue $40B this year"
  // have no gain verb and publish. "Turned 1k into 50k" holds on its own.
  { rule: 'return-dollar', label: 'return claim', claim: 'dollar', re: new RegExp(String.raw`(?:${CLAUSE}|\b${FP}\s+(?:[\w']+\s+)?)(?:made|up|gained|earned|netted|banked|profited|cleared|booked|pulled in)\s+(?:about\s+|over\s+|almost\s+|nearly\s+|~)?\$\s?\d[\d.,]*`, 'i') },
  // Fix round 4: "turned X into Y" is money only with a "$", a k/m/grand/x unit, an amount of 1,000 or more, or the
  // account named ("They turned 5 into 10 stores" publishes).
  { rule: 'return-turned', label: 'return claim', when: turnedHolds, re: /\bturned\s+(?:(?:my|our|the)\s+(?:account|portfolio|port|stack|savings)|\$?\s?\d[\d.,]*\s*(?:k|m|grand|x)?)\s+into\s+\$?\s?\d[\d.,]*\s*(?:k\b|m\b|grand|x\b)?/i },
  // Stated returns, only as claims (decision 3; fix round 1): a first-person or possessive subject with a gain figure
  // (claimShape: a time total in the same sentence, or a big figure), or a sentence that opens with a figure and a time
  // total ("up 60% ytd", "YTD: +85%") — the first person left out. Price talk with another subject ("revenue grew 20%
  // a year", "shares fell 3% each day this week", "the index made 15% this year") publishes.
  { rule: 'return-first-person', label: 'return claim', claim: true, re: new RegExp(String.raw`\b${FP}\s+(?:[\w']+\s+){0,2}?(?:${GAIN}\s+(?:[\w']+\s+){0,2}?${NUM_ANY}|\+\d[\d.,]*\s*%)|\b(?:made|returned|gained|earned|netted|banked)\s+(?:me|us)\s+(?:[\w']+\s+){0,2}?${NUM_ANY}`, 'i') },
  { rule: 'return-possessive', label: 'return claim', claim: true, re: new RegExp(String.raw`\b(?:my|our)\s+(?:[\w']+\s+){0,2}?(?:returns?|gains?|profits?|performance|account|portfolio|port|p&l|pnl|equity)(?![\w&])[^.\n%]{0,30}?${NUM_ANY}|${NUM}\s+(?:returns?|gains?|profits?)\s+(?:on|in|for)\s+(?:my|our)\b|(?<![\w'])(?:portfolio|port|account|p&l|pnl)\s+(?:is\s+|was\s+)?(?:up\s+|(?=\+))${NUM_ANY}`, 'i') },
  { rule: 'return-time-total', label: 'return claim', claim: 'total', re: new RegExp(String.raw`${CLAUSE}(?:(?:up|\+)\s*)?${NUM_ANY}\s*(?:(?:returns?|gains?|profits?|up|total|so far)\s+)?(?:${TIME_TOTAL}|annual)(?![a-z])|${CLAUSE}${TIME_TOTAL}\s*[:,-]?\s*${NUM_ANY}|${CLAUSE}(?:returns?|gains?|profits?|performance|p&l|pnl)\s*(?:${TIME_TOTAL}|so far)\s*[:=,-]?\s*(?:(?:is|are|was|were|of|at)\s+)?${NUM_ANY}`, 'i') },
  // Fix round 2: the subject left out ("Made 60% this year", "Up 85% since spring on my setup", "40% in 2 weeks on my
  // system"): held with a time total, or a span plus first-person or system context (claim: 'timed').
  { rule: 'return-dropped', label: 'return claim', claim: 'timed', re: new RegExp(String.raw`${CLAUSE}(?:(?:made|returned|gained|earned|netted|banked|compounded|averaged|up)\s+(?:[\w']+\s+){0,2}?|(?=\+))${NUM_ANY}|${CLAUSE}(?:(?:up|\+)\s*)?${NUM_ANY}\s*(?:(?:returns?|gains?|profits?|up|total|so far)\s+)?${SPAN}`, 'i') },
  // Fix round 5 (item 4): a rate verb ("I average 30% a month", "Avg 30% per month on my system", "Doing 30% monthly"),
  // with or without the subject: held with a time total, or a span plus context (claim: 'timed').
  { rule: 'return-rate', label: 'return claim', claim: 'timed', re: new RegExp(String.raw`(?:${CLAUSE}|\b${FP}\s+(?:[\w']+\s+)?)${RATE}\s+(?:about\s+|around\s+|over\s+|~)?${NUM_ANY}`, 'i') },
  // Fix round 6 (item 1): a return figure tied to a period is a claim with or without a subject or a verb ("my avg is
  // 30% a month", "avg return 8%/wk", "avg monthly 30%", "I make 5% weekly", "Avg 5% weekly"). Held unless a third-party
  // subject comes before it with no first person, or a third-party noun sits in it or right after it (rateHolds below):
  // "Revenue averaged 12% a year", "Dividend growth averaged 6% annually" and "5% a year revenue growth" publish.
  { rule: 'return-period', label: 'return claim', since: 2, when: rateHolds, re: new RegExp(String.raw`\b${AVG}\b(?:\s+[a-z']+|\s*[=:]){0,4}?\s*${NUM_ANY}\s*${PERIOD}|\b${AVG}\s+${PER_ADJ}\s+(?:(?:returns?|gains?|profits?|is|of|was|=|:)\s*){0,2}${NUM_ANY}|\b${FP}\s+(?:[\w']+\s+){0,2}?${GAIN}\s+(?:[\w']+\s+){0,2}?${NUM_ANY}\s*${PERIOD}|\b(?:my|our)\s+(?:[\w']+\s+){0,2}?(?:returns?|gains?|profits?|performance|account|portfolio|port|p&l|pnl|equity)(?![\w&])[^.\n%]{0,30}?${NUM_ANY}\s*${PERIOD}|${CLAUSE}(?:${GAIN}\s+(?:[\w']+\s+){0,2}?|(?:up|\+)\s*)?${NUM_ANY}\s*(?:(?:returns?|gains?|profits?)\s+)?${PERIOD}`, 'i') },
  // Fix round 7 (item 1): the period word before the rate word ("monthly avg 30%", "weekly avg: 5%"), and "mo" with no
  // slash after a figure, only with a rate word ("avg 30% mo"): a bare "30% mo" in ordinary text publishes.
  { rule: 'return-period-word', label: 'return claim', since: 3, when: rateHolds, re: new RegExp(String.raw`\b${PER_ADJ}\s+${AVG}\b(?:\s+[a-z']+|\s*[=:]){0,2}?\s*${NUM_ANY}|\b${AVG}\b(?:\s+[a-z']+|\s*[=:]){0,4}?\s*${NUM_ANY}\s*mo\b${PERIOD_NOT}`, 'i') },
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
// Fix round 3 (QA item 1): a small figure (under BIG_CLAIM) about this one trade is how a trade is described: with a span
// it is talk ("Made 6% in 2 weeks, sold before earnings"), and with a time total it is talk when the sentence names
// the trade ("Up 4% this week on the position"). Either way it stays a claim when the sentence names the account, a
// portfolio, a system or strategy, a year, or a per-month rate ("I made 6% in 2 weeks on my account", "3% a month").
const ON_THIS = /\bon\s+(?:this|the|that)\s+(?:trade|position|name|one|stock|ticker|swing)\b|\bon\s+it\b/i;
const STRONG = /\b(?:accounts?|acct|portfolio|port|system|strategy|ytd|years?|yrs?|annual\w*|annum|yearly|monthly|p\.a\.)(?![\w])|\b(?:a|per|each|every)\s+month\b|\/\s*(?:mo|month)\b/i;
// Fix round 5 (item 4): words that tie a figure to one trade (an exit, an entry, the position).
const TRADE_REF = /\b(?:sold|sell(?:ing)?\s+(?:into|half|some|the)|bought|trimmed|exited|closed\s+(?:it|the|out)|covered|stopped\s+out|took\s+(?:profits?|gains?)|run-?up|the\s+(?:position|trade|entry))\b/i;
// The sentence around a match: from the last stop before it to the first stop after it.
function sentenceAt(text: string, at: number, match: string): string {
  const head = text.slice(0, at), tail = text.slice(at + match.length);
  const from = Math.max(head.search(/(?:[.!?](?=\s)|\n)(?!.*(?:[.!?](?=\s)|\n))/s) + 1, 0);
  const cut = tail.search(/[.!?](?=\s|$)|\n/);
  return head.slice(from) + match + (cut < 0 ? tail : tail.slice(0, cut));
}
function claimShape(text: string, at: number, match: string, mode: true | 'timed' | 'total' | 'dollar'): boolean {
  const sentence = sentenceAt(text, at, match);
  const strong = STRONG.test(sentence);
  if (mode === 'dollar') return (TIME_RE.test(sentence) || SPAN_RE.test(sentence)) && (strong || !ON_THIS.test(sentence));
  const figs = [...match.matchAll(FIG_RE)];
  const last = figs[figs.length - 1];
  let small = false;
  if (last) {
    const v = parseFloat((last[1] ?? '').replace(/,/g, ''));
    const big = last[0].startsWith('%') || (last[2]?.toLowerCase() === 'x' ? v >= 2 : v >= BIG_CLAIM);
    if (big && mode === true) return true;
    small = !big;
  }
  const trade = small && !strong; // small and names nothing beyond the trade
  if (mode === 'total') return !(trade && ON_THIS.test(sentence));
  if (TIME_RE.test(sentence)) return !(trade && ON_THIS.test(sentence));
  // Fix round 2: a span counts in a first-person or possessive claim, and in a dropped-subject one with context.
  // Fix round 5 (item 4): a figure over a span (no time total) is a period claim only with the account, a system,
  // portfolio or strategy word, or as a first-person total that names no trade: "Gained 35% in 4 months; sold into the
  // run-up" describes one trade and publishes.
  if (!SPAN_RE.test(sentence) || trade) return false;
  if (strong) return true;
  return (mode !== 'timed' || CTX_RE.test(sentence.replace(/^[\s.!?;:]+/, ''))) && !ON_THIS.test(sentence) && !TRADE_REF.test(sentence);
}
// Fix round 3 (QA item 2): the price-target check (see the 'price-target' rule).
const THIRD_PARTY = /\b(?:analysts?|street|consensus|banks?|brokers?|brokerage|firms?|upgraded?|upgrades|downgraded?|downgrades|their|they|sell[\s-]?side|coverage|research|desk)\b/i;
// Fix round 4: a stated price beside the trader's own plan or exit is talk ("PT 60, stop 48.", "Hit PT 120 early.",
// "pt 3.5 hit", "Took profits at pt 6"); with my/our or a "$" it stays held ("my PT 300", "PT $200"), and a bare one
// ("PT 300", "price target 120 by spring") stays held. A past-tense own target ("My PT was 60") never matches: a
// reflection, not a call.
const PLAN = /\b(?:stops?|stopped|sl|(?<!(?:will|to|gonna|should|could|'ll|would|might)\s+)hit|hits|tagged|reached|filled|took|taking|trim(?:med|ming)?|sold|exit(?:ed)?|scal(?:e|ed|ing)\s+out|profits?)\b/i;
function ptHolds(sentence: string, m: RegExpMatchArray): boolean {
  if (m[1] || m[2]) return true;
  if (/^[1-5]$/.test((m[3] ?? '').replace(/[.,]+$/, ''))) return false;
  return !THIRD_PARTY.test(sentence) && !PLAN.test(sentence);
}
const FIRST = /\b(?:i|we|i'm|we're|i've|we've|me|us|my|our|mine|ours)\b/i;
const OTHER = new RegExp(String.raw`${THIRD_PARTY.source}|\b(?:trials?|study|studies|phase|drugs?|fund|funds|index|company|management|he|she|his|her|its)\b`, 'i');
function winRateHolds(sentence: string, m: RegExpMatchArray): boolean {
  if (FIRST.test(sentence)) return true;
  return !OTHER.test(sentence.slice(0, Math.max(sentence.indexOf(m[0]), 0)));
}
// Fix round 6 (item 1): third-party subjects and the nouns a macro or fundamental rate is attached to.
const TP_NOUN = String.raw`(?:revenues?|sales|earnings|eps|ebitda|fcf|cash\s+flow|margins?|yields?|dividends?|cpi|ppi|pce|inflation|gdp|rates?|wages?|unemployment|payrolls?|volatility|vol|volume|shares|stocks?|index|indices|indexes|sector|sectors|company|companies|name|names|analysts?|consensus|street|fund|funds|etfs?|market|markets|economy|prices?|bonds?|treasur(?:y|ies)|benchmark|beta|growth|costs?|users|subscribers|customers|housing|rents?|interest|coupon|semis|it|they|their|its|he|she|his|her)`;
const TP_RE = new RegExp(String.raw`\b${TP_NOUN}\b`, 'i');
const TP_AFTER = new RegExp(String.raw`^\s*(?:(?:for|of|from)\s+)?(?:(?:the|this|that|a|an)\s+)?${TP_NOUN}\b`, 'i');
function rateHolds(sentence: string, m: RegExpMatchArray): boolean {
  if (TP_RE.test(m[0])) return false;
  const at = Math.max(sentence.indexOf(m[0]), 0);
  if (TP_AFTER.test(sentence.slice(at + m[0].length))) return false;
  return FIRST.test(sentence) || !TP_RE.test(sentence.slice(0, at));
}
const OFFER = /\b(?:load(?:ing)?|buy(?:ing)?|grab|get\s+in|own|don'?t\s+miss|before\s+it|now|today)\b/i;
const DOUBT = /\b(?:doubt\w*|never|unlikely|hardly|isn'?t|wasn'?t|ain'?t|not\s+(?:the|a|my)|no\s+way)\b/i;
function baggerHolds(sentence: string, m: RegExpMatchArray): boolean {
  if (DOUBT.test(sentence)) return false;
  return Boolean(m[1]) || OFFER.test(sentence);
}
// ponytail: fix round 4 trades holds for false holds — a bare "next 10 bagger" (no offer word, no "!"), a win rate
// given a third-party subject, a stated target beside plan words ("PT 300, stop 250") and "turned 500 into 2000" (no
// unit, under 1,000) publish; tighten them if the review queue shows promotions in those shapes.
function turnedHolds(_sentence: string, m: RegExpMatchArray): boolean {
  const t = m[0];
  if (/\$|\d\s*(?:k|m|grand|x)\b|account|portfolio|port\b|stack|savings/i.test(t)) return true;
  const first = parseFloat((t.match(/\d[\d.,]*/)?.[0] ?? '0').replace(/,/g, ''));
  return first >= 1000;
}
const globalCopy = new Map<RegExp, RegExp>();
function ruleHolds(r: HoldRule, f: string): boolean {
  if (!r.claim && !r.when) return r.re.test(f);
  let g = globalCopy.get(r.re);
  if (!g) globalCopy.set(r.re, (g = new RegExp(r.re.source, r.re.flags + 'g')));
  for (const m of f.matchAll(g)) {
    if (r.when ? r.when(sentenceAt(f, m.index!, m[0]), m) : claimShape(f, m.index!, m[0], r.claim as true | 'timed' | 'total' | 'dollar')) return true;
  }
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

const SINGLE_PICK = /\b(top|hot|best)\s+pick\b(?!s)/gi;

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

// Fix round 5 (item 3): the frozen HOLD list and the scanner's PROMO list (lib/moderation.test.ts snapshots HOLD; PROMO
// belongs to the scanner) are read through exceptions instead of being edited. A match is talk, not a hold, when the
// text from the match on starts with one of these. HOLD's "buy" entry: the payment-plan phrase ("buy" + "now pay later"
// names a kind of lender). PROMO: single generic words and phrases that are ordinary talk in a note about one's own
// trade (a sector beating another, a company earning nothing yet, a popular name, the moment one chose to exit, asking
// oneself whether to repeat a trade); the offer and claim forms (promised or riskless returns, getting wealthy fast,
// passive earnings, ranked pick lists, telling readers what to purchase, completeness claims, verified-by) still hold.
const HOLD_TALK = new Map<RegExp, RegExp>([[HOLD[6], /^buy\snow\s+pay\s+later\b/i]]);
// Version 1's exemption: the phrase anywhere. Kept so the re-check can tell what version 2 newly holds.
const PROMO_TALK_V1 = /^(?:out[p]erform(?:s|ed|ing)?|make\smoney|hot\sstock|buy\snow|copy\sthis\strades?|time\sto\s(?:buy|sell))\b/i;
// Fix round 6 (item 3): the exemption holds only where the phrase is not a call to act. A call: words to the reader
// (second person, a crowd word), an alert, a colon or "!" right after the phrase, a system or strategy said to beat
// something, a person beating something in the present, or money made every period. The timing phrase is talk only as
// the trader's own past or reflective choice ("decided it was", "thought it was", "was it") or a question to oneself, and
// so is the copy phrase; the popular-name, earning and sector phrases are talk unless a call cue is there (third-person
// commentary about a sector or a company publishes).
const PROMO_TALK = /^(?:(out[p]erform(?:s|ed|ing)?)|(make\smoney)|(hot\sstock)|buy\snow|(copy\sthis\strades?)|(time\sto\s(?:buy|sell)))\b/i;
const CALL = /\b(?:you|your|yours|you're|youre|y'all|yall|ya|everyone|everybody|guys|folks|people|fam|alerts?)\b/i;
const CALL_AFTER = /^\s*[:!]/;
const PAST = /\b(?:was|were|had|thought|decided|felt|figured|seemed|knew|realized|realised|believed|wondered|whether|if|looked)\b/i;
const SYSTEM = /\b(?:this|my|our|the)\s+(?:[\w-]+\s+)?(?:strategy|system|method|setup|approach|model|algo|bot|service|picks?|signals?|portfolio)\b|\b(?:i|we)\s+(?:\w+\s+)?$/i;
// Fix round 7 (item 3): the timing phrase told as the trader's own past choice: the phrase followed by "was" (when it
// was right), or a "which I did" later in the sentence.
const REFLECT = /^\s+(?:was|were|had\s+been)\b(?!\s+(?:now|today|here)\b)|\bwhich\s+(?:i|we)\s+did\b/i;
const EVERY = /^\s*(?:every|each|daily|weekly|monthly|consistently|all\s+the\s+time|fast|quick(?:ly)?|easy|easily)\b/i;
// ponytail: the rules hash in lib/moderation-v2.test.ts covers these patterns and every rule source, not the code of
// promoTalk or claimShape; a change to that code alone needs a version raise by hand.
export const TALK_RULES: RegExp[] = [HOLD_TALK.get(HOLD[6])!, PROMO_TALK_V1, PROMO_TALK, CALL, CALL_AFTER, PAST, SYSTEM, EVERY, REFLECT];
function sentenceSides(text: string, at: number, len: number): [string, string] {
  const s = sentenceAt(text, at, text.slice(at, at + len));
  const head = text.slice(0, at);
  const before = head.slice(Math.max(head.search(/(?:[.!?](?=\s)|\n)(?!.*(?:[.!?](?=\s)|\n))/s) + 1, 0));
  return [before, s.slice(before.length + len)];
}
function promoTalk(f: string, at: number): boolean {
  const pm = f.slice(at).match(PROMO_TALK);
  if (!pm) return false;
  const [before, after] = sentenceSides(f, at, pm[0].length);
  if (CALL.test(before + ' ' + after) || CALL_AFTER.test(after)) return false;
  if (pm[1]) return !SYSTEM.test(before);
  if (pm[2]) return !EVERY.test(after);
  const asked = /^[^.!?\n]*\?/.test(f.slice(at + pm[0].length));
  if (pm[4] || pm[5]) return asked || PAST.test(before) || REFLECT.test(after);
  return true; // the popular-name phrase as commentary; the "buy" phrase (the frozen HOLD holds its calls)
}
type Talk = (f: string, at: number) => boolean;
const regexTalk = (re: RegExp | undefined): Talk | undefined => re && ((f, at) => re.test(f.slice(at)));
function matchesExcept(re: RegExp, f: string, talk: Talk | undefined): boolean {
  if (!talk) return re.test(f);
  let g = globalCopy.get(re);
  if (!g) globalCopy.set(re, (g = new RegExp(re.source, re.flags.replace('g', '') + 'g')));
  for (const m of f.matchAll(g)) if (!talk(f, m.index!)) return true;
  return false;
}
// Version 2 only (the re-check of a version 1 note): a match version 1 let through as talk and version 2 does not.
const promoTalkV2Only: Talk = (f, at) => !(PROMO_TALK_V1.test(f.slice(at)) && !promoTalk(f, at));

// Fix round 6 (item 2): a phrase spelled out letter by letter is joined by the squash ("t o t h e m o o n" →
// "tothemoon"), but the phrase rules need the space. Each phrase rule (the frozen HOLD, the scanner's PROMO, and the
// HOLD_V2 word rules with no claim or per-match check) is also read with every separator made optional, derived from
// its source (the arrays stay unchanged), and run on the squashed forms only, counting only a match that overlaps a
// joined run of single characters: ordinary words are never joined, so they never meet these variants.
const SEP = String.raw`[\s.\-_]*`;
const SEP_CLASS = /^(?:\\s| |-|\\-|_|\.|\\\.)+$/;
export function optionalSpaces(re: RegExp): RegExp {
  const src = re.source;
  let out = '';
  for (let i = 0; i < src.length;) {
    let tok = src[i], sep = false;
    if (tok === '\\') { tok = src.slice(i, i + 2); sep = tok === '\\s'; } else if (tok === '[') {
      let j = i + 1;
      if (src[j] === '^') j++;
      if (src[j] === ']') j++;
      while (j < src.length && src[j] !== ']') j += src[j] === '\\' ? 2 : 1;
      tok = src.slice(i, j + 1);
      sep = SEP_CLASS.test(tok.slice(1, -1)) && /\\s| /.test(tok);
    } else sep = tok === ' ';
    i += tok.length;
    if (!sep) { out += tok; continue; }
    const q = src.slice(i).match(/^(?:[?*+]|\{\d+(?:,\d*)?\})\??/);
    if (q) i += q[0].length;
    out += SEP;
  }
  return new RegExp(out, re.flags.replace('g', '') + 'g');
}
const PHRASE_VARIANTS: { re: RegExp; label: string }[] = [
  ...HOLD_V2.filter((r) => r.words && !r.claim && !r.when).map((r) => ({ re: optionalSpaces(r.re), label: r.label })),
  ...HOLD.map((re) => ({ re: optionalSpaces(re), label: 'promotion' })),
  ...PROMO.map((re) => ({ re: optionalSpaces(re), label: 'promotion' })),
];
function variantLabel(forms: { text: string; joined: [number, number][] }[]): string | null {
  for (const v of PHRASE_VARIANTS) {
    for (const { text, joined } of forms) {
      if (!joined.length) continue;
      for (const m of text.matchAll(v.re)) {
        const a = m.index!, b = a + m[0].length;
        if (joined.some(([s, e]) => a < e && b > s)) return v.label;
      }
    }
  }
  return null;
}

// Fix round 7 (item 2): one word split by a space ("guar anteed"). Two adjacent letter runs (2+ letters each) are joined
// only when the joined word matches a frozen HOLD or scanner PROMO rule that neither part matches alone; the text with
// that one space removed is then read by that rule (with its talk exemption). Ordinary word pairs never join into such
// a word, so they never meet the rule.
// ponytail: a split into 3+ parts, or one beside a leet or look-alike letter, publishes; join more parts if the review
// queue shows them.
const SPLIT_PAIR = /(?<![\p{L}\p{N}])(\p{L}{2,})\s(?=(\p{L}{2,})(?![\p{L}\p{N}]))/gu;
function splitWordLabel(f: string): string | null {
  for (const m of f.matchAll(SPLIT_PAIR)) {
    const a = m[1], b = m[2], w = a + b, cut = m.index! + a.length;
    for (const re of [...HOLD, ...PROMO]) {
      if (!re.test(w) || re.test(a) || re.test(b)) continue;
      const talk = HOLD.includes(re) ? regexTalk(HOLD_TALK.get(re)) : promoTalk;
      if (matchesExcept(re, f.slice(0, cut) + f.slice(cut + 1), talk)) return 'promotion';
    }
  }
  return null;
}

// The full verdict: status plus the label of the first rule that matched (null when published). Matching runs on the
// raw text and its skeleton (figures read as figures); `words` rules and LONG_WORDS also on leet and squashed forms.
// Fix round 5 (item 2): the frozen HOLD and the imported PROMO also run on the leet and squashed forms ("gu4rant33d",
// "g.u.a.r.a.n.t.e.e.d", "join🔥my🔥group").
// Fix round 5 (item 3): `after` (the start-up re-check) applies only the rules added after that version: HOLD on the raw
// text is version 0 (main's rules), everything else version 1 unless the rule says otherwise (HoldRule.since).
// Fix round 6: version 2 adds the period-rate rules, the spelled-out phrase variants, the narrower exemption (on a
// version 1 note only what version 1 let through as talk) and the script g look-alike: a version 1 note holding that
// letter is matched by every version 1 rule again, since its skeleton changed.
export function moderateDetail(text: string, opts: { after?: number } = {}): { status: ThesisStatus; rule: string | null } {
  const raw = String(text ?? '');
  const remapped = opts.after !== undefined && opts.after < 2 && /ɡ/.test(raw);
  const on = (since = 1) => opts.after === undefined || since > opts.after || (remapped && since >= 1);
  const sk = figures(skeleton(raw));
  const forms = [...new Set([raw, sk, figures(skeleton(unOverride(raw)))])];
  const wordForms = [...new Set([...forms, ...[sk, ...leet(sk)].flatMap((f) => [f, squash(f)])])];
  for (const r of HOLD_V2) if (on(r.since) && (r.words ? wordForms : forms).some((f) => ruleHolds(r, f))) return { status: 'held', rule: r.label };
  const spelt = on() ? speltLabel(sk) : null;
  if (spelt) return { status: 'held', rule: spelt };
  for (const re of HOLD) {
    const talk = regexTalk(HOLD_TALK.get(re));
    if (on(0) && matchesExcept(re, raw, talk)) return { status: 'held', rule: 'promotion' };
    if (on() && wordForms.some((f) => matchesExcept(re, f, talk))) return { status: 'held', rule: 'promotion' };
  }
  // Fix round 3 (QA item 2): the scanner's list also names a singular top-ranked pick; in a note that is talk about the
  // trader's own choice ("Not my best one, cut it"), so PROMO sees it as "choice". The offer forms (plural, dated, free)
  // were held by the picks rule above.
  const promoForms = wordForms.map((f) => f.replace(SINGLE_PICK, '$1 choice'));
  const promoTalkNow = on() ? promoTalk : on(2) ? promoTalkV2Only : null;
  if (promoTalkNow) for (const re of PROMO) if (promoForms.some((f) => matchesExcept(re, f, promoTalkNow))) return { status: 'held', rule: 'promotion' };
  const long = [sk, ...leet(sk)].flatMap((f) => [f, squash(f)]);
  if (on()) for (const r of LONG_WORDS) if (long.some((f) => r.re.test(f))) return { status: 'held', rule: r.label };
  const variant = on(2) ? variantLabel([sk, ...leet(sk)].map(squashSpans)) : null;
  if (variant) return { status: 'held', rule: variant };
  const split = on(3) ? splitWordLabel(sk) : null;
  if (split) return { status: 'held', rule: split };
  return { status: 'published', rule: null };
}

export function moderate(text: string): ThesisStatus {
  return moderateDetail(text).status;
}
