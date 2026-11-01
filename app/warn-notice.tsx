// F-27 (docs/features/F-27-colour-follow-ups.md): the one warn notice. A failed import is never told apart from a loss by
// colour: an icon (warning triangle, aria-hidden, ignores pointer events so a double tap on it still likes the card), a
// box (1 px --warn border on --surface) and the unchanged words in --text. `.record-failed` stays as the e2e hook.
// --warn is drawn only by `.warn-notice` rules in app/globals.css (block "F-27").
export function WarnNotice({ role, children }: { role: 'status' | 'alert'; children: React.ReactNode }) {
  return (
    <p role={role} className="warn-notice record-failed">
      <svg data-warn-icon aria-hidden="true" focusable="false" viewBox="0 0 16 16" width="16" height="16">
        <path d="M8 1.5 15 14H1z" fill="none" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M8 6v3.5" fill="none" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="11.75" r="0.9" />
      </svg>
      <span>{children}</span>
    </p>
  );
}
