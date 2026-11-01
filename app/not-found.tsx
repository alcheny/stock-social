import type { Metadata } from 'next';
import Link from 'next/link';

// Fix #20 (approval council cycle 2): a real 404 (status and a distinct title) for unknown routes and notFound() calls,
// instead of the framework's untitled default.
// ponytail: an invalid ticker (/t/%3Cscript%3E) is still a 200 "Ticker not found" page — fix: notFound() in
// app/t/[symbol]/page.tsx, in the follow-up after claude/fix-truthful-labels merges.
// Next.js adds <meta name="robots" content="noindex"> to this page itself.
export const metadata: Metadata = { title: 'Page not found · Stock Social' };

export default function NotFound() {
  return (
    <main className="page">
      <h1>Page not found</h1>
      <p>There&apos;s no page at this address. The link may be mistyped, or the page may have been removed.</p>
      <p><Link href="/">Back to the feed</Link> · <Link href="/t">All stocks</Link></p>
    </main>
  );
}
