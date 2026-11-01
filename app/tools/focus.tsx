'use client';
// F-3 (engineer D13, UX lead U2/U3, A1): after an action reloads the page, focus moves to what changed: the status line,
// the moved card (it scrolls into view) or the field with the error, so a screen reader hears the result and the next
// Tab starts there. Runs after every render, so a second action on the same page moves focus again.
import { useEffect } from 'react';

export function FocusMessage({ target }: { target: string }) {
  useEffect(() => {
    const el = document.getElementById(target);
    if (el) { el.focus(); el.scrollIntoView({ block: 'nearest' }); }
  });
  return null;
}
