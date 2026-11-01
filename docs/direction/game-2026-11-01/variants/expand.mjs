// F-8 council, stages 1b and 2a: expand 1,000 agent-written seeds to 10,000 variants by deterministic
// mutation and crossover, then score all 10,000 with the panel's option weights and flags and keep a
// diverse top 500. Deterministic (seeded PRNG) so anyone can re-run it and get the same files.
import fs from 'node:fs';
import zlib from 'node:zlib';
// Re-run from the repo root: node docs/direction/game-2026-11-01/variants/expand.mjs <this dir> <out dir>
// (reads weights-stage2a.json and seeds-<ANGLE>.jsonl from the first dir; writes to the second).
const D = process.argv[2];
const OUT = process.argv[3];
const W = JSON.parse(fs.readFileSync(`${D}/weights-stage2a.json`, 'utf8'));
const ENUMS = ['format', 'data', 'input', 'scoring', 'progression', 'social', 'cadence'];
const ANGLES = ['RG', 'PR', 'CA', 'DP', 'HH', 'LS', 'PS', 'SC', 'SO', 'WC'];
const seeds = [];
// seeds-<ANGLE>.jsonl already carry origin 'seed'; the spread below keeps the field order stable.
for (const a of ANGLES) for (const l of fs.readFileSync(`${D}/seeds-${a}.jsonl`, 'utf8').trim().split('\n')) seeds.push({ origin: 'seed', ...JSON.parse(l) });
let s = 20261101; const rnd = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; // mulberry32
const pick = (xs) => xs[Math.floor(rnd() * xs.length)];
const opts = Object.fromEntries(ENUMS.map((f) => [f, Object.keys(W.options[f] ?? {})]));
const byId = new Map(seeds.map((x) => [x.id, x]));
const seen = new Set(seeds.map((x) => ENUMS.map((f) => x[f]).join('|') + x.loop));
const mutants = [];
let n = 0;
while (seeds.length + mutants.length < 10000) {
  const r = rnd(); const A = pick(seeds); let m;
  if (r < 0.4) { // point mutation: 1-2 enum fields, or session length
    m = { ...A, origin: 'mutation', parents: [A.id], changed: [] };
    const k = 1 + Math.floor(rnd() * 2);
    for (let i = 0; i < k; i++) { const f = pick([...ENUMS, 'session_s']);
      if (f === 'session_s') m.session_s = pick([60, 90, 120, 150, 180, 240, 300, 420]); else m[f] = pick(opts[f]);
      m.changed.push(f); }
  } else if (r < 0.8) { // crossover: A's loop and text, enum fields mixed with B's
    const B = pick(seeds); m = { ...A, origin: 'crossover', parents: [A.id, B.id], changed: [] };
    for (const f of [...ENUMS, 'session_s']) if (rnd() < 0.5) { m[f] = B[f]; m.changed.push(f); }
    m.name = `${A.name} / ${B.name}`; m.hook = `${A.hook} | ${B.hook}`; m.risk = `${A.risk} | ${B.risk}`;
  } else { // splice: A's format and loop with B's scoring/progression/social stack
    const B = pick(seeds); m = { ...A, origin: 'splice', parents: [A.id, B.id], changed: ['scoring', 'progression', 'social'] };
    m.scoring = B.scoring; m.progression = B.progression; m.social = B.social;
    m.name = `${A.name} + ${B.name} meta`; m.loop = `${A.loop} Meta from ${B.id}: ${B.loop}`.slice(0, 400); m.risk = `${A.risk} | ${B.risk}`;
  }
  const key = ENUMS.map((f) => m[f]).join('|') + m.loop;
  if (seen.has(key)) continue; seen.add(key);
  m.id = `M-${String(++n).padStart(4, '0')}`; mutants.push(m);
}
const all = [...seeds, ...mutants];
const crit = Object.keys(W.criteria_weights);
const flags = W.flags.map((f) => ({ ...f, re: new RegExp(f.pattern, 'i') }));
const sessPts = W.session_s.slice().sort((a, b) => a[0] - b[0]);
const sessScore = (t) => { if (t <= sessPts[0][0]) return sessPts[0][1]; for (let i = 1; i < sessPts.length; i++) if (t <= sessPts[i][0]) {
  const [a, sa] = sessPts[i - 1], [b, sb] = sessPts[i]; return sa + (sb - sa) * (t - a) / (b - a); } return sessPts.at(-1)[1]; };
