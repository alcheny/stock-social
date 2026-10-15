export type ThesisStatus = 'held' | 'published';

// Phase 1 moderation = rules + held-for-review queue (DESIGN §2.8). Hold, never silently drop.
// No g/y flags: those make RegExp#test stateful across calls.
export const HOLD: RegExp[] = [
  /guarantee/i, /risk[- ]?free/i, /can'?t lose/i, /\b100x\b/i, /to the moon/i,
  /dm me|join my|link in bio|t\.me\/|discord\.gg|whatsapp/i,
  /\b(buy|load up on) (now|before)\b/i, /financial advice/i,
];

export function moderate(text: string): ThesisStatus {
  return HOLD.some((r) => r.test(text)) ? 'held' : 'published';
}
