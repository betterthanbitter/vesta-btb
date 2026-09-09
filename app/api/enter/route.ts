import { NextResponse, type NextRequest } from 'next/server';
import {
  GATE_COOKIE, issueToken, safeNext, timingSafeEqual,
} from '../../../src/auth/gate.ts';

export async function POST(req: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  const form = await req.formData();
  const supplied = String(form.get('password') ?? '');
  const next = safeNext(String(form.get('next') ?? '/'));

  if (!password || !timingSafeEqual(supplied, password)) {
    // Back to the form, saying so, with the destination preserved.
    return new NextResponse(null, {
      status: 303,
      headers: { Location: `/enter?wrong=1&next=${encodeURIComponent(next)}` },
    });
  }

  // Relative, so the browser stays on the hostname the visitor is using.
  const res = new NextResponse(null, { status: 303, headers: { Location: next } });
  res.cookies.set(GATE_COOKIE, await issueToken(password), {
    httpOnly: true,
    secure: req.nextUrl.protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });
  return res;
}
