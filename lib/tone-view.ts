// QA round 1 (finding 8, cycle-2 #19; POLICY A1): a return's colour class and its screen-reader word, both from tone() on
// the value as pct() prints it, so a printed "0.0%" is Flat: never green or red, never announced as a gain or a loss.
import { tone, toneWord, type Tone } from './format.ts';

export type ToneView = { tone: Tone; cls: '' | 'up' | 'down'; word: 'Gain' | 'Loss' | 'Flat' };
export function toneView(x: number, digits = 1): ToneView {
  const t = tone(x, digits);
  return { tone: t, cls: t === 'flat' ? '' : t, word: toneWord(t) };
}
