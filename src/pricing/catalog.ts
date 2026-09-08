/**
 * Membership pricing, as supplied 8 September 2026.
 *
 * Two taxonomies cross-cut here and keeping them apart matters:
 *
 *   - a PRICING BAND decides what a professional pays. There are five.
 *   - a PRACTICE CATEGORY decides which directory page they appear on, and
 *     what a consumer browses. There are six.
 *
 * They are not the same cut of the world. Mediators are priced with CDFAs but
 * a consumer looks for them under family law. Lending, realty and accounting
 * share one price band but are three separate things to search for. Modelling
 * them as one field would force a wrong answer on one side or the other.
 */

export type PricingBand =
  | 'attorneys'
  | 'cdfa-mediators'
  | 'lending-realty-accounting'
  | 'divorce-coaches'
  | 'therapists-wellness-other';

export type PracticeCategory =
  | 'family-law'
  | 'financial-cdfa'
  | 'accounting-tax'
  | 'real-estate'
  | 'mortgage'
  | 'coaching-therapy';

/** Named to match the table; `current` is the legacy single-tier price. */
export type TierName = 'standard' | 'premium' | 'platinum';

export interface BandPricing {
  label: string;
  /** Headcount in the network as of 8 Sep 2026. */
  inNetwork: number;
  /** What this band pays today, before the move to three tiers. */
  current: number;
  standard: number;
  premium: number;
  platinum: number;
  /** Set where the figure carried a caveat in the source table. */
  note?: string;
}

export const PRICING: Record<PricingBand, BandPricing> = {
  attorneys: {
    label: 'Attorneys',
    inNetwork: 23, current: 500, standard: 49, premium: 295, platinum: 795,
  },
  'cdfa-mediators': {
    label: 'CDFAs & Mediators',
    inNetwork: 21, current: 375, standard: 39, premium: 195, platinum: 570,
  },
  'lending-realty-accounting': {
    label: 'Lending, Realty, Accounting',
    inNetwork: 16, current: 250, standard: 29, premium: 99, platinum: 349,
  },
  'divorce-coaches': {
    label: 'Divorce Coaches',
    inNetwork: 9, current: 250, standard: 29, premium: 249, platinum: 474,
  },
  'therapists-wellness-other': {
    label: 'Therapists, Wellness & Other',
    inNetwork: 9, current: 250, standard: 29, premium: 99, platinum: 349,
    note: 'Premium marked with an asterisk in the source table — confirm.',
  },
};

/** Which price band a professional in a given practice category falls into. */
export const BAND_FOR_CATEGORY: Record<PracticeCategory, PricingBand> = {
  'family-law': 'attorneys',
  'financial-cdfa': 'cdfa-mediators',
  'accounting-tax': 'lending-realty-accounting',
  'real-estate': 'lending-realty-accounting',
  mortgage: 'lending-realty-accounting',
  'coaching-therapy': 'divorce-coaches',
};

export const BANDS = Object.keys(PRICING) as PricingBand[];

export const TOTAL_IN_NETWORK = BANDS.reduce((n, b) => n + PRICING[b].inNetwork, 0);

/** Headcount-weighted average price across the whole network for one tier. */
export function weightedAverage(tier: TierName | 'current'): number {
  const total = BANDS.reduce((sum, b) => sum + PRICING[b][tier] * PRICING[b].inNetwork, 0);
  return total / TOTAL_IN_NETWORK;
}

/** Monthly recurring revenue if every member sat on one tier. */
export function revenueIfAllOn(tier: TierName | 'current'): number {
  return BANDS.reduce((sum, b) => sum + PRICING[b][tier] * PRICING[b].inNetwork, 0);
}
