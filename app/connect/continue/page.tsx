import type { Metadata } from 'next';
import { PORTAL, TITLES } from '@/lib/copy.ts';
import { PORTAL_REDIRECT } from '@/lib/portal.ts';
import { AutoContinue } from './auto-continue.tsx';

// A11Y-FIXES #20 (WCAG 2.4.2): this route's own title.
export const metadata: Metadata = { title: TITLES.continue };

// Fix round 2 (engineer walk, UX lead note 4): after the embedded portal reports an error (its broker login popup was
// blocked), one line from the app before the vendor's own page, so that page does not reappear unexplained. It
// continues on its own after a moment; the link does the same without script. Both go to the redirect flow
// (/connect/start), which mints for this trader or bound attempt only, as every fallback does. Nothing is read from
// the request.
export default function Continue() {
  return (
    <main className="page auth">
      <p role="status" id="continue-line">{PORTAL.popupBlocked}</p>
      <p><a className="button wide" href={PORTAL_REDIRECT}>{PORTAL.continue}</a></p>
      <AutoContinue href={PORTAL_REDIRECT} />
    </main>
  );
}
