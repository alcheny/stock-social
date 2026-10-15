import type { ReferredSurface } from '@/lib/referral.ts';

// Signed-out call to action on real profiles and trade pages. The handle is [a-z0-9_] so the link is URL-safe.
export const joinHref = (handle: string, via: ReferredSurface) => `/login?ref=${handle}&via=${via}`;

export function JoinCta({ handle, via }: { handle: string; via: ReferredSurface }) {
  return (
    <aside className="join" aria-label="Publish your own record">
      <p><b>Verify your own record.</b> Read-only broker connection; only percentages are ever public. 18+.</p>
      <a className="button" href={joinHref(handle, via)}>Verify your record</a>
    </aside>
  );
}
