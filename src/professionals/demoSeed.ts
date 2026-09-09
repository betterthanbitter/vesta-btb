import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Db } from '../db/client.ts';
import { ProfessionalRepository } from './repository.ts';

/**
 * A fictional professional with a full profile, so the page can be shown as it
 * will look once the content program has run.
 *
 * Fictional on purpose. Putting invented answers, quotes and a life story into
 * a real professional's page — even on a private preview — misrepresents
 * somebody who never agreed to it. The firm reads "SAMPLE LISTING" for the
 * same reason.
 *
 * Seeded only when DEMO_PROFILE=1, so it never appears at launch.
 */
export async function seedDemoProfile(db: Db): Promise<boolean> {
  if (process.env.DEMO_PROFILE !== '1') return false;

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

  const { profileContent, _comment, ...rest } = raw;
  await new ProfessionalRepository(db).receiveApplication({
    ...rest,
    status: 'published',
    hub: `${String(raw.city).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${String(raw.state).toLowerCase()}`,
    profileContent: JSON.stringify(profileContent),
    appliedAt: new Date().toISOString(),
  } as any);
  return true;
}
