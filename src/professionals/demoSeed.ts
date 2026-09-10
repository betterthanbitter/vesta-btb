import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Db } from '../db/client.ts';
import { ProfessionalRepository } from './repository.ts';

/**
 * Demonstration content, seeded only when DEMO_PROFILE=1 so none of it
 * appears at launch.
 *
 * A fictional professional with a full profile, so the page can be shown as it
 * will look once the content program has run. Fictional on purpose: invented
 * answers and a life story must not be attached to a real person. (Real
 * listings' specialties come from data/specialty-overrides.json, applied on
 * every startup by the backfill, not from here.)
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
