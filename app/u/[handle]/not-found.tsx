import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { handleStatus, type HandleStatus } from '@/lib/visible-users.ts';
import { HIDDEN_NOTICE, RETIRED_NOTICE } from '@/lib/copy.ts';
import GenericNotFound, { metadata as genericMetadata } from '../../not-found.tsx';

// F-16 / F-17 (plan docs/features/logs/F-16-F-17/plan.md §2.1, §11; Step 0 spike): the 404 for every notFound() under
// /u/<handle>/** (profile, trade, month, report). A hidden profile and a retired handle each get one neutral notice and
// their own title; anything else is the site's generic 404. Under notFound() Next 16.4.3 builds the head from the
// layouts and this module only (resolve-metadata.js collectMetadata), so the title is set here, never in a React
// <title>. This component gets no props, so the handle comes from proxy.ts's x-ss-path header; generateMetadata uses
// params when Next passes them and falls back to the same header.
// Next adds <meta name="robots" content="noindex"> on a 404 itself.

const handleFromPath = (path: string | null): string => /^\/u\/([^/]+)/.exec(path ?? '')?.[1] ?? '';

async function status(handle?: string): Promise<HandleStatus> {
  const h = handle ?? handleFromPath((await headers()).get('x-ss-path'));
  let decoded = h;
  try { decoded = decodeURIComponent(h); } catch { return 'none'; }
  return handleStatus(decoded);
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

export default async function HandleNotFound() {
  const n = notice(await status());
  if (!n) return <GenericNotFound />;
  return (
    <main className="page">
      <h1>{n.h1}</h1>
      <p>{n.line}</p>
      <p style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <Link href="/" style={tap}>Back to the feed</Link>
        <Link href="/t" style={tap}>All stocks</Link>
      </p>
    </main>
  );
}
