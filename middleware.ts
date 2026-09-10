import { NextResponse, type NextRequest } from 'next/server';
import {
  GATE_COOKIE, isPublicReviewRequest, safeNext, timingSafeEqual, verifyToken,
} from './src/auth/gate.ts';

/**
 * Keeps the preview private.
 *
 * The directory shows real professionals — photos, bios, contact details —
 * alongside tier labels nobody has agreed to. Unset SITE_PASSWORD and the gate
 * disappears, which is what we want locally and at launch.
 */
export async function middleware(req: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.next();

  const { pathname, search } = req.nextUrl;

  // The password page itself must stay reachable, or there is no way in.
  if (pathname === '/enter' || pathname === '/api/enter') return NextResponse.next();

  // A hired client's testimonial link, which cannot carry the password.
  if (isPublicReviewRequest(req.method, pathname)) return noindex(NextResponse.next());

  if (await verifyToken(req.cookies.get(GATE_COOKIE)?.value, password)) {
    return noindex(NextResponse.next());
  }

  // Basic auth still works, for scripts and for checking the site from a
  // terminal. Browsers get the page.
  const header = req.headers.get('authorization');
  if (header?.startsWith('Basic ')) {
    const decoded = atob(header.slice(6));
    if (timingSafeEqual(decoded.slice(decoded.indexOf(':') + 1), password)) {
      return noindex(NextResponse.next());
    }
  }

  // Absolute, built from nextUrl — not relative. Netlify's edge runtime parses
  // a middleware redirect's Location with no base and throws "Invalid URL" on
  // a relative one. nextUrl carries the hostname the visitor actually used,
  // unlike req.url inside a serverless function, which is why /api/enter stays
  // relative and this does not. Both halves are proven on Netlify.
  const to = req.nextUrl.clone();
  to.pathname = '/enter';
  to.search = `?next=${encodeURIComponent(safeNext(pathname + search))}`;
  return noindex(NextResponse.redirect(to, 307));
}

function noindex(res: NextResponse): NextResponse {
  res.headers.set('x-robots-tag', 'noindex, nofollow');
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
