import type { Db } from '../db/client.ts';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadDirectory } from '../data/vestaImport.ts';
import { ProfessionalRepository } from './repository.ts';

/**
 * Move the legacy WP Store Locator export into the professionals table.
 *
 * These 38 are already live on vestadivorce.com, so they come in as
 * `published` — putting existing paying members into a review queue would take
 * them off the internet while somebody clicked through them.
 *
 * Runs once. It skips anyone already in the table, so a redeploy cannot
 * resurrect a professional who has since been declined or edited.
 */
export async function seedLegacyProfessionals(db: Db): Promise<{ added: number; skipped: number }> {
  const repo = new ProfessionalRepository(db);
  const existing = await db.query<{ email: string }>('SELECT email FROM professionals');
  const known = new Set(existing.map((r) => r.email.toLowerCase()));

  /**
   * Headshots lifted off the old site.
   *
   * Stored locally so a listing does not go blank the day vestadivorce.com
   * changes, and taken from a larger crop than the 150px thumbnail the export
   * linked, which was soft at the size the cards render.
   */
  let photos: Record<string, { mime: string; bytes: string; byteSize: number }> = {};
  try {
    photos = JSON.parse(readFileSync(join(process.cwd(), 'data', 'legacy-photos.json'), 'utf8'));
  } catch {
    // Not imported; listings fall back to whatever the record already had.
  }

  let added = 0;
  let skipped = 0;

  for (const r of loadDirectory()) {
    // Every one of the 38 geocoded records carries the same placeholder,
    // email@email.com, so matching on email would collapse the whole directory
    // into a single professional. Legacy records are keyed by their WordPress
    // id instead, and given an address that is obviously not real so nobody
    // mistakes it for one and emails it.
    const email = usableEmail(r.email) ?? `legacy-${r.id}@needs-email.vesta.invalid`;
    if (known.has(email)) { skipped++; continue; }

    try {
      await repo.receiveApplication({
      status: r.hub === 'unplaced' ? 'approved' : 'published',
      tier: r.tier,
      firstName: r.name.split(' ')[0] ?? r.name,
      lastName: r.name.split(' ').slice(1).join(' '),
      email,
      // Recorded so the back office can show who still needs chasing.
      // The legacy export carries the role as free text where credentials
      // belong; it is the best we have until each is confirmed.
      credentials: r.roleLabel || undefined,
      company: r.firm || undefined,
      bio: r.bio || undefined,
      photoUrl: r.photo,
      website: r.website,
      city: r.city || undefined,
      state: r.state || undefined,
      hub: r.hub === 'unplaced' ? undefined : r.hub,
      category: r.category,
      occupation: r.roleLabel || undefined,
      schedulerUrl: r.schedulerUrl,
      legacyUrl: r.legacyUrl,
      appliedAt: new Date().toISOString(),
      } as any);
      known.add(email);
      added++;

      const photo = photos[r.id];
      if (photo) {
        const [row] = await db.query<{ id: string }>(
          'SELECT id FROM professionals WHERE email = ?', [email],
        );
        if (row) {
          await db.run(
            'INSERT INTO professional_photos' +
            ' (professional_id, mime, bytes, byte_size, uploaded_at)' +
            ' VALUES (?, ?, ?, ?, ?)',
            [row.id, photo.mime, photo.bytes, photo.byteSize, new Date().toISOString()],
          );
          await db.run('UPDATE professionals SET photo_url = ? WHERE id = ?',
            [`/api/photo/${row.id}`, row.id]);
        }
      }
    } catch {
      // Another process seeded this one first. The unique index on email is
      // what makes that safe, and losing the race is not an error.
      skipped++;
    }
  }

  return { added, skipped };
}

/**
 * Placeholders that appear in the export in place of a real address.
 *
 * Treating these as real would put one shared inbox on 38 listings and route
 * every professional's leads to the same place.
 */
const PLACEHOLDER_EMAILS = new Set([
  'email@email.com', 'test@test.com', 'name@email.com',
  'info@example.com', 'noreply@example.com',
]);

export function usableEmail(raw: string | undefined): string | undefined {
  const email = (raw ?? '').trim().toLowerCase();
  if (!email || !email.includes('@')) return undefined;
  return PLACEHOLDER_EMAILS.has(email) ? undefined : email;
}
