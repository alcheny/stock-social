import { ViewBeacon } from './view-beacon.tsx';

// F-15: mounts the view beacon on every page without editing app/layout.tsx (start condition: F-13 owns the layout until
// it merges). A fragment, so it adds no DOM node; the beacon renders nothing.
// ponytail: the beacon lives in the root template, which remounts when the first URL segment changes — fix: move
// <ViewBeacon /> into app/layout.tsx after F-13 merges (follow-up "F-15: beacon into the layout") and delete this file.
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ViewBeacon />
    </>
  );
}
