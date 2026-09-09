/**
 * Social channels on a professional's profile.
 *
 * Stored as one JSON column rather than a column per platform: the list will
 * change, nothing queries inside it, and a migration every time a network
 * rises or falls is churn for no benefit.
 *
 * Every value is validated as an https URL before it reaches an href — the
 * same rule as the scheduler link, and for the same reason.
 */

export interface SocialPlatform {
  key: string;
  name: string;
  /** What to show in the form so people paste the right thing. */
  placeholder: string;
}

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  { key: 'linkedin', name: 'LinkedIn', placeholder: 'https://linkedin.com/in/you' },
  { key: 'facebook', name: 'Facebook', placeholder: 'https://facebook.com/yourpage' },
  { key: 'instagram', name: 'Instagram', placeholder: 'https://instagram.com/you' },
  { key: 'youtube', name: 'YouTube', placeholder: 'https://youtube.com/@you' },
  { key: 'x', name: 'X', placeholder: 'https://x.com/you' },
  { key: 'tiktok', name: 'TikTok', placeholder: 'https://tiktok.com/@you' },
  { key: 'podcast', name: 'Podcast', placeholder: 'https://podcasts.apple.com/…' },
];

export type SocialLinks = Record<string, string>;

/** Keep only known platforms with a usable https address. */
export function sanitizeSocialLinks(input: Record<string, unknown> | undefined): SocialLinks {
  const out: SocialLinks = {};
  if (!input) return out;
  for (const { key } of SOCIAL_PLATFORMS) {
    const raw = String(input[key] ?? '').trim();
    if (!raw) continue;
    const url = toHttpsUrl(raw);
    if (url) out[key] = url;
  }
  return out;
}

/**
 * Accepts a full URL, or a bare handle or domain, and returns an https URL.
 *
 * People paste "linkedin.com/in/me" and "@me" as often as a full address.
 * Refusing those would lose links for no good reason; guessing a scheme is
 * safe as long as the result is still checked.
 */
export function toHttpsUrl(raw: string): string | undefined {
  let value = raw.trim();
  if (!value) return undefined;
  // A bare @handle has no domain and cannot be resolved to a profile.
  if (value.startsWith('@')) return undefined;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) value = `https://${value}`;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
  // Upgrade http; every one of these networks serves https.
  url.protocol = 'https:';
  if (!url.hostname.includes('.')) return undefined;
  return url.toString();
}

export function parseSocialLinks(raw: string | null | undefined): SocialLinks {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return sanitizeSocialLinks(typeof parsed === 'object' && parsed ? parsed : {});
  } catch {
    return {};
  }
}
