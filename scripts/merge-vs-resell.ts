/**
 * Two ways to reach the same 78 professionals.
 *
 *   node scripts/merge-vs-resell.ts
 *
 * Path A — sign Vesta as a reseller partner. BTB sells PAC.MP/CCMP through
 *          them, pays the partner terms from btbaffiliate.netlify.app, and
 *          acquires nothing.
 * Path B — merge. BTB owns the directory revenue and the cost base with it.
 *
 * Assumptions are all named and all editable.
 */
import { BANDS, PRICING, TOTAL_IN_NETWORK, revenueIfAllOn } from '../src/pricing/catalog.ts';

/** PAC.MP / CCMP monthly price by band, from the affiliate sales sheet. */
const CONTENT_PRICE: Record<string, number> = {
  attorneys: 295,
  'cdfa-mediators': 195,
  'lending-realty-accounting': 99,
  'divorce-coaches': 249,
  'therapists-wellness-other': 99,
};

const ASSUMPTIONS = {
  /** Share of the 78 who buy the content programme at all. */
  attachRate: 1.0,
  /** Merger model's blended production cost per enrolled professional. */
  contentCostPerPro: 65,
  /** Vesta's annual cost base, from the merger model. */
  vestaAnnualCosts: 220_000,
  /** Reseller terms: first month as signing bonus, then this share for life. */
  resellerOngoingShare: 0.10,
};

const money = (n: number) => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');

const contentMrr = BANDS.reduce(
  (s, b) => s + CONTENT_PRICE[b] * PRICING[b].inNetwork * ASSUMPTIONS.attachRate, 0);
const enrolled = TOTAL_IN_NETWORK * ASSUMPTIONS.attachRate;
const contentCost = enrolled * ASSUMPTIONS.contentCostPerPro;

console.log(`${TOTAL_IN_NETWORK} professionals; ${Math.round(enrolled)} take the content programme\n`);

console.log('PATH A — Vesta as a reseller partner, no merger');
const partnerCut = contentMrr * ASSUMPTIONS.resellerOngoingShare;
const aNet = contentMrr - partnerCut - contentCost;
console.log(`  content revenue                 ${money(contentMrr).padStart(9)}/mo`);
console.log(`  less partner's 10% for life     ${money(-partnerCut).padStart(9)}/mo`);
console.log(`  less production cost            ${money(-contentCost).padStart(9)}/mo`);
console.log(`  NET TO BTB                      ${money(aNet).padStart(9)}/mo   ${money(aNet * 12)}/yr`);
console.log(`  one-off: partner keeps month 1  ${money(-contentMrr).padStart(9)}`);
console.log('  acquires: nothing. no cost base, no employees, no directory.');
console.log('  repeatable: yes — the same programme points at any network.\n');

console.log('PATH B — merge');
const directory = revenueIfAllOn('platinum'); // Platinum = current + content
const vestaCosts = ASSUMPTIONS.vestaAnnualCosts / 12;
const bNet = directory - vestaCosts - contentCost;
console.log(`  all-Platinum directory revenue  ${money(directory).padStart(9)}/mo`);
console.log(`    (Platinum already contains the content price)`);
console.log(`  less Vesta's cost base          ${money(-vestaCosts).padStart(9)}/mo`);
console.log(`  less production cost            ${money(-contentCost).padStart(9)}/mo`);
console.log(`  NET TO BTB                      ${money(bNet).padStart(9)}/mo   ${money(bNet * 12)}/yr`);
console.log('  acquires: 78 warm professionals, a concierge team, two operators,');
console.log('            a directory — and a $220K annual cost base.');
console.log('  plus: an acquisition price, not modelled here.\n');

console.log(`DIFFERENCE  ${money(bNet - aNet)}/mo  (${money((bNet - aNet) * 12)}/yr) in favour of merging`);
console.log(`Break-even downside: if only half take Platinum and the rest Premium,`);
const halfMix = (revenueIfAllOn('platinum') + revenueIfAllOn('premium')) / 2;
const bHalf = halfMix - vestaCosts - contentCost;
console.log(`  Path B nets ${money(bHalf)}/mo — ${bHalf < aNet ? 'WORSE' : 'still better'} than Path A.`);

// The crossover: what share of the network must take Platinum before merging
// beats simply reselling? Everything else held at the assumptions above.
const allPlatinum = revenueIfAllOn('platinum');
const allPremium = revenueIfAllOn('premium');
const needed = (aNet + vestaCosts + contentCost - allPremium) / (allPlatinum - allPremium);
console.log(`\nCROSSOVER`);
console.log(`  Merging beats reselling once ${(needed * 100).toFixed(0)}% of the network takes Platinum.`);
console.log(`  Below that, the reseller deal earns more and risks less.`);
console.log(`  (${Math.ceil(needed * TOTAL_IN_NETWORK)} of ${TOTAL_IN_NETWORK} professionals.)`);
