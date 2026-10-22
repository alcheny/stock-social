import Link from 'next/link';
import { RESULT } from '@/lib/copy.ts';

// A connect page called without a valid, owned connection id: a plain page, never a server error (D3).
export function NotFound() {
  return (
    <main className="page auth">
      <h1 data-kind="not-found">{RESULT.notFound}</h1>
      <p><Link className="button wide" href="/connect">{RESULT.notFoundAction}</Link></p>
      <p><Link className="button wide secondary" href="/">{RESULT.feed}</Link></p>
    </main>
  );
}
