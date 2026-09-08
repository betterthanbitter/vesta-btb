/**
 * Validation for the scheduler link a professional supplies.
 *
 * This value is typed by a professional into the back office and then rendered
 * into an href on a public page. That is a script-injection route: a value like
 * `javascript:fetch(...)` in an href executes when a consumer clicks it, in the
 * context of the Vesta page. Nothing user-supplied reaches an href without
 * passing through here first.
 *
 * The rule is a protocol allowlist rather than a host allowlist — professionals
 * use Calendly, Acuity, Squarespace, HubSpot, their own practice software and
 * plenty else, and an allowlist of hosts would be wrong within a month.
 */

const ALLOWED_PROTOCOLS = ['https:'];

export interface SchedulerLink {
  href: string;
  /** Host shown to the consumer so they know where the button goes. */
  host: string;
}

/**
 * Returns a safe link, or null if the value cannot be trusted.
 *
 * http is rejected rather than upgraded: every scheduling product supports
 * https, so an http link is more likely a mistake than a working booking page,
 * and silently rewriting someone's URL is worse than telling them it is wrong.
 */
export function parseSchedulerLink(raw: string | undefined | null): SchedulerLink | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (!ALLOWED_PROTOCOLS.includes(url.protocol)) return null;
  // A URL with no host — https:///foo — parses but goes nowhere useful.
  if (!url.hostname) return null;

  return { href: url.toString(), host: url.hostname.replace(/^www\./, '') };
}

/** Why a link was rejected, for the back office to show the professional. */
export function explainRejection(raw: string | undefined | null): string | null {
  if (!raw || !raw.trim()) return 'No scheduling link has been provided.';
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return 'That is not a complete web address. It should start with https://';
  }
  if (url.protocol === 'http:') {
    return 'Scheduling links must use https:// rather than http://';
  }
  if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
    return `Links using "${url.protocol}" are not accepted. Use an https:// address.`;
  }
  if (!url.hostname) return 'That address has no website in it.';
  return null;
}
