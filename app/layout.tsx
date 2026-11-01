import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { currentUser } from '@/lib/session.ts';
import { sql } from '@/lib/db.ts';
import { NavLogin } from './nav-login.tsx';
import { headers } from 'next/headers';
import { FOOTER, NAV, verifiedMeansFooter } from '@/lib/copy.ts';
// F-13: the pre-paint device-flag script (no flash of a dismissed line or a used hint).
import { SEEN_SCRIPT } from '@/lib/device-flag.ts';
import './globals.css';

export const metadata: Metadata = {
  title: 'Stock Social',
  // QA round 1 (finding 1): the root description shows over a feed with Demo cards, so it names no trust state.
  // QA round 2 (N1): it covers records built from public filings too (F-7).
  description: 'Trading records imported read-only from brokers and built from public filings. Demo records are marked Demo. Losses included.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0b0b0f' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await currentUser();
  // F-2 PR-1 fix round 1 (UX follow-up 8): who is viewing, for the feed's end card only (app/feed-rows.tsx#FeedEnd shows
  // "See your record" to a viewer who publishes). The feed itself reads no session.
  const viewer = !me ? 'guest' : (await sql`select exists (select 1 from closed_trades where user_id = ${me.id}) as p`)[0].p ? 'publisher' : 'member';
  // F-13: the request's CSP nonce (proxy.ts, lib/csp.ts) for the inline pre-paint script; without it the browser blocks it.
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    // F-13: the pre-paint script sets <html data-ss-seen> before hydration, so React accepts the DOM's attribute.
    <html lang="en" suppressHydrationWarning>
      <body data-viewer={viewer}>
        {/* F-13: runs while the HTML parses, before the first paint; reads device storage only, never throws. */}
        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: SEEN_SCRIPT }} />
        {/* F-1 PR-3 fix round 4 (POLICY F3/A1): the disclaimer and legal links are one Tab away on any page, however long. */}
        <a className="skip-link" href="#site-footer">{FOOTER.skip}</a>
        <nav className="top">
          <Link href="/" className="logo">Stock Social</Link>
          {/* F-13 (D27): the nav label. */}
          <Link href="/t">{NAV.stocks}</Link>
          {me && <Link href="/me/record">My record</Link>}
          {me ? <Link className="me" href={`/u/${me.handle}`}>@{me.handle}</Link> : <NavLogin>Publish your trades</NavLogin>}
        </nav>
        {children}
        {/* docs/POLICY.md F3: every page that can show performance carries this, in plain view */}
        <footer className="site muted" id="site-footer" tabIndex={-1}>
          {/* Fix #9 (F-13 group): the Verified sentence is the badge title's constant (lib/copy.ts VERIFIED_MEANING). */}
          Not investment advice. Past performance does not guarantee future results. {verifiedMeansFooter()}
          <nav className="legal" aria-label="Legal">
            <Link href="/terms">{FOOTER.terms}</Link> <Link href="/privacy">{FOOTER.privacy}</Link> <Link href="/how">{FOOTER.how}</Link>
          </nav>
        </footer>
      </body>
    </html>
  );
}
