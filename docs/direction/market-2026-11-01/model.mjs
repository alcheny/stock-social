import fs from 'node:fs';
const A = JSON.parse(fs.readFileSync(new URL('./projection-assumptions.json', import.meta.url)));
const S = ['conservative','base','strong'];
const get = s => Object.fromEntries(A.map(a=>[a.key,a[s]]));
const arpu = p => ((1-p.annual_share)*p.price_monthly + p.annual_share*p.price_annual/12)*(1-p.billing_pct);
const varPerViewer = p => p.trader_share*p.broker_per_trader + p.hosting_per_1k/1000;
const fixed = p => p.broker_floor + p.platform_fixed;
const profit = (p,V) => V*p.conv*arpu(p) - (V*varPerViewer(p)+fixed(p));
const be = (p,V) => (V*varPerViewer(p)+fixed(p))/(V*arpu(p));
const beViewers = p => { const m = p.conv*arpu(p)-varPerViewer(p); return m>0? fixed(p)/m : Infinity; };
const f = (x,d=2)=>x.toFixed(d);
console.log('## ARPU, break-even');
for (const s of S){ const p=get(s);
  console.log(s, 'netARPU', f(arpu(p)), 'var/viewer', f(varPerViewer(p),4), 'fixed', fixed(p),
   'BE conv @', [1e3,1e4,5e4,1e5,1e6].map(V=>`${V}:${f(be(p,V)*100)}%`).join(' '),
   'limit', f(varPerViewer(p)/arpu(p)*100)+'%', 'profit@1k', f(profit(p,1e3)), '@10k', f(profit(p,1e4)), '@100k', f(profit(p,1e5)),
   'BE viewers at own conv', isFinite(beViewers(p))?Math.round(beViewers(p)):'never');
  console.log('  per payer: trader cost/payer/mo', f(p.trader_share/p.conv*p.broker_per_trader), 'traders per payer', f(p.trader_share/p.conv,1));
}
// mixed: base everything, conv varied
// tornado on BE conv at 1k and 100k, base, swing each input to cons/strong
console.log('## Tornado (base, swing each input to conservative/strong)');
for (const V of [1e3,1e5]) {
  const b=get('base'); const base=be(b,V); const rows=[];
  for (const a of A){ if(a.key==='conv')continue; const lo={...b,[a.key]:a.conservative}, hi={...b,[a.key]:a.strong};
    rows.push([a.key, be(lo,V)*100, be(hi,V)*100]); }
  rows.sort((x,y)=>Math.abs(y[1]-y[2])-Math.abs(x[1]-x[2]));
  console.log(`V=${V} base BE ${f(base*100)}%`); rows.forEach(r=>console.log(`  ${r[0]}: cons ${f(r[1])}% strong ${f(r[2])}% swing ${f(Math.abs(r[1]-r[2]))}pp`));
  // profit tornado including conv
  const rp=[]; for (const a of A){ const lo={...b,[a.key]:a.conservative}, hi={...b,[a.key]:a.strong}; rp.push([a.key,profit(lo,V),profit(hi,V)]);}
  rp.sort((x,y)=>Math.abs(y[1]-y[2])-Math.abs(x[1]-x[2]));
  console.log(`  profit/mo base ${f(profit(b,V))}`); rp.slice(0,6).forEach(r=>console.log(`   ${r[0]}: ${f(r[1])} .. ${f(r[2])}`));
}
// ratio threshold: trader_share/conv break-even
console.log('## break-even traders per payer (scale limit, base other inputs):', f((arpu(get('base'))-0.004/0.015)/1,2),'USD margin -> traders/payer at $1 =', f(arpu(get('base'))-get('base').hosting_per_1k/1000/get('base').conv,2));
// LTV & CAC
console.log('## LTV / CAC');
for (const s of S){ const p=get(s);
  const mNet = p.price_monthly*(1-(0.029+0.007+0.005)) - 0.30;
  const aNet = p.price_annual*(1-(0.029+0.007+0.005)) - 0.30;
  const lifeM = 1/p.churn_monthly; const ltvM = mNet*lifeM;
  const lifeYrs = 1/(1-p.annual_renewal); const ltvA = aNet*lifeYrs;
  const ltvBlend = (1-p.annual_share)*ltvM + p.annual_share*ltvA;
  const lifeBlendMonths = (1-p.annual_share)*lifeM + p.annual_share*12*lifeYrs;
  // contribution: allocate trader+hosting variable cost per payer
  const allocPerPayerMo = varPerViewer(p)/p.conv;
  const contribMo = arpu(p) - allocPerPayerMo;
  const ltvContrib = contribMo*lifeBlendMonths;
  const cacBlended = p.cac_paying*p.paid_share;
  console.log(s, {mNet:f(mNet), aNet:f(aNet), lifeM:f(lifeM,1), lifeYrs:f(lifeYrs,2), ltvM:f(ltvM), ltvA:f(ltvA), ltvBlend:f(ltvBlend), lifeBlendMonths:f(lifeBlendMonths,1),
    allocPerPayerMo:f(allocPerPayerMo), contribMo:f(contribMo), ltvContrib:f(ltvContrib), cacPaid:p.cac_paying, cacBlended:f(cacBlended),
    paybackPaidRevMonths:f(p.cac_paying/arpu(p),1), paybackPaidContribMonths: contribMo>0?f(p.cac_paying/contribMo,1):'never',
    paybackBlendedContrib: contribMo>0?f(cacBlended/contribMo,1):'never', ltvRevToCacPaid:f(ltvBlend/p.cac_paying), ltvContribToCacPaid:f(ltvContrib/p.cac_paying), ltvContribToCacBlend:f(ltvContrib/cacBlended)});
}
// implied monthly churn from 17% 12-mo retention
console.log('implied monthly churn from 17% 1y retention:', f((1-Math.pow(0.17,1/12))*100,1)+'%', 'from 44.1% yearly ->', f((1-0.441)*100,1)+'% annual churn');
// billing fee check
for (const pr of [9.99,99.99]) console.log('fee% at', pr, f(((pr*0.041)+0.30)/pr*100,2)+'%');
