import { NextResponse, type NextRequest } from 'next/server';

/**
 * Password gate for the preview deployment.
 *
 * The directory shows real professionals — their photos, bios and contact
 * details — alongside tier labels nobody has agreed to. That must not be
 * reachable by anyone who happens on the URL while it is being reviewed.
 *
 * Set SITE_PASSWORD in the host's environment to switch the gate on. With no
 * password set the site is open, which is what we want locally and what we
 * will want on the real launch.
 */
export function middleware(req: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.next();

  const header = req.headers.get('authorization');
  if (header?.startsWith('Basic ')) {
    // atob rather than Buffer — middleware runs on the edge runtime.
    const decoded = atob(header.slice(6));
    const supplied = decoded.slice(decoded.indexOf(':') + 1);
    if (timingSafeEqual(supplied, password)) {
      const res = NextResponse.next();
      // A gated site is a preview. Keep it out of search results even if a
      // crawler is somehow given the credentials.
      res.headers.set('x-robots-tag', 'noindex, nofollow');
      return res;
    }
  }

  return new NextResponse('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Vesta preview", charset="UTF-8"',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}

/** Constant-time comparison, so the password cannot be guessed by timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const config = {
  // Everything except Next's own assets and the favicon.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
