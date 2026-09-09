import type { Db } from '../db/client.ts';
import type { DirectoryRecord } from '../data/vestaImport.ts';
import { ProfessionalRepository } from './repository.ts';
import type { PracticeCategory } from '../pricing/catalog.ts';
import type { Tier } from '../directory/tiers.ts';

/**
 * The published directory, read from the database.
 *
 * Replaces reading the WordPress export directly, so an application approved
 * in the back office appears on the public site — one system rather than two
 * sources of truth that slowly disagree.
 */
export async function loadPublishedDirectory(db: Db): Promise<DirectoryRecord[]> {
  const rows = await new ProfessionalRepository(db).published();
  return rows.map((p) => ({
    id: p.id,
    name: [p.firstName, p.lastName].filter(Boolean).join(' '),
    roleLabel: p.credentials ?? '',
    firm: p.company ?? '',
    bio: p.bio ?? '',
    city: p.city ?? '',
    state: p.state ?? '',
    hub: p.hub ?? 'unplaced',
    category: p.category as PracticeCategory,
    allCategories: [p.category as PracticeCategory],
    email: p.email,
    website: p.website,
    phone: p.phone,
    photo: p.photoUrl,
    tier: p.tier as Tier,
    contentCount: 0,
    webinars: 0,
    podcasts: 0,
    articles: 0,
    schedulerUrl: p.schedulerUrl,
    profession: p.occupation,
    specialties: (p.specialties ?? '').split(',').map((x) => x.trim()).filter(Boolean),
    specialtyOther: p.specialtyOther,
    statesLicensed: p.statesLicensed,
    linkedin: p.linkedin,
    invisibleOnMap: !p.hub,
  }));
}
