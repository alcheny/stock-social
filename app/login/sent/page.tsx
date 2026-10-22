import Link from 'next/link';
import { cookies } from 'next/headers';
import { resendLink } from '../../auth/actions.ts';
import { SIGNIN } from '@/lib/copy.ts';
import { ATTEMPT_COOKIE, ownsAttempt } from '@/lib/auth/links.ts';
import { sessionSecret } from '@/lib/auth/sessions.ts';

type SP = { a?: string; again?: string; error?: string };

// After "Send me a link". error=send is the send-failure state (message + retry); error=limit the rate limit.
// "Send again" shows only to the browser that started the attempt (signed cookie); anyone else sees the text and Back.
export default async function LinkSent({ searchParams }: { searchParams?: Promise<SP> }) {
  const sp = (await searchParams) ?? {};
  const a = Number(sp.a);
  const owner = a > 0 && ownsAttempt((await cookies()).get(ATTEMPT_COOKIE)?.value, a, sessionSecret());
  const failed = sp.error === 'send';
  return (
    <main className="page auth">
      <h1>{SIGNIN.title}</h1>
      {failed ? <p role="alert" className="down" id="send-err">{SIGNIN.sendFailed}</p> : <p role="status">{SIGNIN.linkSent}</p>}
      {sp.error === 'limit' && <p role="alert" className="muted small">{SIGNIN.tooMany}</p>}
      {!failed && sp.again && <p className="muted small">{SIGNIN.sentAgain}</p>}
      {owner && (
        <form action={resendLink}>
          <input type="hidden" name="a" value={a} />
          <button className={`button${failed ? '' : ' secondary'}`} aria-describedby={failed ? 'send-err' : undefined}>{SIGNIN.sendAgain}</button>
        </form>
      )}
      <p><Link href="/login" className="tap">{SIGNIN.back}</Link></p>
    </main>
  );
}
