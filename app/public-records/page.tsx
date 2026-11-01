import type { Metadata } from 'next';
import Link from 'next/link';
import { PUBLIC } from '@/lib/copy.ts';

// F-7 (legal C12): what public filing records are, their source, what is excluded, that the person has not joined, how to ask for a correction
// or removal. Reachable with the switch off; names no filer. Contact: PUBLIC_RECORDS_CONTACT (deploy setting, never committed). A review and reply only.
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: `${PUBLIC.page.title} · Stock Social`, description: PUBLIC.page.description };

export default function PublicRecords() {
  const contact = process.env.PUBLIC_RECORDS_CONTACT?.trim();
  return (
    <main className="page how">
      <h1>{PUBLIC.page.title}</h1>
      {PUBLIC.page.lines.map((l) => <p key={l}>{l}</p>)}
      <h2 id="ask">{PUBLIC.page.askTitle}</h2><p>{PUBLIC.page.ask}</p>
      <p data-contact>{contact ? (contact.includes('@') ? <a className="tap44" href={`mailto:${contact}`}>{contact}</a> : contact) : PUBLIC.page.unset}</p>
      <p><Link className="tap44" href="/how#public-filings">{PUBLIC.how.title}</Link></p>
    </main>
  );
}
