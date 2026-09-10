import type { Db } from '../db/client.ts';
import type { DirectoryRecord } from '../data/vestaImport.ts';
import { ProfessionalRepository } from './repository.ts';
import type { PracticeCategory } from '../pricing/catalog.ts';
import type { Tier } from '../directory/tiers.ts';
import { countLibrary, parseProfileContent } from './profileContent.ts';

/**
 * The published directory, read from the database.
 *
 * Replaces reading the WordPress export directly, so an application approved
 * in the back office appears on the public site — one system rather than two
 * sources of truth that slowly disagree.
 */
/**
 * Imported bios end with the old site's link text and contact lines — "Click
 * here to learn more about Lisa Email: … Tel: …". The link goes nowhere now,
 * and a phone number or email in the bio lets a consumer skip the consult
 * form, which is the one place a lead is captured. Everything from the first
 * of those markers on is dropped.
 */
export function cleanBio(bio: string | undefined): string {
  if (!bio) return '';
  const cut = bio.search(/\bClick here\b|\bEmail:\s|\bTel:\s|\bPhone:\s/i);
  return (cut === -1 ? bio : bio.slice(0, cut)).replace(/[ \t]+/g, ' ').trim();
}

export async function loadPublishedDirectory(db: Db): Promise<DirectoryRecord[]> {
  const rows = await new ProfessionalRepository(db).published();
  return rows.map((p) => ({
    id: p.id,
    name: [p.firstName, p.lastName].filter(Boolean).join(' '),
    roleLabel: p.credentials ?? '',
    firm: p.company ?? '',
    bio: cleanBio(p.bio),
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
    contentCount: countLibrary(parseProfileContent(p.profileContent)),
    webinars: 0,
    podcasts: 0,
    articles: 0,
    schedulerUrl: p.schedulerUrl,
    profession: p.occupation,
    specialties: (p.specialties ?? '').split(',').map((x) => x.trim()).filter(Boolean),
    specialtyOther: p.specialtyOther,
    statesLicensed: p.statesLicensed,
    linkedin: p.linkedin,
    headline: p.headline,
    profileContent: p.profileContent,
    socialLinks: p.socialLinks,
    invisibleOnMap: !p.hub,
  }));
}
