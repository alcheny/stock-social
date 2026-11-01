import type { Metadata } from 'next';
import Link from 'next/link';
import { NOT_FOUND, TITLES } from '@/lib/copy.ts';

// A11Y-FIXES #21 (WCAG 2.4.2, 1.3.1): the root 404, inside the layout so the nav and the footer stay. Next.js sends
// 404 for unmatched URLs and for notFound() called before streaming starts, and adds noindex itself.
export const metadata: Metadata = { title: TITLES.notFound };

export default function NotFound() {
  return (
    <main className="page">
      <h1>{NOT_FOUND.heading}</h1>
      <p>{NOT_FOUND.body}</p>
      <ul className="not-found-links">
        {NOT_FOUND.links.map((l) => <li key={l.href}><Link className="tap44" href={l.href}>{l.label}</Link></li>)}
      </ul>
    </main>
  );
}
