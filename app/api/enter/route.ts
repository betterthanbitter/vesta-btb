import { NextResponse, type NextRequest } from 'next/server';
import { GATE_COOKIE, issueToken, safeNext, timingSafeEqual } from '../../../src/auth/gate.ts';

export async function POST(req: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  const form = await req.formData();
  const supplied = String(form.get('password') ?? '');
  const next = safeNext(String(form.get('next') ?? '/'));

  if (!password || !timingSafeEqual(supplied, password)) {
    // Back to the form, saying so, with the destination preserved.
    const to = req.nextUrl.clone();
    to.pathname = '/enter';
    to.search = `?wrong=1&next=${encodeURIComponent(next)}`;
    return NextResponse.redirect(to, 303);
  }

  const res = NextResponse.redirect(new URL(next, req.url), 303);
  res.cookies.set(GATE_COOKIE, await issueToken(password), {
    httpOnly: true,
    secure: req.nextUrl.protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });
  return res;
}
