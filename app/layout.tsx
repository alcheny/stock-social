import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { currentUser } from '@/lib/session.ts';
import { NavLogin } from './nav-login.tsx';
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
        <nav className="top">
          <Link href="/" className="logo">Stock Social</Link>
          <Link href="/t">Stocks</Link>
          {me && <Link href="/me/record">My record</Link>}
          {me ? <Link className="me" href={`/u/${me.handle}`}>@{me.handle}</Link> : <NavLogin>Publish your trades</NavLogin>}
        </nav>
        {children}
        {/* docs/POLICY.md F3: every page that can show performance carries this, in plain view */}
        <footer className="site muted">
          Not investment advice. Past performance does not guarantee future results. &ldquo;Verified&rdquo; means
          imported read-only from the trader&rsquo;s broker; it doesn&rsquo;t verify identity or imply endorsement.
        </footer>
      </body>
    </html>
  );
}
