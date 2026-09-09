/**
 * The single professional application: directory tier and affiliate in one.
 *
 * Separate from `application.ts`, which reads the existing PAC.MP/CCMP form.
 * That form is live and must not change while the merger is unsettled, so this
 * is a second front door rather than an edit to the first.
 *
 * What is different here: the professional chooses a directory tier rather
 * than a content program, supplies their own booking link, and can opt into
 * the product affiliate program in the same pass.
 */

import { parseSchedulerLink } from '../directory/schedulerLink.ts';
import {
  PROFESSION_CATEGORY, PROFESSIONS, type Profession, type TierKey,
} from './tiers.ts';
import { sanitizeSpecialties, SPECIALTY_NEEDING_DETAIL } from './specialties.ts';
import { decodePhoto, PhotoError, type DecodedPhoto } from './photo.ts';
import { sanitizeSocialLinks, type SocialLinks } from './social.ts';

export interface UnifiedApplicationInput {
  // Who they are
  firstName?: string; lastName?: string; email?: string; phone?: string;
  credentials?: string; company?: string; website?: string; linkedin?: string;
  // Practice
  profession?: string; statesLicensed?: string;
  street?: string; city?: string; state?: string; zip?: string;
  // Listing
  bio?: string; photoUrl?: string; schedulerUrl?: string;
  headline?: string;
  social?: Record<string, string>;
  specialties?: string[] | string; specialtyOther?: string;
  photoDataUrl?: string; photoWidth?: number; photoHeight?: number;
  // Level
  tier?: string;
  // Affiliate
  affiliateOptin?: string; paypalEmail?: string;
  channelType?: string; channelUrl?: string; audience?: string;
  // Provenance
  signupPath?: string; partnerName?: string;
}

export type Errors = Partial<Record<keyof UnifiedApplicationInput | 'specialties', string>>;

const TIERS: TierKey[] = ['standard', 'premium', 'platinum'];

export interface ValidatedApplication {
  firstName: string; lastName: string; email: string; phone: string;
  credentials?: string; company?: string; website?: string; linkedin?: string;
  profession: Profession; category: string; statesLicensed?: string;
  street?: string; city: string; state: string; zip?: string;
  hub: string;
  bio?: string; photoUrl?: string; schedulerUrl?: string;
  specialties: string[]; specialtyOther?: string;
  headline?: string;
  socialLinks: SocialLinks;
  photo?: DecodedPhoto;
  tier: TierKey;
  affiliateOptin: boolean; paypalEmail?: string;
  channelType?: string; channelUrl?: string; audience?: string;
  signupPath?: string; partnerName?: string;
}

