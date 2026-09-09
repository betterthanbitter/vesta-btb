import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { loadDirectory } from '../../../../src/data/vestaImport.ts';
import { parseSchedulerLink } from '../../../../src/directory/schedulerLink.ts';
import { recordConsultIntent } from '../../../../src/leads/consultIntent.ts';
import { getConsultIntentStore } from '../../../../src/leads/store.ts';

/**
 * "Schedule free consult" goes through here rather than straight to the
 * professional's scheduler, so the click is recorded before the consumer
 * leaves. A client-side beacon would lose clicks to fast navigations.
 *
 * Note on open redirects: the destination is looked up from our own data by
 * professional id. It is never read from the query string. A route that
 * redirects to a URL a caller supplies is an open redirect, and those get used
 * to make phishing links look like they come from your domain.
 */
const VISITOR_COOKIE = 'vesta_v';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const professional = loadDirectory().find((r) => r.id === id);
  const link = parseSchedulerLink(professional?.schedulerUrl);

  if (!professional || !link) {
    // No usable scheduler. Send them to the profile rather than nowhere.
    return NextResponse.redirect(new URL(`/profile/${id}`, req.url), 302);
  }

  let visitorKey = req.cookies.get(VISITOR_COOKIE)?.value;
  const isNewVisitor = !visitorKey;
  if (!visitorKey) visitorKey = randomUUID();

  try {
    await recordConsultIntent(await getConsultIntentStore(), {
      id: randomUUID(),
      professionalId: professional.id,
      sourcePath: req.nextUrl.searchParams.get('from') ?? '/',
      destinationHost: link.host,
      at: new Date().toISOString(),
      visitorKey,
    });
  } catch (err) {
    // Never strand a consumer because our own bookkeeping failed. They came
    // here to book a meeting; that has to happen whatever else breaks.
    console.error('[consult-intent] failed to record', err);
  }

  const res = NextResponse.redirect(link.href, 302);
  if (isNewVisitor) {
    res.cookies.set(VISITOR_COOKIE, visitorKey, {
      httpOnly: true, sameSite: 'lax', secure: true, path: '/',
      maxAge: 60 * 60 * 24 * 180,
    });
  }
  return res;
}
