// F-36 fixture audit, the module hook (test-only; loaded by scripts/f36-audit.ts through NODE_OPTIONS=--import, never by
// the app). It rewrites the `returnPct:` line of lib/trades.ts in memory, in each test process, so the matcher on disk
// stays the one production runs:
// - F36_AUDIT_MODE=log: the figure is the shipped one (purchase cost plus purchase fees); every trade whose legacy figure
//   (purchase cost alone) differs is appended to F36_AUDIT_LOG with its test file, symbol, sell id, both percents and
//   whether it had an entry fee (yes/no, never an amount).
// - F36_AUDIT_MODE=legacy: the figure is the legacy one, so the tests that fail are the expectations F-36 changed.
// Every process that loads lib/trades.ts writes one `hook-loaded` line, so the audit proves the hook ran; the anchor must
// match exactly once, or loading lib/trades.ts throws (a changed line can't pass the audit silently).
import { appendFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ANCHOR = 'returnPct: (a.units * a.price - cost - entryFees - exitFee) / (cost + entryFees),';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TRADES = new URL('../lib/trades.ts', import.meta.url).href;

/** The audited source: the anchor replaced by a call that computes both figures (exported for scripts/f36-audit.test.ts). */
export function instrument(src: string, mode: string): string {
  const parts = src.split(ANCHOR);
  if (parts.length !== 2) throw new Error(`f36 audit: the returnPct anchor occurs ${parts.length - 1} times in lib/trades.ts (expected once)`);
  const fn = `function __f36(n: number, cost: number, fees: number, a: { symbol: string; externalId: string }): number {
  const legacy = n / cost, now = n / (cost + fees);
  if (legacy !== now) globalThis.__f36Log?.(a.symbol, a.externalId, legacy, now, fees > 0);
  return ${mode === 'legacy' ? 'legacy' : 'now'};
}`;
  return `${parts[0]}returnPct: __f36(a.units * a.price - cost - entryFees - exitFee, cost, entryFees, a),${parts[1]}\n${fn}\n`;
}

const log = process.env.F36_AUDIT_LOG;
const mode = process.env.F36_AUDIT_MODE ?? 'log';
const file = process.argv[1] ? relative(ROOT, process.argv[1]) : '?';
const pctOf = (x: number) => `${(x * 100).toFixed(4)}%`;
if (log) {
  (globalThis as { __f36Log?: unknown }).__f36Log = (symbol: string, id: string, legacy: number, now: number, fee: boolean) => {
    if (mode === 'log') appendFileSync(log, `f36-changed ${file} ${symbol} ${id} legacy=${pctOf(legacy)} now=${pctOf(now)} entryFee=${fee ? 'yes' : 'no'}\n`);
  };
  registerHooks({
    load(url, ctx, next) {
      const r = next(url, ctx);
      if (url !== TRADES) return r;
      appendFileSync(log, `hook-loaded ${file}\n`);
      return { ...r, source: instrument(String(r.source), mode) };
    },
  });
}
