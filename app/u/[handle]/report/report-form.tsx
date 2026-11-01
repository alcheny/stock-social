'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { PROFILE_REPORT_COPY as C, REPORT_CATEGORIES } from '@/lib/report-copy.ts';
import { reportProfileAction } from '../../../report-actions.ts';

// F-16 (plan docs/features/logs/F-16-F-17/plan.md §2.2; K18; v2 B8): the profile report form. One fieldset of six
// labelled radios, no free text. Every outcome is announced and takes focus:
// - no category: role=alert between the legend and the first radio, every radio aria-invalid and described by it, focus
//   on the first radio (checked here before posting, so it is instant; the action says the same without JavaScript);
// - rate, failed, signed out: one focusable role=alert above the form, which stays;
// - sent or already reported: the form is replaced by a focusable role=status line.
// The server action is engineer B's (app/report-actions.ts): { state, message, field? }; an empty message falls back to
// the same copy (lib/report-copy.ts PROFILE_REPORT_COPY).

type Result = { state: string; message: string; field?: string };
const IDLE: Result = { state: 'idle', message: '' };
const FALLBACK: Record<string, string> = { sent: C.done, already: C.already, rate: C.rate, error: C.failed, 'signed-out': C.signedOut, invalid: C.noCategory };

export function ReportForm({ handle }: { handle: string }) {
  const [result, action, pending] = useActionState(reportProfileAction, IDLE);
  const [local, setLocal] = useState<{ n: number } | null>(null); // a client-side "no category", counted so a repeat re-focuses
  const first = useRef<HTMLInputElement>(null);
  const alert = useRef<HTMLParagraphElement>(null);
  const status = useRef<HTMLParagraphElement>(null);
  const message = result.message || FALLBACK[result.state] || C.failed;
  const done = result.state === 'sent' || result.state === 'already';
  const invalid = !!local || result.state === 'invalid';

  useEffect(() => {
    if (done) status.current?.focus();
    else if (result.state === 'invalid') first.current?.focus();
    else if (result.state !== 'idle') alert.current?.focus();
  }, [result, done]);
  useEffect(() => { if (local) first.current?.focus(); }, [local]);

  if (done) {
    return <p role="status" tabIndex={-1} ref={status} className="report-done">{message}</p>; // the page's back link follows
  }
  const describedBy = invalid ? 'report-hint report-err' : 'report-hint';
  return (
    <>
      {!invalid && result.state !== 'idle' && (
        <p role="alert" tabIndex={-1} ref={alert} className="down report-alert">
          {message}{result.state === 'signed-out' && <> <Link className="tap44" href="/login">{C.signIn}</Link></>}
        </p>
      )}
      <form action={action} className="report-form" noValidate onSubmit={(e) => {
        if (!new FormData(e.currentTarget).get('category')) { e.preventDefault(); setLocal((l) => ({ n: (l?.n ?? 0) + 1 })); }
        else setLocal(null);
      }}>
        <input type="hidden" name="handle" value={handle} />
        <fieldset>
          <legend>{C.legend}</legend>
          {invalid && <p id="report-err" role="alert" className="down report-err">{result.state === 'invalid' && result.message ? result.message : C.noCategory}</p>}
          {REPORT_CATEGORIES.map((c, i) => (
            <div className="report-choice" key={c.code}>
              <input type="radio" id={`report-${c.code}`} name="category" value={c.code} ref={i === 0 ? first : undefined}
                aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={() => setLocal(null)} />
              <label htmlFor={`report-${c.code}`}>{c.label}</label>
            </div>
          ))}
          <p id="report-hint" className="muted small">{C.hint}</p>
        </fieldset>
        <button type="submit" className="report-send" disabled={pending} aria-disabled={pending || undefined}>{C.submit}</button>
      </form>
    </>
  );
}
