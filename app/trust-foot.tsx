'use client';
import { createContext, useContext, useLayoutEffect, useRef, useState } from 'react';
// @ts-expect-error react-dom ships no types here (no @types/react-dom, no new dependency); the one function, typed below
import { createPortal as untypedPortal } from 'react-dom';
import Link from 'next/link';
import { FOLLOW, TRUST_LINE } from '@/lib/copy.ts';
import { DISCLAIMER } from '@/lib/share.ts';
import { PROFILE_REPORT_COPY } from '@/lib/report-copy.ts';
import { MoreMenu } from './not-interested.tsx';

// F-16 (plan docs/features/logs/F-16-F-17/plan.md §2.1, §2.3, §5.4; v2 B1, B6, B7): the anti-impersonation line and the
// profile's quiet report menu. Plain text: no logo, names no platform, says nothing about identity.
// - Whether the line shows is decided on the server (lib/takedown.ts#impersonationLineShown reads the deploy's env), and
//   handed down as `shown`, or through <TrustShown> for a client island that has no server data (app/lazy-pane.tsx). A
//   client bundle can't read the server env, so without either the line shows only once the owner approved it.
// - inPane: the pane has no disclaimer of its own, so the line carries POLICY F3's line directly under it. On the profile
//   the line is the last thing in <main> and the site footer's disclaimer sits directly after it.
// No image route (opengraph-image, story, record or month cards) imports this file (lib/f16-static.test.ts).

const createPortal = untypedPortal as (children: React.ReactNode, container: Element) => React.ReactNode;

const Shown = createContext<boolean | null>(null);

/** The server's decision for the client islands below it (the profile's Similar sheets). */
export function TrustShown({ shown, children }: { shown: boolean; children: React.ReactNode }) {
  return <Shown.Provider value={shown}>{children}</Shown.Provider>;
}

// disclaimer=false: a sheet (app/suggest-row.tsx) whose own POLICY F3 line (.sheet-note) follows the pane directly.
export function TrustFoot({ inPane = false, shown, disclaimer = true }: { inPane?: boolean; shown?: boolean; disclaimer?: boolean }) {
  const ctx = useContext(Shown);
  if (!(shown ?? ctx ?? TRUST_LINE.approved)) return null;
  if (!inPane) return <p className="trust-foot" data-trust-line>{TRUST_LINE.text}</p>;
  return <PaneFoot disclaimer={disclaimer} />;
}

// Fix round 2 (T3): in a feed row the foot moves into the pane just before it (a portal, so app/pane.tsx is unchanged)
// and flows after the pane's content, scrolling with it: it never sits over the headline stats. The server render
// and a page without JavaScript keep it beside the pane, in its own grid row under it (app/globals.css), never over it.
// A sheet (app/suggest-row.tsx) scrolls as a whole already, so there it stays where it is.
function PaneFoot({ disclaimer }: { disclaimer: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const el = ref.current, prev = el?.previousElementSibling;
    if (el && prev instanceof HTMLElement && prev.matches('.pane') && el.parentElement?.matches('.feed > .row')) setHost(prev);
  }, []);
  const body = <>
    <p className="muted small" data-trust-line>{TRUST_LINE.text}</p>
    {disclaimer && <p className="muted small" data-trust-disclaimer>{DISCLAIMER}</p>}
  </>;
  if (host) return createPortal(<div className="trust-foot in-pane">{body}</div>, host);
  return <div className="trust-foot in-pane" ref={ref}>{body}</div>;
}

// B6: the quiet "…" menu with one item, shown signed out too (the report page then asks to sign in). Never in the
// header and never next to Follow or Share: the profile places it in its F-16 block at the end of <main>.
export function ProfileReportMenu({ handle }: { handle: string }) {
  return (
    <div className="profile-report">
      <MoreMenu label={FOLLOW.more(handle)}>
        <div className="menu-pop"><Link className="button secondary report-link" href={`/u/${encodeURIComponent(handle)}/report`}>{PROFILE_REPORT_COPY.menu}</Link></div>
      </MoreMenu>
    </div>
  );
}
