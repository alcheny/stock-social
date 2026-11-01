import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TAKEDOWN } from '@/lib/copy.ts';
import { takedownContact, takedownReachable } from '@/lib/takedown.ts';

// F-16 (plan docs/features/logs/F-16-F-17/plan.md §2.4, §5.7): where to send a notice or takedown request. Draft: on a
// deploy that admits real users it is a 404 until the owner approves the wording (TAKEDOWN.approved) and sets the role
// mailbox (env TAKEDOWN_CONTACT, never committed, never a personal address); in the sandbox it shows a draft banner.
// No legal-status claim, agent title or reply time (lib/f16-static.test.ts). Env is read per request.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  if (!takedownReachable()) notFound(); // the generic 404's head, not this page's
  return { title: TAKEDOWN.title, ...(TAKEDOWN.approved ? {} : { robots: { index: false, follow: false } }) };
}

export default function Takedown() {
  if (!takedownReachable()) notFound();
  const contact = takedownContact();
  return (
    <main className="page how takedown">
      {!TAKEDOWN.approved && <p role="note" className="takedown-draft">{TAKEDOWN.draft}</p>}
      <h1>{TAKEDOWN.h1}</h1>
      {TAKEDOWN.lines.map((l) => <p key={l}>{l}</p>)}
      <h2>{TAKEDOWN.contactTitle}</h2>
      <p data-contact>{contact ? <a className="tap44" href={`mailto:${contact}`}>{contact}</a> : TAKEDOWN.unset}</p>
    </main>
  );
}
