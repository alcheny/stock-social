import Link from 'next/link';
import { resendLink } from '../../auth/actions.ts';
import { SIGNIN } from '@/lib/copy.ts';

export default async function LinkSent({ searchParams }: { searchParams?: Promise<{ a?: string; again?: string }> }) {
  const sp = await searchParams;
  const a = Number(sp?.a);
  return (
    <main className="page auth">
      <h1>{SIGNIN.title}</h1>
      <p role="status">{SIGNIN.linkSent}</p>
      {sp?.again && <p className="muted small">Sent again.</p>}
      {a > 0 && (
        <form action={resendLink}>
          <input type="hidden" name="a" value={a} />
          <button className="button secondary">{SIGNIN.sendAgain}</button>
        </form>
      )}
      <p><Link href="/login">← Back</Link></p>
    </main>
  );
}
