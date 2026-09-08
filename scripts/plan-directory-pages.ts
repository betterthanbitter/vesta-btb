/**
 * What the directory would publish today, from the live Vesta data.
 *
 *   node scripts/plan-directory-pages.ts
 *
 * Run it again after a quarter of PAC.MP content exists and the answer
 * changes — which is the point.
 */
import { readFileSync } from 'node:fs';
import { buildPages, type DirectoryProfessional } from '../src/directory/pageModel.ts';
import type { PracticeCategory } from '../src/pricing/catalog.ts';

const read = (p: string) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));

const ROLLUP: Record<string, PracticeCategory> = {
  Legal: 'family-law', Mediation: 'family-law', 'Elder Law Attorney': 'family-law',
  Financial: 'financial-cdfa', 'Business Valuation': 'financial-cdfa',
  'College Planning': 'financial-cdfa', 'Forensic CPA': 'accounting-tax',
  'Estate Planning': 'accounting-tax', Realtor: 'real-estate',
  'Home Organization': 'real-estate', Mortgage: 'mortgage',
  'Divorce Coach': 'coaching-therapy', 'Life Coach': 'coaching-therapy',
  Therapist: 'coaching-therapy', 'Health & Wellness': 'coaching-therapy',
  'Parenting Coach': 'coaching-therapy', 'Parent Coordinator': 'coaching-therapy',
  'Career Coach': 'coaching-therapy', 'Business Coach': 'coaching-therapy',
};
const STATES: Record<string, string> = {
  massachusetts: 'MA', california: 'CA', califronia: 'CA', 'new york': 'NY',
  oklahoma: 'OK', maryland: 'MD', connecticut: 'CT',
};
const slug = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const terms: Record<string, string> = read('data/wpsl_terms.json');
const posts: any[] = read('data/wpsl_cats.json');
const geo = new Map<number, any>(read('data/wpsl_all.json').map((s: any) => [Number(s.id), s]));

/** Everyone is Standard until the tiers actually launch. */
const professionals: DirectoryProfessional[] = [];
for (const p of posts) {
  const g = geo.get(p.id);
  if (!g) continue;
  const cats = (p.wpsl_store_category ?? [])
    .map((t: number) => ROLLUP[terms[String(t)]])
    .filter(Boolean);
  if (!cats.length) continue;
  const state = STATES[(g.state ?? '').toLowerCase()] ?? (g.state ?? '').toUpperCase();
  professionals.push({
    id: String(p.id),
    hub: `${slug(g.city ?? '')}-${state.toLowerCase()}`,
    category: cats[0],
    tier: 'standard',
    contentCount: 0,
  });
}

function report(label: string, pros: DirectoryProfessional[]) {
  const pages = buildPages(pros, () => false);
  const pub = pages.filter((p) => p.state === 'publish');
  const thin = pages.filter((p) => p.state === 'thin');
  console.log(`\n${label}`);
  console.log(`  indexable pages: ${pub.length}   reachable-but-noindex: ${thin.length}` +
              `   never created: ${17 * 6 - pages.length}`);
  for (const p of pub) {
    console.log(`    PUBLISH  ${p.url.padEnd(34)} ${p.reason}`);
  }
}

console.log(`${professionals.length} findable professionals in the live directory.`);
report('TODAY — nobody has produced content yet', professionals);

// One quarter of PAC.MP: a webinar, a podcast appearance and 6 clips is well
// over the 3-item threshold for a single professional.
const withContent = professionals.map((p, i) =>
  i % 3 === 0 ? { ...p, tier: 'premium' as const, contentCount: 8 } : p);
report('AFTER ONE QUARTER — a third of them on PAC.MP', withContent);
