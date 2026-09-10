import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Db } from '../db/client.ts';
import { ProfessionalRepository } from './repository.ts';
import { sanitizeSpecialties } from './specialties.ts';

/**
 * Demonstration content, seeded only when DEMO_PROFILE=1 so none of it
 * appears at launch.
 *
 * Two parts:
 *  - A fictional professional with a full profile, so the page can be shown as
 *    it will look once the content program has run. Fictional on purpose:
 *    invented answers and a life story must not be attached to a real person.
 *  - Example specialties on a few real listings. These are milder, and each is
 *    taken from that professional's own published bio rather than invented —
 *    but they are applied only where nothing is recorded, and still need the
 *    professional to confirm them.
 */
export async function seedDemoProfile(db: Db): Promise<boolean> {
  if (process.env.DEMO_PROFILE !== '1') return false;

  await applyExampleSpecialties(db);

  let raw: any;
  try {
    raw = JSON.parse(readFileSync(join(process.cwd(), 'data', 'demo-profile.json'), 'utf8'));
  } catch {
    return false;
  }

  const existing = await db.query<{ id: string }>(
    'SELECT id FROM professionals WHERE email = ?', [raw.email],
  );
  if (existing.length) return false;

  const { profileContent, socialLinks, _comment, ...rest } = raw;
  await new ProfessionalRepository(db).receiveApplication({
    ...rest,
    status: 'published',
    hub: `${String(raw.city).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${String(raw.state).toLowerCase()}`,
    profileContent: JSON.stringify(profileContent),
    socialLinks: socialLinks ? JSON.stringify(socialLinks) : undefined,
    appliedAt: new Date().toISOString(),
  } as any);
  return true;
}

async function applyExampleSpecialties(db: Db): Promise<void> {
  let map: Record<string, unknown> = {};
  try {
    map = JSON.parse(readFileSync(join(process.cwd(), 'data', 'demo-specialties.json'), 'utf8'));
  } catch {
    return;
  }
  for (const [wpId, list] of Object.entries(map)) {
    if (wpId.startsWith('_')) continue;
    const specialties = sanitizeSpecialties(list as string[]);
    if (!specialties.length) continue;
    await db.run(
      "UPDATE professionals SET specialties = ? WHERE email = ?" +
      " AND (specialties IS NULL OR specialties = '')",
      [specialties.join(', '), `legacy-${wpId}@needs-email.vesta.invalid`],
    );
  }
}
