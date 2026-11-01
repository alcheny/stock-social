// The Share button's picture formats (app/u/[handle]/story). F-4: the picture is the record card (lib/record-card.ts)
// at these sizes; the old story model (win rate, worst trade, the uncertainty pill) is gone with the owner's decision
// to take win rate and per-trade detail off the card.
export type ImageFormat = 'story' | 'square';
export const FORMATS = { story: { width: 1080, height: 1920 }, square: { width: 1080, height: 1080 } };
export const parseFormat = (v: string | null | undefined): ImageFormat => (v === 'story' ? 'story' : 'square');
