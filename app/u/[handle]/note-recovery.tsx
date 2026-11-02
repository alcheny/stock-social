'use client';
import { useEffect, useState } from 'react';
import { FC5 } from '@/lib/copy.ts';

// FIXES-CYCLE5 (F5-2, committee round 3 items 1 and 3; POLICY P6, U1): when a note save finds its trade gone, the text
// the author typed comes back in a read-only box inside the alert, so it is never lost without a word.
// - Rendered only on the author's own profile (app/u/[handle]/page.tsx renders it only when isMe).
// - One delegated `submit` listener stashes { key, text } of the note form being sent, in this tab's sessionStorage only.
// - The box shows only when the redirect's `n=<trade_key>` (shownKey) equals the stashed key, so a stale stash never
//   appears under an unrelated alert. The stash is removed once shown, and on every other load (shownKey null).
// - The text is never logged, never sent anywhere and never put in a URL. Without storage (blocked, private mode) or
//   without JavaScript, the alert shows alone, and FC5.noteUnsaved (which points at the box) is not rendered.
const STASH = 'fc5-note';

export function NoteRecovery({ shownKey }: { shownKey: string | null }) {
  const [text, setText] = useState('');
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STASH);
      sessionStorage.removeItem(STASH);
      const got = raw ? (JSON.parse(raw) as { key?: unknown; text?: unknown }) : null;
      if (shownKey && got && got.key === shownKey && typeof got.text === 'string' && got.text.trim()) setText(got.text);
    } catch { /* no storage: the alert shows alone */ }
    const stash = (e: Event) => {
      try {
        const form = e.target;
        if (!(form instanceof HTMLFormElement) || !form.classList.contains('note-form')) return;
        const key = form.elements.namedItem('tradeKey'), note = form.elements.namedItem('thesis');
        if (!(key instanceof HTMLInputElement) || !(note instanceof HTMLTextAreaElement)) return;
        sessionStorage.setItem(STASH, JSON.stringify({ key: key.value, text: note.value }));
      } catch { /* no storage: nothing kept */ }
    };
    document.addEventListener('submit', stash, true);
    return () => document.removeEventListener('submit', stash, true);
  }, [shownKey]);
  if (!text) return null;
  return (
    <>
      <p>{FC5.noteUnsaved}</p>
      <textarea readOnly rows={3} value={text} aria-label={FC5.noteUnsavedLabel} className="note-unsaved" style={BOX} />
    </>
  );
}

const BOX = { width: '100%', minHeight: 44, resize: 'vertical' } as const;
