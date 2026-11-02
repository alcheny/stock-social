// C5-39 (with C4-34(c)): a decorative arrow at either end of a link or button label is drawn, never spoken. The visible
// text is unchanged; the arrow sits in an aria-hidden span, so the accessible name is the words alone ("Feed", never
// "left arrow Feed"). Copy constants keep their arrows (their tests pin them); render them through <Arrowed>.
import { splitArrow } from '@/lib/arrow.ts';

export function Arrowed({ text }: { text: string }) {
  const { lead, words, trail } = splitArrow(text);
  return <>{lead && <span aria-hidden="true">{lead}</span>}{words}{trail && <span aria-hidden="true">{trail}</span>}</>;
}
