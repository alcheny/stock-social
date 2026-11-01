import type { Metadata } from 'next';
import Link from 'next/link';
import { PUBLIC } from '@/lib/copy.ts';

// F-7 (legal C12): what public filing records are, where they come from, what is excluded, that the person has not
// joined, and how to ask for a correction or removal. Reachable with the switch off; names no filer. The contact is a
// deploy setting (PUBLIC_RECORDS_CONTACT), never committed; unset, requests open before launch. Promises a review and a
// reply only, never an outcome or a time.
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: `${PUBLIC.page.title} · Stock Social` };

export default function PublicRecords() {
  const contact = process.env.PUBLIC_RECORDS_CONTACT?.trim();
  return (
    <main className="page how">
      <h1>{PUBLIC.page.title}</h1>
      {PUBLIC.page.lines.map((l) => <p key={l}>{l}</p>)}
      <h2 id="ask">{PUBLIC.page.askTitle}</h2>
      <p>{PUBLIC.page.ask}</p>
      <p data-contact>{contact ? (contact.includes('@') ? <a className="tap44" href={`mailto:${contact}`}>{contact}</a> : contact) : PUBLIC.page.unset}</p>
      <p><Link className="tap44" href="/how#public-filings">{PUBLIC.how.title}</Link></p>
    </main>
  );
}
