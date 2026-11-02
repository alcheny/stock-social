'use client';
import { useEffect, useState, type CSSProperties } from 'react';
import { FC5 } from '@/lib/copy.ts';

// The field's maxLength and lib/thesis-save.ts#THESIS_MAX (that module reads the database, so it never loads here).
const THESIS_LIMIT = 280;
// The spoken line sits after Save, on a line of its own (form.inline wraps: app/u/[handle]/page.tsx#NOTE_FORM). Layout only.
const SAY = { order: 1, flexBasis: '100%' } as const;

// FIXES-CYCLE5 (F5-24, C5-27; WCAG 3.3.2, 4.1.3): the note field's count ("‹n› of 280") and what it says out loud. The
// count is rendered on the server from the saved note's length (the form works the same without JavaScript), then kept
// current as the author types. The count itself is not a live region (it would speak on every key); one polite region
// speaks only three things: "20 characters left" when the note reaches 260, "Limit reached, 280 of 280" at the limit, and
// "Your paste was cut to 280 characters." when a paste would have run past the limit (the browser's maxLength cuts it),
// shown until the next input. The field keeps its own value (uncontrolled), so a server re-render after Save, or React
// resetting the form after the action, sets the count again from the field.
export function NoteField({ id, countId, initial, style }: { id: string; countId: string; initial: number; style?: CSSProperties }) {
  const [n, setN] = useState(initial);
  const [say, setSay] = useState('');
  useEffect(() => {
    const el = document.getElementById(id);
    if (!(el instanceof HTMLTextAreaElement)) return;
    let last = el.value.length, pasteCut = false;
    setN(last);
    const sync = () => {
      const len = el.value.length;
      if (pasteCut) { pasteCut = false; setSay(FC5.notePasteCut); }
      else if (len >= THESIS_LIMIT && last < THESIS_LIMIT) setSay(FC5.noteFull);
      else if (len >= THESIS_LIMIT - 20 && len < THESIS_LIMIT && (last < THESIS_LIMIT - 20 || last >= THESIS_LIMIT)) setSay(FC5.noteNear);
      else if (len < THESIS_LIMIT - 20) setSay('');
      last = len;
      setN(len);
    };
    const paste = (e: ClipboardEvent) => {
      const add = e.clipboardData?.getData('text') ?? '';
      const kept = el.value.length - Math.abs((el.selectionEnd ?? 0) - (el.selectionStart ?? 0));
      pasteCut = kept + add.length > THESIS_LIMIT;
    };
    // A form reset (React resets uncontrolled fields after a form action) changes the value without an input event.
    const reset = () => setTimeout(() => { last = el.value.length; pasteCut = false; setSay(''); setN(last); }, 0);
    const form = el.form;
    el.addEventListener('input', sync);
    el.addEventListener('paste', paste);
    form?.addEventListener('reset', reset);
    return () => { el.removeEventListener('input', sync); el.removeEventListener('paste', paste); form?.removeEventListener('reset', reset); };
  }, [id, initial]);
  return (
    <>
      <span id={countId} className="muted small note-count" style={style}>{FC5.noteCount(n)}</span>
      <span aria-live="polite" className="muted small note-say" data-note-say="" style={SAY}>{say}</span>
    </>
  );
}
