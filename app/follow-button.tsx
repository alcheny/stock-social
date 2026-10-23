'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { FOLLOW } from '@/lib/copy.ts';
import { follow, followForm, unfollow, unfollowForm, type DiscoveryResult } from './discovery-actions.ts';

// F-2 PR-2: "Follow" / "Following" on the profile header and the feed pane. Private: no count anywhere. Optimistic
// (feedback on the tap; reverted with one line if the server refuses); the other copies of the same trader's pane on
// the page follow along. Without JavaScript the form posts the same action. Unfollow hides the trader from the feed
// for 90 days (criterion 4), so it says so, with Undo for 5 s. Signed out: a link to sign in.
const EVENT = 'ss:follow';
export const UNDO_MS = 5_000;

export function FollowButton({ handle, following, signedIn }: { handle: string; following: boolean; signedIn: boolean }) {
  const [on, setOn] = useState(following);
  const [said, setSaid] = useState<{ text: string; undo?: boolean } | null>(null);
  const timer = useRef(0);
  useEffect(() => {
    const sync = (e: Event) => { const d = (e as CustomEvent<{ handle: string; on: boolean }>).detail; if (d.handle === handle) setOn(d.on); };
    addEventListener(EVENT, sync);
    return () => { removeEventListener(EVENT, sync); clearTimeout(timer.current); };
  }, [handle]);
  if (!signedIn) return <Link className="button secondary follow" href="/login" aria-label={FOLLOW.signIn(handle)}>{FOLLOW.follow}</Link>;
  const flip = (v: boolean) => { setOn(v); dispatchEvent(new CustomEvent(EVENT, { detail: { handle, on: v } })); };
  const set = async (want: boolean) => {
    clearTimeout(timer.current);
    flip(want);
    setSaid(null);
    const r: DiscoveryResult = await (want ? follow : unfollow)(handle).catch(() => ({ ok: false, reason: 'invalid' }) as const);
    if (!r.ok) { flip(!want); setSaid({ text: FOLLOW.failed }); return; }
    if (want) { if (r.first) setSaid({ text: FOLLOW.first(handle) }); return; }
    setSaid({ text: FOLLOW.unfollowed(handle), undo: true });
    timer.current = window.setTimeout(() => setSaid(null), UNDO_MS);
  };
  return (
    <>
      <form action={(on ? unfollowForm : followForm).bind(null, handle)} onSubmit={(e) => { e.preventDefault(); void set(!on); }} className="follow-form">
        <button type="submit" className={on ? 'secondary follow' : 'follow'} aria-pressed={on}>{on ? FOLLOW.following : FOLLOW.follow}</button>
      </form>
      <p role="status" className="follow-status small">
        {said?.text}{said?.undo && <> <button type="button" className="secondary" onClick={() => void set(true)}>{FOLLOW.undo}</button></>}
      </p>
    </>
  );
}
