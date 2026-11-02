import type { Metadata } from 'next';
// FIXES-LABELS (D-09 / D20, POLICY F3): the F3 line in plain view after the first performance block.
import { Disclaimer } from '../disclaimer.tsx';
import Link from 'next/link';
import { HOW, HOW_PERSONAL, OPEN, OPTIONS, PUBLIC } from '@/lib/copy.ts';

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
      {/* FIXES-LABELS (D-09): after the block that describes the returns */}
      <Disclaimer />
      {/* OPTIONS (docs/features/logs/options/plan.md D8): the profile's gated count line links here. */}
      <h2 id="options">{OPTIONS.howTitle}</h2>
      <p>{OPTIONS.how}</p>
      <ul>{OPTIONS.howMath.map((l) => <li key={l}>{l}</li>)}</ul>
      <h2>{HOW.excludedTitle}</h2>
      {/* F-32 Part A: the profile's transfer line links to #transfers. */}
      <ul>{HOW.excluded.map((l) => <li key={l} {...(l === HOW.transfer ? { id: 'transfers' } : l === HOW.transferOut ? { id: 'transfers-out' } : {})}>{l}</li>)}</ul>
      <h2>{HOW.freezeTitle}</h2>
      <p>{HOW.freeze}</p>
      {/* F-2 PR-5 (Q12): the personal ordering, in words, from the same constants. */}
      <h2>{HOW_PERSONAL.title}</h2>
      <p>{HOW_PERSONAL.text}</p>
      {/* F-7 (legal C24): what public filing records are and what they leave out. */}
      <h2 id="public-filings">{PUBLIC.how.title}</h2>
      <ul>{PUBLIC.how.lines.map((l) => <li key={l}>{l}</li>)}</ul>
      <p><Link className="tap44" href="/public-records">{PUBLIC.how.link}</Link></p>
    </main>
  );
}
