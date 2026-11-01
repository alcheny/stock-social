import type { CtaSurface } from '@/lib/referral.ts';
import { PUBLIC_SHORT } from '@/lib/copy.ts';

// Signed-out call to action on real profiles and trade pages. The handle is [a-z0-9_] so the link is URL-safe.
export const joinHref = (handle: string, via: CtaSurface) => `/login?ref=${handle}&via=${via}`;

export function JoinCta({ handle, via }: { handle: string; via: CtaSurface }) {
  return (
    <aside className="join" aria-label="Publish your own record">
      <p><b>Verify your own record.</b> {PUBLIC_SHORT.join}</p>
      <a className="button" href={joinHref(handle, via)}>Verify your record</a>
    </aside>
  );
}
