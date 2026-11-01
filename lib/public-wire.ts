// F-23 · Public payloads carry no more precision than the screens show (docs/features/F-23-public-payload-precision.md;
// committee record docs/features/logs/F-23/committee-2026-11-01.md). The one home of the wire rounding: every public
// JSON body and every client prop that carries a return, a stat, a hold time or a date goes through these helpers at
// the moment it is serialised. Nothing stored changes, and every figure (stats, intervals, ranks, chart totals) is still
// computed on stored values before it reaches here.
import { pct, tone } from './format.ts';

const DAY = 86_400_000;

// The screens print a return with pct() at 1 decimal (figures, rows, the chart header) and at 0 decimals (the chart's
// accessible name); near -100% pct() prints up to 4 more digits; the tone follows the printed sign. A wire return is a
// value chosen from the prints alone, so it says nothing the screen does not:
// - the 1-decimal percent (12.3456% → 0.123);
// - when that would move the 0-decimal print (|x| in [n.45%, n.5%): "+3.5%" and "+3%", but 3.5% prints "+4%"), the
//   1-decimal percent 0.04 nearer zero (0.0346): it prints both as shown, whatever the stored digits were; and where
//   the 1-decimal literal itself misprints by float error (1.035 * 100 is 103.49999999999999, "+103%" not "+104%"),
//   0.04 further from zero (1.0354);
// - a value pct() prints as "≈-100%" at both lengths: one fixed stand-in (-0.99999999);
// - otherwise (the extra digits near -100% that pct() prints) the shortest decimal that prints as stored.
// Written as a short decimal literal, so the JSON never carries float noise (12.3 / 100 is 0.12300000000000001;
// Number('12.3e-2') is 0.123).
const prints = (v: number) => `${pct(v, 0)}|${pct(v, 1)}|${tone(v, 0)}|${tone(v, 1)}`;
const NEAR_TOTAL_LOSS = -0.99999999;
export function wirePct(v: number): number {
  if (!Number.isFinite(v)) return v;
  const want = prints(v);
  const ok = (s: string) => { const r = Number(`${s}e-2`); return prints(r) === want ? (r === 0 ? 0 : r) : null; }; // never -0
  const p = v * 100, s1 = p.toFixed(1);
  const n1 = Number(s1), away = (k: number) => (n1 + Math.sign(n1) * k).toFixed(2);
  const first = ok(s1) ?? ok(away(-0.04)) ?? ok(away(0.04));
  if (first !== null) return first;
  if (prints(NEAR_TOTAL_LOSS) === want) return NEAR_TOTAL_LOSS;
  // The extra digits pct() prints near -100% (code review 3): the printed number itself, its neighbours in the last
  // printed digit, then one more digit (5): never the stored digits beyond what the screen shows.
  for (const shown of [pct(v, 1), pct(v, 0)]) {
    const m = /^-?\d+\.(\d+)%$/.exec(shown);
    if (!m) continue;
    const d = m[1].length, n = Number(shown.slice(0, -1)), u = 10 ** -d;
    const r = ok(n.toFixed(d)) ?? ok((n - u).toFixed(d)) ?? ok((n + u).toFixed(d)) ?? ok(`${n.toFixed(d)}5`) ?? ok(`${(n + u).toFixed(d)}5`) ?? ok(`${(n - u).toFixed(d)}5`);
    if (r !== null) return r;
  }
  for (let d = 2; d <= 8; d++) {
    const r = ok(p.toFixed(d)) ?? ok((Math.trunc(p * 10 ** d) / 10 ** d).toFixed(d));
    if (r !== null) return r;
  }
  // ponytail: a value no 8-decimal percent prints like (none known: pct() prints at most 5 decimals) is sent as stored
  // — lib/f23-public-wire.test.ts sweeps the -100% edge and every boundary; widen d if one is ever found.
  return v;
}

// Hold days print toFixed(1) ("Held 2.3 days"); one decimal at most goes out (the same string, so the same text).
export const wireHold = (h: number): number => (Number.isFinite(h) ? Number(h.toFixed(1)) : h);

// A win rate prints as a whole percent ((winRate * 100).toFixed(0)): the printed whole percent, as a fraction.
export const wireRate = (r: number): number => (Number.isFinite(r) ? Number(`${(r * 100).toFixed(0)}e-2`) : r);

// Dates go out as UTC days: whole days since 1970-01-01 (a 5-digit number, never a 13-digit epoch), or 'YYYY-MM-DD'.
// The client prints them in UTC (numericDay, lib/date-text.ts#dateText), so every zone reads the same day the server
// rendered.
export const wireDay = (d: Date | number): number => Math.floor((typeof d === 'number' ? d : d.getTime()) / DAY);
export const isoDay = (d: Date | number): string => new Date(wireDay(d) * DAY).toISOString().slice(0, 10);
// The numeric date the pane rows and the chart's scrub line print ("10/30/2026", as toLocaleDateString('en-US') did),
// in UTC: the same text on the server and in any browser zone.
const NUMERIC = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC' });
export const numericDay = (d: Date | number): string => NUMERIC.format(d);
// `now` for a client component: the start of today's UTC day (the chart reads only its UTC year and day from it).
export const wireToday = (now: Date = new Date()): Date => new Date(wireDay(now) * DAY);
// A relative time's instant ("2 hours ago": the line prints hours), truncated to its UTC hour: 'YYYY-MM-DDTHH:00Z'.
export const isoHour = (d: Date | number): string => `${new Date(Math.floor(+d / 3_600_000) * 3_600_000).toISOString().slice(0, 13)}:00Z`;
