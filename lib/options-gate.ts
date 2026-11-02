// OPTIONS (docs/features/logs/options/plan.md D5): the consent gate. Option returns and contract terms (call/put,
// expiry) are public only when the owner's consent scope line names every option column (derived from PUBLIC_FIELDS,
// no env var or flag) AND the trader consented under such a line. Pure: the per-trader read lives in the one reader,
// lib/options-load.ts#traderOptionsPublic. Until the owner amends the line, every column below sits in GATED_COLUMNS
// (lib/privacy-fields.ts) and every trader is gated.
import { PUBLIC_FIELDS, type Field } from './privacy-fields.ts';
import { versionFor } from './consent-versions.ts';
import { OPTION_PUBLIC_COLUMNS, optionColumnsPublic } from './gate-key.ts'; // F-29

// F-29 (plan D3): the column list and the global check live in lib/gate-key.ts (client-safe), re-exported here.
export { OPTION_PUBLIC_COLUMNS } from './gate-key.ts';

/** Global half: every option column is in a public field of the scope line. */
export function optionsPublic(fields: readonly Field[] = PUBLIC_FIELDS): boolean {
  return optionColumnsPublic(fields);
}

/** Per-trader half: the consent this hash records named every option column. Unknown or null hashes (every consent
 *  before this column existed) are false. */
export function consentCoversOptions(hash: string | null | undefined): boolean {
  const v = versionFor(hash);
  return !!v && OPTION_PUBLIC_COLUMNS.every((c) => v.publicColumns.includes(c));
}
