import { NextResponse, type NextRequest } from 'next/server';
import { loadPublishedDirectory } from '../../../src/professionals/directory.ts';
import { getDb } from '../../../src/leads/store.ts';
import { validateConsultRequest } from '../../../src/leads/consultRequest.ts';
import { LeadRepository } from '../../../src/db/leadRepository.ts';
import type { Professional } from '../../../src/referral/types.ts';

/**
 * A consult request becomes a referral.
 *
 * It used to land in its own table, which meant a form submission and a
 * concierge referral were different things with different screens. They are
 * the same thing — someone who wants to talk to a professional — so both go
 * through the referral model, get stages, appear on the same dashboard, and
 * are chased by the same cold-lead sweep.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Malformed request.' }, { status: 400 });
  }

  const result = validateConsultRequest(body as any);
  if (!result.ok) return NextResponse.json({ errors: result.errors }, { status: 422 });

  const record = (await loadPublishedDirectory(await getDb())).find((r) => r.id === result.value.professionalId);
  if (!record) return NextResponse.json({ message: 'Unknown professional.' }, { status: 404 });

  const [firstName, ...rest] = result.value.name.trim().split(/\s+/);
  const professional: Professional = {
    id: record.id,
    email: record.email ?? `${record.id}@placeholder.invalid`,
    firstName: record.name.split(' ')[0],
    lastName: record.name.split(' ').slice(1).join(' '),
    firm: record.firm,
    hub: record.hub,
    category: record.category,
    tier: record.tier,
  };

  try {
    const repo = new LeadRepository(await getDb());
    const consumer = await repo.upsertConsumer({
      email: result.value.email,
      firstName: firstName ?? result.value.name,
      lastName: rest.join(' '),
      hub: record.hub,
      categoryNeeded: record.category,
    });
    // Already in touch with this professional? Do not create a second lead.
    const open = await repo.findOpenReferral(consumer.id, professional.id);
    if (open) {
      if (result.value.message) await repo.appendMessage(open, result.value.message);
    } else {
      await repo.route({
        consumer,
        professionals: [professional],
        mode: 'direct',
        message: result.value.message,
      });
    }
  } catch (err) {
    console.error('[consult-request] failed to record', err);
    return NextResponse.json(
      { message: 'We could not save that just now. Please try again.' },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true });
}
