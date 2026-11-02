// Promotional, promissory or advice language (docs/POLICY.md F1-F3): one source of words for the compliance scanner
// (scripts/compliance.ts, rule 5, product code and copy) and thesis moderation (lib/moderation.ts). No imports, so
// importing it never pulls the scanner (node:fs, node:child_process, git) into a server function (F4-6).
// The scanner pins this list in scripts/compliance.test.ts (protected): changing it needs the owner.
export const PROMO: RegExp[] = [/\bguaranteed? (returns?|profits?|gains?|income|results?|winners?)\b/i, /\brisk[- ]free\b/i,
  /\b(can'?t|cannot|won'?t) lose money\b/i, /\bget rich\b/i, /\bbeat the market\b/i, /\b(sure thing|easy money|free money)\b/i,
  /\b(you should|we recommend( that you)?|time to) (buy|sell)\b/i, /\bbuy now\b/i, /\bcopy (this|their|my|his|her) trades?\b/i,
  /\b(proven|guaranteed) (strategy|system|track record|winner)\b/i, /\b(outperforms?|make money|passive income|hot (pick|stock)|top picks?|pick of the day)\b/i,
  // Completeness claims the data can't back (options and some positions are excluded): POLICY F3.
  /\b(every closed trade is published|see every trade|all (of )?(their|his|her|my) trades|from any broker|every trade, verified|every (verified )?(closed )?trade (in|is listed)|recaps show every|all the trades in it)\b/i,
  // "Verified" means broker-sourced only; never "verified by/via/on" someone, which implies endorsement (POLICY F3a).
  /\bverified (via|by|on)\b/i];