export function validateUnifiedApplication(
  input: UnifiedApplicationInput,
): { ok: true; value: ValidatedApplication } | { ok: false; errors: Errors } {
  const errors: Errors = {};
  const t = (v: string | undefined) => (v ?? '').trim();

  const firstName = t(input.firstName);
  if (!firstName) errors.firstName = 'Please give us your first name.';

  const lastName = t(input.lastName);
  if (!lastName) errors.lastName = 'Please give us your last name.';

  const email = t(input.email).toLowerCase();
  if (!email) errors.email = 'We need an email address.';
  else if (!plausibleEmail(email)) errors.email = 'That does not look like an email address.';

  // Required, unlike on the consumer form: the concierge rings professionals.
  const phone = t(input.phone);
  if (!phone) errors.phone = 'We need a phone number — the concierge desk calls you about leads.';

  const profession = t(input.profession) as Profession;
  if (!profession) errors.profession = 'Please tell us your profession.';
  else if (!PROFESSIONS.includes(profession)) errors.profession = 'Please choose from the list.';

  // City and state decide which directory page they appear on. Without them a
  // listing exists but nobody can find it — the exact problem six professionals
  // in the current directory have.
  const city = t(input.city);
  if (!city) errors.city = 'We need your city — it decides which page you appear on.';
  const state = t(input.state);
  if (!state) errors.state = 'We need your state.';

  const tier = t(input.tier) as TierKey;
  if (!tier) errors.tier = 'Please choose a level.';
  else if (!TIERS.includes(tier)) errors.tier = 'That is not one of the levels.';

  // A booking link is optional, but a broken or unsafe one is not accepted
  // quietly — it would render as a dead button on a public page.
  const schedulerRaw = t(input.schedulerUrl);
  if (schedulerRaw && !parseSchedulerLink(schedulerRaw)) {
    errors.schedulerUrl = 'That booking link is not a complete https:// web address.';
  }

  // At least one specialty. Without it a listing says "Attorney" and nothing
  // about what they actually do, which is the difference between a directory
  // and a phone book.
  const specialties = sanitizeSpecialties(input.specialties);
  if (specialties.length === 0) {
    errors.specialties = 'Please tick at least one thing you do.';
  }
  const specialtyOther = t(input.specialtyOther);
  if (specialties.includes(SPECIALTY_NEEDING_DETAIL) && !specialtyOther) {
    errors.specialtyOther = 'You ticked “Other” — please say what it is.';
  }

  let photo: DecodedPhoto | undefined;
  try {
    photo = decodePhoto({
      dataUrl: input.photoDataUrl, width: input.photoWidth, height: input.photoHeight,
    });
  } catch (err) {
    errors.photoDataUrl = err instanceof PhotoError ? err.message : 'That image could not be read.';
  }

  const affiliateOptin = ['1', 'true', 'on', 'yes'].includes(t(input.affiliateOptin).toLowerCase());
  const paypalEmail = t(input.paypalEmail).toLowerCase();
  if (affiliateOptin && !paypalEmail) {
    // Commissions are paid by PayPal. Joining without one means we cannot pay.
    errors.paypalEmail = 'We pay affiliate commission by PayPal, so we need that address.';
  } else if (paypalEmail && !plausibleEmail(paypalEmail)) {
    errors.paypalEmail = 'That does not look like an email address.';
  }

  if (Object.keys(errors).length) return { ok: false, errors };

  return {
    ok: true,
    value: {
      firstName, lastName, email, phone,
      credentials: t(input.credentials) || undefined,
      company: t(input.company) || undefined,
      website: t(input.website) || undefined,
      linkedin: t(input.linkedin) || undefined,
      profession,
      category: PROFESSION_CATEGORY[profession],
      statesLicensed: t(input.statesLicensed) || undefined,
      street: t(input.street) || undefined,
      city, state,
      zip: t(input.zip) || undefined,
      hub: hubSlug(city, state),
      bio: t(input.bio) || undefined,
      photoUrl: t(input.photoUrl) || undefined,
      specialties,
      specialtyOther: specialtyOther || undefined,
      headline: t(input.headline) || undefined,
      socialLinks: sanitizeSocialLinks(input.social),
      photo,
      schedulerUrl: schedulerRaw ? parseSchedulerLink(schedulerRaw)!.href : undefined,
      tier,
      affiliateOptin,
      paypalEmail: paypalEmail || undefined,
      channelType: t(input.channelType) || undefined,
      channelUrl: t(input.channelUrl) || undefined,
      audience: t(input.audience) || undefined,
      signupPath: t(input.signupPath) || undefined,
      partnerName: t(input.partnerName) || undefined,
    },
  };
}

export function hubSlug(city: string, state: string): string {
  const c = city.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${c}-${state.trim().toLowerCase()}`;
}

function plausibleEmail(v: string): boolean {
  if (/\s/.test(v)) return false;
  const at = v.indexOf('@');
  if (at <= 0 || at !== v.lastIndexOf('@')) return false;
  const domain = v.slice(at + 1);
  return domain.includes('.') && !domain.startsWith('.') && !domain.endsWith('.');
}
