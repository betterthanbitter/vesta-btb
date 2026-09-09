/**
 * The concierge questionnaire.
 *
 * Wording follows the live forms on vestadivorce.com (the concierge
 * questionnaire and the intake form) and the fields on an exported contact
 * record, so what the concierge types here matches what they already ask on
 * the phone. Everything is optional except a name and an email — a lead
 * half-captured is better than a lead abandoned because a field was required.
 */

export const STAGE_OF_DIVORCE = [
  'Considering divorce or separation',
  'Separated',
  'Recently filed',
  'Filed but not complete',
  'Divorced',
] as const;

export const LENGTH_OF_MARRIAGE = [
  '1-5 years', '6-10 years', '11-15 years', '16-20 years',
  '21-25 years', '26-35 years', '36+ years',
  'Separating but not legally married',
] as const;

export const CHILDREN_AGES = ['1-5', '6-10', '11-17', '18-22', '23+'] as const;

export const HOME_STATUS = ['Own', 'Rent', 'Staying with family or friends'] as const;

export const ASSET_RANGE = [
  'Under $100,000', '$100,001 - $250,000', '$250,001 - $500,000',
  '$500,001 - $1m', 'Over $1m', 'Prefer not to say',
] as const;

/** The list as it appears on the live questionnaire, in that order. */
export const PROFESSIONALS_WANTED = [
  'Divorce Attorney',
  'Divorce Mediator',
  'Financial Professional/CDFA',
  'Therapist',
  'Divorce Coach/Life Coach',
  'Parent Coach',
  'Realtor/CDRE',
  'Mortgage/CDLP',
  'Business Valuator',
  'Forensic Accountant',
] as const;

export const LEAD_SOURCE = [
  'Vesta event',
  'Facebook lead ad',
  'Internet search',
  'Friend or family member',
  'Professional referral',
  'Better Than Bitter community',
  'Other',
] as const;

export interface ConsumerProfile {
  phone?: string;
  city?: string;
  state?: string;
  stageOfDivorce?: string;
  lengthOfMarriage?: string;
  hasChildren?: string;
  childrenAges?: string;
  homeStatus?: string;
  ownsBusiness?: string;
  assetRange?: string;
  professionalsWanted?: string;
  leadSource?: string;
  questions?: string;
}

/** Columns in the order the form presents them, for building the record. */
export const PROFILE_COLUMNS: Array<[keyof ConsumerProfile, string]> = [
  ['phone', 'phone'],
  ['city', 'city'],
  ['state', 'state'],
  ['stageOfDivorce', 'stage_of_divorce'],
  ['lengthOfMarriage', 'length_of_marriage'],
  ['hasChildren', 'has_children'],
  ['childrenAges', 'children_ages'],
  ['homeStatus', 'home_status'],
  ['ownsBusiness', 'owns_business'],
  ['assetRange', 'asset_range'],
  ['professionalsWanted', 'professionals_wanted'],
  ['leadSource', 'lead_source'],
  ['questions', 'questions'],
];
