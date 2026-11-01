import type { Metadata } from 'next';
import { LEGAL_PLACEHOLDER } from '@/lib/copy.ts';

// Fix #21 (approval council cycle 2, WCAG 2.4.2): each route has its own title.
export const metadata: Metadata = { title: 'Privacy Policy · Stock Social' };

// POLICY P6/F3: the attestation links here. The owner supplies the final text (POLICY H); this is a marked placeholder.
export default function Privacy() {
  return (
    <main className="page">
      <h1>{LEGAL_PLACEHOLDER.privacyTitle}</h1>
      <p role="note" className="placeholder">{LEGAL_PLACEHOLDER.placeholder}</p>
    </main>
  );
}
