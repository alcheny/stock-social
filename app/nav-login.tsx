'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// The nav's way in. On a profile it carries the handle (ref) and the surface (via=nav), so a trader who arrived on a
// shared link and taps the nav is attributed to that profile in the funnel (landed.source), not to "direct".
export function NavLogin({ children }: { children: React.ReactNode }) {
  const m = /^\/u\/([a-z0-9_]{3,20})(?:\/|$)/.exec(usePathname() ?? '');
  return <Link href={m ? `/login?ref=${m[1]}&via=nav` : '/login'}>{children}</Link>;
}
