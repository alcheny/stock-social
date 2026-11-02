import { F29, OPTIONS } from '@/lib/copy.ts';

// F-29 (docs/features/logs/F-29/plan.md D2): the /how options paragraph from the gate. Closed (today): the legal
// committee's signed interim words, true for every record. Open: the legal sentence. Pure, so one process renders both
// states (e2e/f29-gated-wording.spec.ts); /how stays static, as the gate flips only with a deploy.
export function HowOptionsParagraph({ open }: { open: boolean }) {
  return <p data-options-how={open ? 'open' : 'interim'}>{open ? OPTIONS.how : F29.howInterim}</p>;
}
