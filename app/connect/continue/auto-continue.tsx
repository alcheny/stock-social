'use client';
import { useEffect } from 'react';

export const CONTINUE_MS = 2_000;
// Long enough to read one line, then on to the vendor's page (the link on the page does the same by hand).
export function AutoContinue({ href }: { href: string }) {
  useEffect(() => {
    const t = setTimeout(() => window.location.assign(href), CONTINUE_MS);
    return () => clearTimeout(t);
  }, [href]);
  return null;
}
