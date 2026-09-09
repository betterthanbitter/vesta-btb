import { PRICING, type PricingBand } from '../pricing/catalog.ts';

/**
 * What a professional is choosing between, and what it costs them.
 *
 * Price depends on profession, so the application shows real numbers once a
 * profession is picked rather than "from $29". A professional deciding between
 * levels should not have to work out which band they are in.
 */

export const PROFESSIONS = [
  'Attorney',
  'Mediator',
  'CDFA',
  'Accountant',
  'Realtor',
  'Lending Professional',
  'Divorce Coach',
  'Therapist',
  'Career Coach',
  'Other professional service',
] as const;

export type Profession = (typeof PROFESSIONS)[number];

/** Profession → what they pay. */
export const PROFESSION_BAND: Record<Profession, PricingBand> = {
  'Attorney': 'attorneys',
  'Mediator': 'cdfa-mediators',
  'CDFA': 'cdfa-mediators',
  'Accountant': 'lending-realty-accounting',
  'Realtor': 'lending-realty-accounting',
  'Lending Professional': 'lending-realty-accounting',
  'Career Coach': 'lending-realty-accounting',
  'Divorce Coach': 'divorce-coaches',
  'Therapist': 'therapists-wellness-other',
  'Other professional service': 'therapists-wellness-other',
};

/** Profession → the category a consumer browses. */
export const PROFESSION_CATEGORY: Record<Profession, string> = {
  'Attorney': 'family-law',
  'Mediator': 'family-law',
  'CDFA': 'financial-cdfa',
  'Accountant': 'accounting-tax',
  'Realtor': 'real-estate',
  'Lending Professional': 'mortgage',
  'Divorce Coach': 'coaching-therapy',
  'Therapist': 'coaching-therapy',
  'Career Coach': 'coaching-therapy',
  'Other professional service': 'coaching-therapy',
};

export type TierKey = 'standard' | 'premium' | 'platinum';

export interface TierSummary {
  key: TierKey;
  name: string;
  tagline: string;
  /** Written as things a professional gets, not features of a product. */
  includes: string[];
  /** Said plainly, so nobody signs up expecting what is not there. */
  notIncluded?: string[];
  scarcity?: string;
}

export const TIER_SUMMARIES: TierSummary[] = [
  {
    key: 'standard',
    name: 'Standard',
    tagline: 'Be findable.',
    includes: [
      'Your listing in the Vesta directory — name, credentials, firm, photo and contact',
      'Your own booking link on your listing, so people can schedule with you directly',
      'Your lead dashboard, free — every enquiry, with the concierge’s notes',
      'Searchable by city and speciality',
    ],
    notIncluded: ['No produced content', 'No bio or content library on your listing'],
  },
  {
    key: 'premium',
    name: 'Premium',
    tagline: 'Be the one they read before they call.',
    includes: [
      'Everything in Standard',
      'A fully produced webinar every quarter — deck built for you, recorded and edited, with a companion PDF',
      'A guest episode on the Better Than Bitter™ Divorce Podcast',
      'Six ready-to-post social clips a quarter, for your own channels',
      'Your bio and your whole content library on your listing',
      'Promoted monthly in the Better Than Bitter™ community, and kept permanently in the Resource Library',
    ],
    notIncluded: ['No introduction video', 'No live event hosting', 'Not exclusive — others in your city can join at this level'],
  },
  {
    key: 'platinum',
    name: 'Platinum',
    tagline: 'Be the only one.',
    includes: [
      'Everything in Premium',
      'The exclusive seat for your speciality in your city — no competitor appears above you',
      'A two-minute introduction video on your listing',
      'Host live Vesta events in your hub',
      'Your own Content Hub, hosted, on your domain — hosting included at this level',
      'Priority placement on every page you appear on',
    ],
    scarcity: 'One per speciality, per city. If the seat is taken, we will tell you before you pay.',
  },
];

export interface TierPrice {
  tier: TierKey;
  monthly: number;
}

/** What this profession pays at each level. */
export function pricesFor(profession: Profession): TierPrice[] {
  const band = PRICING[PROFESSION_BAND[profession]];
  return [
    { tier: 'standard', monthly: band.standard },
    { tier: 'premium', monthly: band.premium },
    { tier: 'platinum', monthly: band.platinum },
  ];
}

/** Every profession must price and categorise, or the form offers a dead end. */
export function assertProfessionsComplete(): void {
  for (const p of PROFESSIONS) {
    if (!PROFESSION_BAND[p]) throw new Error(`${p} has no pricing band`);
    if (!PROFESSION_CATEGORY[p]) throw new Error(`${p} has no directory category`);
  }
}
