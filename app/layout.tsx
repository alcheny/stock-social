import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { currentUser } from '@/lib/session.ts';
import { NavLogin } from './nav-login.tsx';
import { FOOTER } from '@/lib/copy.ts';
import './globals.css';

export const metadata: Metadata = {
  title: 'Stock Social',
  description: 'Verified trades, straight from the broker. Losses included.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0b0b0f' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await currentUser();
  return (
    <html lang="en">
      <body>
        {/* F-1 PR-3 fix round 4 (POLICY F3/A1): the disclaimer and legal links are one Tab away on any page, however long. */}
        <a className="skip-link" href="#site-footer">{FOOTER.skip}</a>
        <nav className="top">
          <Link href="/" className="logo">Stock Social</Link>
          <Link href="/t">Stocks</Link>
          {me && <Link href="/me/record">My record</Link>}
          {me ? <Link className="me" href={`/u/${me.handle}`}>@{me.handle}</Link> : <NavLogin>Publish your trades</NavLogin>}
        </nav>
        {children}
        {/* docs/POLICY.md F3: every page that can show performance carries this, in plain view */}
        <footer className="site muted" id="site-footer" tabIndex={-1}>
          Not investment advice. Past performance does not guarantee future results. &ldquo;Verified&rdquo; means
          imported read-only from the trader&rsquo;s broker; it doesn&rsquo;t verify identity or imply endorsement.
          <nav className="legal" aria-label="Legal">
            <Link href="/terms">{FOOTER.terms}</Link> <Link href="/privacy">{FOOTER.privacy}</Link> <Link href="/how">{FOOTER.how}</Link>
          </nav>
        </footer>
      </body>
    </html>
  );
}
