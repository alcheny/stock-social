import { DISCLAIMER } from '@/lib/share.ts';

// FIXES-LABELS (D-09 / D20, fix #3, POLICY F3): the F3 line in plain view, directly after the first block that shows
// performance. Static text: no role, no live region, not focusable. The footer keeps its own copy.
export function Disclaimer() {
  return <p className="muted small disclaimer" data-disclaimer>{DISCLAIMER}</p>;
}
