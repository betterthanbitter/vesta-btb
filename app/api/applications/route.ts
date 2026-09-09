import { NextResponse, type NextRequest } from 'next/server';
import { ApplicationError, mapApplication } from '../../../src/professionals/application.ts';
import { ProfessionalRepository } from '../../../src/professionals/repository.ts';
import { getDb } from '../../../src/leads/store.ts';

/**
 * Receives a professional application.
 *
 * Netlify posts form submissions here as an outgoing webhook, wrapped as
 * { payload: { data: {...} } }. A direct POST of the fields themselves also
 * works, so the form can be pointed here directly later without changing this.
 *
 * The endpoint is protected by a shared secret rather than left open: without
 * one, anyone who found the URL could file applications into the review queue
 * all day.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.APPLICATION_WEBHOOK_SECRET;
  if (secret) {
    const supplied = req.headers.get('x-webhook-secret')
      ?? req.nextUrl.searchParams.get('key')
      ?? '';
    if (supplied !== secret) {
      return NextResponse.json({ message: 'Not authorised.' }, { status: 401 });
    }
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Malformed request.' }, { status: 400 });
  }

  const data = body?.payload?.data ?? body?.data ?? body;

  try {
    const mapped = mapApplication(data);
    const repo = new ProfessionalRepository(await getDb());
    const { id, isNew } = await repo.receiveApplication(mapped);
    return NextResponse.json({ ok: true, id, isNew, status: 'applied' }, { status: isNew ? 201 : 200 });
  } catch (err) {
    if (err instanceof ApplicationError) {
      // A mapping refusal is the applicant's or the form's problem, not ours.
      return NextResponse.json({ message: err.message }, { status: 422 });
    }
    console.error('[applications] failed', err);
    return NextResponse.json({ message: 'Could not record that application.' }, { status: 503 });
  }
}
