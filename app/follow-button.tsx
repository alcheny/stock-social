'use client';
import { useEffect, useState } from 'react';
import { FOLLOW } from '@/lib/copy.ts';
import { follow, followForm, unfollow, unfollowForm, type DiscoveryResult } from './discovery-actions.ts';

// F-2 PR-2: "Follow" / "Following" on the profile header and the feed pane, signed in only (fix round 1: signed out
// there is no control, since sign-in cannot return to the trader). Private: no count anywhere. Optimistic (feedback on
// the tap; reverted with one line if the server refuses); the other copies of the same trader's pane on the page follow
// along. Without JavaScript the form posts the same action. Unfollow says nothing and hides nothing (fix round 1:
// FEED_HIDES_UNFOLLOWED); "Follow" coming back is the feedback, and tapping it again is the undo. The status paragraph
// is an always-rendered polite live region (registered before it speaks; no status role, so it never competes with a
// page's own status line), and says "Only you can see this." once per viewer.
const EVENT = 'ss:follow';
export const UNDO_MS = 5_000;

export function FollowButton({ handle, following, signedIn }: { handle: string; following: boolean; signedIn: boolean }) {
  const [on, setOn] = useState(following);
  const [said, setSaid] = useState('');
  useEffect(() => {
    const sync = (e: Event) => { const d = (e as CustomEvent<{ handle: string; on: boolean }>).detail; if (d.handle === handle) setOn(d.on); };
    addEventListener(EVENT, sync);
    return () => removeEventListener(EVENT, sync);
  }, [handle]);
  if (!signedIn) return null;
  const flip = (v: boolean) => { setOn(v); dispatchEvent(new CustomEvent(EVENT, { detail: { handle, on: v } })); };
  const set = async (want: boolean) => {
    flip(want);
    setSaid('');
    const r: DiscoveryResult = await (want ? follow : unfollow)(handle).catch(() => ({ ok: false, reason: 'invalid' }) as const);
    if (!r.ok) { flip(!want); setSaid(FOLLOW.failed); return; }
    if (want && r.first) setSaid(FOLLOW.first(handle));
  };
  return (
    <>
      <form action={(on ? unfollowForm : followForm).bind(null, handle)} onSubmit={(e) => { e.preventDefault(); void set(!on); }} className="follow-form">
        <button type="submit" className="secondary follow" aria-pressed={on}>{on ? FOLLOW.following : FOLLOW.follow}</button>
      </form>
      <p aria-live="polite" className="follow-status small">{said}</p>
    </>
  );
}
