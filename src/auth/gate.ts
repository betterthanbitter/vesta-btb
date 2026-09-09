/**
 * The preview password gate.
 *
 * A browser's built-in Basic-auth dialog was the first attempt. It is hostile:
 * some browsers refuse to submit without a username, dismissing it leaves you
 * on a bare error page with no way back, and there is no obvious retry. For a
 * link that gets sent to people who are not developers, a real page is right.
 *
 * The cookie is signed rather than a plain "yes" flag, so it cannot simply be
 * invented in devtools. Web Crypto rather than node:crypto because middleware
 * runs on the edge runtime, where node:crypto is unavailable.
 */

const COOKIE = 'vesta_gate';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const GATE_COOKIE = COOKIE;

function b64url(bytes: ArrayBuffer): string {
  const s = btoa(String.fromCharCode(...new Uint8Array(bytes)));
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

/** A token that proves someone knew the password, valid for thirty days. */
export async function issueToken(secret: string, now = Date.now()): Promise<string> {
  const expires = now + THIRTY_DAYS_MS;
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(String(expires)));
  return `${expires}.${b64url(sig)}`;
}

export async function verifyToken(
  token: string | undefined,
  secret: string,
  now = Date.now(),
): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf('.');
  if (dot <= 0) return false;

  const expires = Number(token.slice(0, dot));
  if (!Number.isFinite(expires) || expires < now) return false;

  // Recompute and compare the signature rather than trusting the payload.
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(String(expires)));
  return timingSafeEqual(b64url(sig), token.slice(dot + 1));
}

/** Constant time, so the signature cannot be guessed one character at a time. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Only ever send someone back to a path on this site. */
export function safeNext(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw.slice(0, 300);
}

/**
 * A redirect that stays on whatever hostname the visitor is actually using.
 *
 * NextResponse.redirect wants an absolute URL, and building one from req.url
 * is wrong behind a proxy: on Netlify req.url carries the internal per-deploy
 * hostname (6aa171c8--site.netlify.app), so the visitor is thrown onto a
 * different origin — where the cookie just set does not exist. The gate then
 * bounces them back to the password page, forever, with no error shown.
 *
 * A relative Location avoids the question entirely. RFC 7231 permits it and
 * every browser resolves it against the current origin.
 */
export function relativeRedirect(path: string, status: 303 | 307 = 303): Response {
  return new Response(null, { status, headers: { Location: path } });
}
