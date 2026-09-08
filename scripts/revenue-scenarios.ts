/**
 * What the move to three tiers does to monthly recurring revenue.
 *
 *   node scripts/revenue-scenarios.ts
 *
 * Assumes every one of the 78 in-network professionals currently pays the
 * "current" price for their band. Where that is not true, the baseline is
 * optimistic and the picture is better than it looks.
 */
import { BANDS, PRICING, TOTAL_IN_NETWORK, revenueIfAllOn } from '../src/pricing/catalog.ts';

const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US');
const pct = (n: number) => (n >= 0 ? '+' : '') + Math.round(n * 100) + '%';

const baseline = revenueIfAllOn('current');

console.log(`Network: ${TOTAL_IN_NETWORK} professionals\n`);
console.log('IF EVERY MEMBER LANDED ON ONE TIER');
for (const tier of ['current', 'standard', 'premium', 'platinum'] as const) {
  const mrr = revenueIfAllOn(tier);
  const delta = tier === 'current' ? '' : `   ${pct(mrr / baseline - 1)} vs today`;
  console.log(`  ${tier.padEnd(9)} ${money(mrr).padStart(9)}/mo  ${money(mrr * 12).padStart(10)}/yr${delta}`);
}

console.log('\nSHARE OF EACH BAND THAT MUST TAKE PLATINUM TO STAND STILL');
console.log('(the rest on Premium; the point at which the new model matches the old)');
let worst = { band: '', share: -1 };
for (const b of BANDS) {
  const p = PRICING[b];
  const share = (p.current - p.premium) / (p.platinum - p.premium);
  if (share > worst.share) worst = { band: p.label, share };
  const flag = share > 0.5 ? '  <-- more than half' : share < 0.05 ? '  <-- already neutral' : '';
  console.log(`  ${p.label.padEnd(30)} ${(share * 100).toFixed(0).padStart(3)}%${flag}`);
}
const overall = BANDS.reduce((s, b) => s + PRICING[b].inNetwork *
  ((PRICING[b].current - PRICING[b].premium) / (PRICING[b].platinum - PRICING[b].premium)), 0)
  / TOTAL_IN_NETWORK;
console.log(`  ${'WEIGHTED ACROSS THE NETWORK'.padEnd(30)} ${(overall * 100).toFixed(0).padStart(3)}%`);

console.log('\nTHE DOWNGRADE RISK');
console.log('Today the 78 have no cheaper option. Standard gives them one.');
for (const frac of [0.1, 0.25, 0.5]) {
  const n = Math.round(TOTAL_IN_NETWORK * frac);
  const lost = BANDS.reduce((s, b) =>
    s + (PRICING[b].current - PRICING[b].standard) * PRICING[b].inNetwork * frac, 0);
  console.log(`  if ${String(n).padStart(2)} of them (${(frac * 100).toFixed(0).padStart(2)}%) take Standard instead:` +
    ` ${money(lost).padStart(8)}/mo lost  (${money(lost * 12)}/yr)`);
}

console.log('\nWHAT STANDARD HAS TO DELIVER AS A GROWTH TIER');
const stdAvg = revenueIfAllOn('standard') / TOTAL_IN_NETWORK;
console.log(`  average Standard seat: ${money(stdAvg)}/mo`);
console.log(`  new Standard members needed to replace today's revenue on their own: ` +
  `${Math.ceil(baseline / stdAvg)}`);
console.log(`  ...to add 25% on top of today: ${Math.ceil((baseline * 0.25) / stdAvg)}`);
