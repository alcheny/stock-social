import type { Metadata } from 'next';
import Link from 'next/link';
import { HOW, OPEN, PUBLIC } from '@/lib/copy.ts';

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
      <h2>{HOW.excludedTitle}</h2>
      <ul>{HOW.excluded.map((l) => <li key={l}>{l}</li>)}</ul>
      <h2>{HOW.freezeTitle}</h2>
      <p>{HOW.freeze}</p>
      {/* F-7 (legal C24): what public filing records are and what they leave out. */}
      <h2 id="public-filings">{PUBLIC.how.title}</h2>
      <ul>{PUBLIC.how.lines.map((l) => <li key={l}>{l}</li>)}</ul>
      <p><Link className="tap44" href="/public-records">{PUBLIC.how.link}</Link></p>
    </main>
  );
}
