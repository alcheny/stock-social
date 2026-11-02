// C5-39: split a label's decorative end arrows ("← Feed", "See full profile →") from its words. The arrows keep their
// spacing so the drawn text is exactly the input; app/arrow.tsx hides them from the accessibility tree.
export const ARROWS = /[←→]/;

export function splitArrow(text: string): { lead: string; words: string; trail: string } {
  const m = /^([←→]\s*)?([\s\S]*?)(\s*[←→])?$/u.exec(text)!;
  return { lead: m[1] ?? '', words: m[2], trail: m[3] ?? '' };
}
