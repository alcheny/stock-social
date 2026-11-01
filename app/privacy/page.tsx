import type { Metadata } from 'next';
import { LEGAL_PLACEHOLDER, TITLES } from '@/lib/copy.ts';

// A11Y-FIXES #20 (WCAG 2.4.2): this route's own title.
export const metadata: Metadata = { title: TITLES.privacy };

// POLICY P6/F3: the attestation links here. The owner supplies the final text (POLICY H); this is a marked placeholder.
export default function Privacy() {
  return (
    <main className="page">
      <h1>{LEGAL_PLACEHOLDER.privacyTitle}</h1>
      <p role="note" className="placeholder">{LEGAL_PLACEHOLDER.placeholder}</p>
    </main>
  );
}
