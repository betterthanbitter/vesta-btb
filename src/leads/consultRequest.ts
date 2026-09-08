/**
 * A consult request: the form a consumer fills in when there is no scheduler,
 * or when the scheduler had no time that suited them.
 *
 * Unlike a scheduler click, this carries contact details — so the professional
 * can follow up, and so the CRM has somebody to nurture if they do not.
 */

export interface ConsultRequestInput {
  professionalId: string;
  name: string;
  email: string;
  phone?: string;
  message?: string;
  sourcePath: string;
}

export interface ConsultRequest extends ConsultRequestInput {
  id: string;
  at: string;
}

export type FieldErrors = Partial<Record<'name' | 'email' | 'phone' | 'message', string>>;

/** Longest we will accept, to keep a paste-bomb out of the database. */
const LIMITS = { name: 120, email: 254, phone: 40, message: 2000 };

/**
 * Validate on the server, always.
 *
 * Browser validation is a convenience for the person typing; it is not a
 * control, because anything can post to this endpoint directly.
 */
export function validateConsultRequest(input: Partial<ConsultRequestInput>): {
  ok: true; value: ConsultRequestInput;
} | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};

  const name = (input.name ?? '').trim();
  if (!name) errors.name = 'Please tell us your name.';
  else if (name.length > LIMITS.name) errors.name = 'That name is too long.';

  const email = (input.email ?? '').trim().toLowerCase();
  if (!email) errors.email = 'We need an email address to pass on.';
  else if (email.length > LIMITS.email) errors.email = 'That email address is too long.';
  else if (!isPlausibleEmail(email)) errors.email = 'That does not look like an email address.';

  const phone = (input.phone ?? '').trim();
  if (phone && phone.length > LIMITS.phone) errors.phone = 'That phone number is too long.';

  const message = (input.message ?? '').trim();
  if (message.length > LIMITS.message) {
    errors.message = 'Please keep this under 2,000 characters.';
  }

  if (Object.keys(errors).length) return { ok: false, errors };

  return {
    ok: true,
    value: {
      professionalId: String(input.professionalId ?? ''),
      name, email,
      phone: phone || undefined,
      message: message || undefined,
      // Never trust a path from the client as a redirect target; it is stored
      // for attribution only and must stay relative.
      sourcePath: sanitisePath(input.sourcePath),
    },
  };
}

/**
 * Deliberately permissive. Real addresses break every clever regex ever
 * written, and rejecting a valid address loses a lead — far worse than
 * accepting one that later bounces.
 */
function isPlausibleEmail(value: string): boolean {
  if (/\s/.test(value)) return false;
  const at = value.indexOf('@');
  if (at <= 0 || at !== value.lastIndexOf('@')) return false;
  const domain = value.slice(at + 1);
  return domain.includes('.') && !domain.startsWith('.') && !domain.endsWith('.');
}

function sanitisePath(raw: string | undefined): string {
  if (!raw) return '/';
  // Anything absolute, protocol-relative, or containing a scheme is discarded.
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw.slice(0, 200);
}
