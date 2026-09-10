/**
 * The Better Than Bitter community offer shown after a consult is requested.
 *
 * Someone who has just asked a professional for help is the person most likely
 * to want support alongside it, and the consumer products — Divorce Companion,
 * Companion+ and the Legal LaunchPad — are the only thing that pays a channel
 * partner. So this is the one place the directory offers them.
 *
 * The link is a setting rather than a constant. On Vesta's own directory it is
 * Better Than Bitter's own trial link; on a partner channel it becomes that
 * channel's affiliate link from Circle, which is how their commission is
 * tracked. Affiliate tracking and payouts stay in Circle.
 */

/**
 * The Divorce Companion+ checkout on Circle, where the 7-day free trial starts —
 * so the "Start Your 7 Day FREE Trial" button lands exactly where it promises.
 *
 * For a channel partner, COMPANION_TRIAL_URL is set to their own affiliate
 * version of a link like this one. Its parameters are kept exactly as given,
 * whatever Circle names them, so the channel is still credited.
 */
export const DEFAULT_COMPANION_TRIAL_URL =
  'https://community.betterthanbitter.coach/checkout/divorce-companion-plus';

export interface CompanionOffer {
  href: string;
}

/**
 * The link, with where the click came from appended, so the community side can
 * see how many trials the directory starts. Existing query parameters — an
 * affiliate code, above all — are kept.
 */
export function companionOffer(
  configured: string | undefined = process.env.COMPANION_TRIAL_URL,
  source = 'vesta-directory',
): CompanionOffer | null {
  const raw = (configured ?? DEFAULT_COMPANION_TRIAL_URL).trim();
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  // A link a person typed into a setting still reaches an href: https only.
  if (url.protocol !== 'https:') return null;
  if (!url.searchParams.has('utm_source')) url.searchParams.set('utm_source', source);
  if (!url.searchParams.has('utm_medium')) url.searchParams.set('utm_medium', 'consult-thank-you');
  return { href: url.toString() };
}
