'use client';
import { useEffect } from 'react';

// An error result takes focus on its heading, so a screen reader and a keyboard land on what happened (D9).
export function FocusHeading({ id }: { id: string }) {
  useEffect(() => { document.getElementById(id)?.focus(); }, [id]);
  return null;
}
