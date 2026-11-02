import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TAKEDOWN } from '@/lib/copy.ts';
import { takedownContact, takedownReachable } from '@/lib/takedown.ts';

// F-16 (plan docs/features/logs/F-16-F-17/plan.md §2.4, §5.7): where to send a notice or takedown request. The wording is
// approved (OD 2.18, 2026-11-02), so the page renders on every deploy (lib/takedown.ts#takedownReachable). The role
// mailbox is env TAKEDOWN_CONTACT (never committed, never a personal address); until it is set the page says so and
// stays out of search indexes (noindex), since it gives no way to send anything yet.
// No legal-status claim, agent title or reply time (lib/f16-static.test.ts). Env is read per request.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  if (!takedownReachable()) notFound(); // the generic 404's head, not this page's
  return { title: TAKEDOWN.title, ...(TAKEDOWN.approved && takedownContact() ? {} : { robots: { index: false, follow: false } }) };
}

export default function Takedown() {
  if (!takedownReachable()) notFound();
  const contact = takedownContact();
  return (
    <main className="page how takedown">
      <h1>{TAKEDOWN.h1}</h1>
      {TAKEDOWN.lines.map((l) => <p key={l}>{l}</p>)}
      <h2>{TAKEDOWN.contactTitle}</h2>
      <p data-contact>{contact ? <a className="tap44" href={`mailto:${contact}`}>{contact}</a> : TAKEDOWN.unset}</p>
    </main>
  );
}