const vetoed = (v) => W.veto.find((x) => (x.combo ? Object.entries(x.combo).every(([f, o]) => v[f] === o) : v[x.field] === x.option));
const scored = all.map((v) => {
  const c = {};
  for (const k of crit) { let t = 0, m = 0; for (const f of ENUMS) { const o = W.options[f]?.[v[f]]; if (o && o[k] != null) { t += o[k]; m++; } } c[k] = m ? t / m : 5; }
  c.ergonomics = (c.ergonomics * 3 + sessScore(v.session_s)) / 4;
  const text = `${v.name} ${v.loop} ${v.hook} ${v.risk}`; const hits = [];
  for (const f of flags) if (f.re.test(text) && c[f.criterion] != null) { c[f.criterion] = Math.max(0, Math.min(10, c[f.criterion] + f.delta)); hits.push(f.pattern); }
  const veto = vetoed(v);
  const total = veto ? 0 : crit.reduce((a, k) => a + W.criteria_weights[k] * c[k], 0) * (c.policy_safety < 4 ? 0.5 : 1);
  return { id: v.id, total: +total.toFixed(3), ...Object.fromEntries(crit.map((k) => [k, +c[k].toFixed(2)])), veto: veto ? (veto.why ?? true) : undefined, flags: hits.length ? hits : undefined };
});
const rank = scored.filter((x) => !x.veto).sort((a, b) => b.total - a.total);
const byAll = new Map(all.map((v) => [v.id, v]));
const cluster = new Map(); const top = [];
for (const r of rank) { const v = byAll.get(r.id); const k = `${v.format}|${v.data}|${v.scoring}`; const c = cluster.get(k) ?? 0;
  if (c >= 8) continue; cluster.set(k, c + 1); top.push({ ...v, score: r }); if (top.length === 500) break; }
fs.mkdirSync(OUT, { recursive: true });
for (const a of ANGLES) fs.writeFileSync(`${OUT}/seeds-${a}.jsonl`, seeds.filter((x) => x.id.startsWith(a + '-')).map((x) => JSON.stringify(x)).join('\n') + '\n');
fs.writeFileSync(`${OUT}/mutants.jsonl.gz`, zlib.gzipSync(mutants.map((x) => JSON.stringify({ id: x.id, origin: x.origin, parents: x.parents, set: Object.fromEntries(x.changed.map((f) => [f, x[f]])) })).join('\n') + '\n', { level: 9 }));
fs.writeFileSync(`${OUT}/scores-stage2a.jsonl.gz`, zlib.gzipSync(scored.map((x) => JSON.stringify(x)).join('\n') + '\n', { level: 9 }));
fs.writeFileSync(`${D}/top500.jsonl`, top.map((x) => JSON.stringify(x)).join('\n') + '\n');
const stat = { seeds: seeds.length, mutants: mutants.length, total: all.length, vetoed: scored.filter((x) => x.veto).length,
  top500_by_angle: Object.fromEntries(ANGLES.map((a) => [a, top.filter((x) => (x.parents?.[0] ?? x.id).startsWith(a + '-')).length])),
  top500_by_origin: top.reduce((o, x) => ((o[x.origin] = (o[x.origin] ?? 0) + 1), o), {}),
  top500_by_format: top.reduce((o, x) => ((o[x.format] = (o[x.format] ?? 0) + 1), o), {}),
  cutoff_500: top.at(-1)?.score.total, best: top[0]?.score.total, median_all: rank[Math.floor(rank.length / 2)]?.total };
fs.writeFileSync(`${D}/stage2a-stats.json`, JSON.stringify(stat, null, 1));
console.log(JSON.stringify(stat));
