import { LEGAL_PLACEHOLDER } from '@/lib/copy.ts';

// POLICY P6/F3: the attestation links here. The owner supplies the final text (POLICY H); this is a marked placeholder.
export default function Terms() {
  return (
    <main className="page">
      <h1>{LEGAL_PLACEHOLDER.termsTitle}</h1>
      <p role="note" className="placeholder">{LEGAL_PLACEHOLDER.placeholder}</p>
    </main>
  );
}
