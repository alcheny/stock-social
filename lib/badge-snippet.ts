export type Format = 'markdown' | 'html';

// The link carries ref + via so a signup from an embedded badge is attributed to it.
export function snippet(format: Format, origin: string, handle: string, verified = true): string {
  const profile = `${origin}/u/${handle}`;
  const link = `${profile}?ref=${handle}&via=badge`;
  const img = `${profile}/badge.svg`;
  const alt = verified ? 'Stock Social record, imported read-only from the broker' : 'Stock Social badge';
  return format === 'markdown'
    ? `[![${alt}](${img})](${link})`
    : `<a href="${link}"><img src="${img}" alt="${alt}" width="240" height="56"></a>`;
}
