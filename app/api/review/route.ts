import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '../../../src/leads/store.ts';
import { TestimonialRepository } from '../../../src/testimonials/repository.ts';
import { isReviewToken, validateTestimonial } from '../../../src/testimonials/testimonial.ts';

/**
 * A hired client's testimonial.
 *
 * A route rather than a server action so the preview gate can let exactly
 * this through — see isPublicReviewRequest.
 */
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Malformed request.' }, { status: 400 });
  }

  if (!isReviewToken(body?.token)) {
    return NextResponse.json({ message: 'This review link is not valid.' }, { status: 404 });
  }

  const result = validateTestimonial(body);
  if (!result.ok) return NextResponse.json({ errors: result.errors }, { status: 422 });

  try {
    const r = await new TestimonialRepository(await getDb()).submit(body.token, result.value);
    if (!r.ok) {
      return r.reason === 'already'
        ? NextResponse.json({ message: 'We already have your testimonial — thank you.' }, { status: 409 })
        : NextResponse.json({ message: 'This review link is not valid.' }, { status: 404 });
    }
  } catch (err) {
    console.error('[testimonial] failed to record', err);
    return NextResponse.json(
      { message: 'We could not save that just now. Please try again.' },
      { status: 503 },
    );
  }
  return NextResponse.json({ ok: true });
}
