import { NextResponse, type NextRequest } from 'next/server';
import { GATE_COOKIE, safeNext, timingSafeEqual, verifyToken } from './src/auth/gate.ts';

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

  const to = `/enter?next=${encodeURIComponent(safeNext(pathname + search))}`;
  return noindex(new NextResponse(null, { status: 307, headers: { Location: to } }));
}

function noindex(res: NextResponse): NextResponse {
  res.headers.set('x-robots-tag', 'noindex, nofollow');
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
