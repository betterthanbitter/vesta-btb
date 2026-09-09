/**
 * The professional application, as it arrives from the live form at
 * btbresellerapplication.netlify.app.
 *
 * Field names below are the form's own `name` attributes, so the two cannot
 * drift apart silently: rename a field on the form and the mapping stops
 * finding it, which the tests catch.
 *
 * It is a Netlify form, so submissions do not come to us directly — a Netlify
 * outgoing webhook posts them here. That means no change to the form itself,
 * and Netlify's own record stays as the backup.
 */

export type ApplicationStatus = 'applied' | 'approved' | 'published' | 'declined';

/** Exactly the names the live form posts. */
export interface ApplicationData {
  signup_path?: string;
  partner_name?: string;
  program?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  credentials?: string;
  company?: string;
  website?: string;
  linkedin?: string;
  social?: string;
  channel?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  states_licensed?: string | string[];
  occupation?: string;
  bio?: string;
  photo?: string;
  group_slot_1?: string;
  group_slot_2?: string;
  group_slot_3?: string;
  group_timezone?: string;
  product_affiliate_optin?: string;
}

/**
 * The professions offered on the application, and the consumer-facing category
 * each rolls up to.
 *
 * Two different questions. "Mediator" is how a professional describes
 * themselves; "Family Law & Mediation" is what a consumer browses for. Mapping
 * between them here keeps the application in the professional's language and
 * the directory in the consumer's.
 */
export const OCCUPATION_TO_CATEGORY: Record<string, string> = {
  'Attorney': 'family-law',
  'Mediator': 'family-law',
  'CDFA': 'financial-cdfa',
  'Accountant': 'accounting-tax',
  'Realtor': 'real-estate',
  'Lending Professional': 'mortgage',
  'Divorce Coach (Coach Co-Op Marketing Partnership)': 'coaching-therapy',
  'Divorce Coach': 'coaching-therapy',
  'Career Coach': 'coaching-therapy',
  'Other professional service': 'coaching-therapy',
};

/** Both content programs place a professional at Premium. */
export const PROGRAM_TO_TIER: Record<string, 'standard' | 'premium' | 'platinum'> = {
  'Professional Authority Co-Op Marketing Partnership (PAC.MP)': 'premium',
  'PAC.MP': 'premium',
  'Coach Co-Op Marketing Partnership (CCMP)': 'premium',
  'CCMP': 'premium',
};

export interface MappedProfessional {
  status: ApplicationStatus;
  tier: 'standard' | 'premium' | 'platinum';
  firstName: string; lastName: string; email: string;
  phone?: string; credentials?: string; company?: string; bio?: string;
  photoUrl?: string; website?: string; linkedin?: string;
  social?: string; socialChannel?: string;
  street?: string; city?: string; state?: string; zip?: string;
  hub?: string; statesLicensed?: string;
  occupation?: string; category: string;
  specialties?: string; specialtyOther?: string;
  headline?: string; profileContent?: string; socialLinks?: string;
  signupPath?: string; partnerName?: string; program?: string;
  groupSlots?: string; groupTimezone?: string; affiliateOptin?: string;
  appliedAt: string;
}

export class ApplicationError extends Error {}

export function slugifyHub(city?: string, state?: string): string | undefined {
  if (!city || !state) return undefined;
  const c = city.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return c ? `${c}-${state.trim().toLowerCase()}` : undefined;
}

/**
 * Turn a submission into a professional record.
 *
 * It arrives as `applied`, never `published`. Every application is reviewed
 * and vetted; a form that put a stranger straight into the public directory
 * would make that promise untrue the first time somebody filled it in.
 */
export function mapApplication(
  data: ApplicationData,
  now = new Date().toISOString(),
): MappedProfessional {
  const email = (data.email ?? '').trim().toLowerCase();
  if (!email) throw new ApplicationError('An application with no email address cannot be used.');

  const firstName = (data.first_name ?? '').trim();
  if (!firstName) throw new ApplicationError('An application needs at least a first name.');

  const occupation = (data.occupation ?? '').trim();
  const category = OCCUPATION_TO_CATEGORY[occupation];
  if (!category) {
    // Guessing would file an attorney under coaching without telling anyone.
    throw new ApplicationError(
      `"${occupation || 'no profession'}" does not map to a directory category. ` +
      'Choose one by hand in the back office.',
    );
  }

  const states = Array.isArray(data.states_licensed)
    ? data.states_licensed.join(', ')
    : (data.states_licensed ?? '').trim();

  const slots = [data.group_slot_1, data.group_slot_2, data.group_slot_3]
    .map((s) => (s ?? '').trim()).filter(Boolean).join(' | ');

  return {
    status: 'applied',
    tier: PROGRAM_TO_TIER[(data.program ?? '').trim()] ?? 'standard',
    firstName,
    lastName: (data.last_name ?? '').trim(),
    email,
    phone: clean(data.phone),
    credentials: clean(data.credentials),
    company: clean(data.company),
    bio: clean(data.bio),
    photoUrl: clean(data.photo),
    website: clean(data.website),
    linkedin: clean(data.linkedin),
    social: clean(data.social),
    socialChannel: clean(data.channel),
    street: clean(data.street),
    city: clean(data.city),
    state: clean(data.state),
    zip: clean(data.zip),
    hub: slugifyHub(data.city, data.state),
    statesLicensed: states || undefined,
    occupation: occupation || undefined,
    category,
    signupPath: clean(data.signup_path),
    partnerName: clean(data.partner_name),
    program: clean(data.program),
    groupSlots: slots || undefined,
    groupTimezone: clean(data.group_timezone),
    affiliateOptin: clean(data.product_affiliate_optin),
    appliedAt: now,
  };
}

function clean(v: string | undefined): string | undefined {
  const s = (v ?? '').trim();
  return s || undefined;
}
