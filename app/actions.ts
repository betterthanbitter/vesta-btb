'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '../src/leads/store.ts';
import { LeadRepository } from '../src/db/leadRepository.ts';
import { loadDirectory } from '../src/data/vestaImport.ts';
import type { Professional, Stage } from '../src/referral/types.ts';

export async function advanceLead(formData: FormData) {
  const referralId = String(formData.get('referralId'));
  const professionalId = String(formData.get('professionalId'));
  const stage = String(formData.get('stage')) as Stage;

  const repo = new LeadRepository(await getDb());
  await repo.advance(referralId, professionalId, stage);
  revalidatePath('/hub/leads');
  revalidatePath('/admin');
}

/** The concierge takes a call and routes it. Screen 6's whole purpose. */
export async function routeLead(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const chosen = formData.getAll('professionalId').map(String).filter(Boolean);
  const notes = String(formData.get('notes') ?? '').trim();

  if (!name || !email || chosen.length === 0) {
    throw new Error('A lead needs a name, an email address and at least one professional.');
  }

  const directory = loadDirectory();
  const professionals: Professional[] = chosen.flatMap((id) => {
    const r = directory.find((d) => d.id === id);
    if (!r) return [];
    return [{
      id: r.id,
      email: r.email ?? `${r.id}@placeholder.invalid`,
      firstName: r.name.split(' ')[0],
      lastName: r.name.split(' ').slice(1).join(' '),
      firm: r.firm,
      hub: r.hub,
      category: r.category,
      tier: r.tier,
    }];
  });
  if (!professionals.length) throw new Error('None of those professionals exist.');

  const [firstName, ...rest] = name.split(/\s+/);
  const repo = new LeadRepository(await getDb());
  const field = (k: string) => {
    const v = String(formData.get(k) ?? '').trim();
    return v || undefined;
  };

  const consumer = await repo.upsertConsumer({
    email,
    firstName,
    lastName: rest.join(' '),
    hub: professionals[0].hub,
    categoryNeeded: professionals[0].category,
    phone: field('phone'),
    city: field('city'),
    state: field('state'),
    stageOfDivorce: field('stageOfDivorce'),
    lengthOfMarriage: field('lengthOfMarriage'),
    hasChildren: field('hasChildren'),
    childrenAges: field('childrenAges'),
    homeStatus: field('homeStatus'),
    ownsBusiness: field('ownsBusiness'),
    assetRange: field('assetRange'),
    professionalsWanted: field('professionalsWanted'),
    leadSource: field('leadSource'),
    questions: field('questions'),
  });

  await repo.route({
    consumer,
    professionals,
    // One professional is a direct introduction; several is a shortlist the
    // consumer chooses from.
    mode: professionals.length === 1 ? 'direct' : 'consumer-choice',
    message: notes || undefined,
  });

  revalidatePath('/admin');
  revalidatePath('/hub/leads');
}

/** Approve or decline an application, and set the tier while doing it. */
export async function decideApplication(formData: FormData) {
  const { ProfessionalRepository } = await import('../src/professionals/repository.ts');
  const id = String(formData.get('id'));
  const decision = String(formData.get('decision'));
  const tier = String(formData.get('tier') || '') || undefined;

  const repo = new ProfessionalRepository(await getDb());
  if (decision === 'publish') await repo.setStatus(id, 'published', tier);
  else if (decision === 'approve') await repo.setStatus(id, 'approved', tier);
  else if (decision === 'decline') await repo.setStatus(id, 'declined');
  else throw new Error(`Unknown decision "${decision}".`);

  revalidatePath('/admin/applications');
  revalidatePath('/admin');
}
