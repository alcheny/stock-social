import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { handleStatus, type HandleStatus } from '@/lib/visible-users.ts';
import { HIDDEN_NOTICE, HIDDEN_OWN, RETIRED_NOTICE } from '@/lib/copy.ts';
import { currentUser } from '@/lib/session.ts';
import GenericNotFound, { metadata as genericMetadata } from '../../not-found.tsx';

// F-16 / F-17 (plan docs/features/logs/F-16-F-17/plan.md §2.1, §11; Step 0 spike): the 404 for every notFound() under
// /u/<handle>/** (profile, trade, month, report). A hidden profile and a retired handle each get one neutral notice and
// their own title; anything else is the site's generic 404. Under notFound() Next 16.4.3 builds the head from the
// layouts and this module only (resolve-metadata.js collectMetadata), so the title is set here, never in a React
// <title>. This component gets no props, so the handle comes from proxy.ts's x-ss-path header; generateMetadata uses
// params when Next passes them and falls back to the same header.
// Next adds <meta name="robots" content="noindex"> on a 404 itself.

const handleFromPath = (path: string | null): string => /^\/u\/([^/]+)/.exec(path ?? '')?.[1] ?? '';

async function pathHandle(handle?: string): Promise<string | null> {
  const h = handle ?? handleFromPath((await headers()).get('x-ss-path'));
  try { return decodeURIComponent(h); } catch { return null; }
}

async function status(handle?: string): Promise<HandleStatus> {
  const h = await pathHandle(handle);
  return h === null ? 'none' : handleStatus(h);
}

const notice = (s: HandleStatus) => (s === 'hidden' ? HIDDEN_NOTICE : s === 'retired' ? RETIRED_NOTICE : null);

export async function generateMetadata(props: { params?: Promise<{ handle?: string }> }): Promise<Metadata> {
  const handle = props?.params ? (await props.params).handle : undefined;
  const n = notice(await status(handle));
  const title = n ? n.title : (genericMetadata.title as string);
  // No og:image or twitter image (plan §2.1): `images` set here stops Next adding the segment's opengraph-image file,
  // so a 404's link preview never points at a record card.
  return { ...genericMetadata, title, openGraph: { title, images: [] }, twitter: { images: [] } };
}

const tap = { display: 'inline-flex', alignItems: 'center', minHeight: 44 } as const;

// Q9 (plan §2.1, v2 B4): the hidden trader, signed in, also reads one private neutral line and a way to their settings
// (sign-in, settings and the data download still work for them). This 404 reads cookies and headers, so it is dynamic
// and Next sends it `private, no-cache, no-store` (e2e/f16-pages.spec.ts checks both the trader's and a signed-out
// response): a shared cache never hands the private line to anyone else.
async function isHiddenOwner(s: HandleStatus): Promise<boolean> {
  if (s !== 'hidden') return false;
  const me = await currentUser();
  return !!me && me.handle === (await pathHandle()); // handles are unique; hidden means the live row has it
}

export default async function HandleNotFound() {
  const s = await status();
  const n = notice(s);
  if (!n) return <GenericNotFound />;
  const own = await isHiddenOwner(s);
  return (
    <main className="page">
      <h1>{n.h1}</h1>
      <p>{n.line}</p>
      {own && <p className="muted" data-own-line>{HIDDEN_OWN.line} <Link className="tap44" href="/settings">{HIDDEN_OWN.settings}</Link></p>}
      <p style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <Link href="/" style={tap}>Back to the feed</Link>
        <Link href="/t" style={tap}>All stocks</Link>
      </p>
    </main>
  );
}
