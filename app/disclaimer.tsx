import { DISCLAIMER } from '@/lib/share.ts';

// Fix #2 (approval council cycle 2, POLICY F3): the disclaimer in plain view beside the first figures of a performance
// screen, exact text, never only in the footer. data-disclaimer is what e2e/disclaimer-guard.spec.ts looks for.
export function Disclaimer() {
  return <p className="muted" data-disclaimer>{DISCLAIMER}</p>;
}
