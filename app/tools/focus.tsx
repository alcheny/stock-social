'use client';
// F-3 (engineer D13, A1): after an action reloads the page, focus moves to its status line, so a screen reader hears
// the result and the next Tab starts from there.
import { useEffect } from 'react';

export function FocusMessage() {
  useEffect(() => { document.getElementById('rt-msg')?.focus(); }, []);
  return null;
}
