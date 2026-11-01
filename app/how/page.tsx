import type { Metadata } from 'next';
import { HOW, HOW_PERSONAL, OPEN, OPTIONS } from '@/lib/copy.ts';

// POLICY F3: what Verified means and what is excluded, in the words of lib/trades.ts. Static; linked from every page.
export const metadata: Metadata = { title: `${HOW.title} · Stock Social` };

export default function How() {
  return (
    <main className="page how">
      <h1>{HOW.title}</h1>
      <h2>{HOW.verifiedTitle}</h2>
      <p>{HOW.verified}</p>
      <h2>{HOW.mathTitle}</h2>
      <ul>{HOW.math.map((l) => <li key={l}>{l}</li>)}{/* F-6 */}{OPEN.how.map((l) => <li key={l}>{l}</li>)}</ul>
      {/* OPTIONS (docs/features/logs/options/plan.md D8): the profile's gated count line links here. */}
      <h2 id="options">{OPTIONS.howTitle}</h2>
      <p>{OPTIONS.how}</p>
      <ul>{OPTIONS.howMath.map((l) => <li key={l}>{l}</li>)}</ul>
      <h2>{HOW.excludedTitle}</h2>
      <ul>{HOW.excluded.map((l) => <li key={l}>{l}</li>)}</ul>
      <h2>{HOW.freezeTitle}</h2>
      <p>{HOW.freeze}</p>
      {/* F-2 PR-5 (Q12): the personal ordering, in words, from the same constants. */}
      <h2>{HOW_PERSONAL.title}</h2>
      <p>{HOW_PERSONAL.text}</p>
    </main>
  );
}
