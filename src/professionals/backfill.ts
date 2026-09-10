import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Db } from '../db/client.ts';
import { isLegacyVestaUrl, loadLegacyExcerpts } from '../data/vestaImport.ts';

/**
 * Bring professionals seeded before the legacy import up to date.
 *
 * The seed only adds people who are not already in the database, so a database
 * filled before the real bios, websites and photos were imported keeps the old
 * values forever: a one-line excerpt, a "website" that is really a link back to
 * vestadivorce.com, and a photo hotlinked from the old site. Production is that
 * database.
 *
 * Each field is replaced only while it still holds the original imported value.
 * A bio edited in the back office, a website a professional corrected, a photo
 * they uploaded themselves — all left alone. Safe to run on every boot.
 */
export async function backfillLegacyProfessionals(db: Db): Promise<{ updated: number }> {
  const read = (f: string) => {
    try { return JSON.parse(readFileSync(join(process.cwd(), 'data', f), 'utf8')); } catch { return {}; }
  };
  const profiles: Record<string, { bio?: string; website?: string; legacyUrl?: string }> =
    read('legacy-profiles.json');
  const photos: Record<string, { mime: string; bytes: string; byteSize: number }> =
    read('legacy-photos.json');
  let excerpts = new Map<string, string>();
  try { excerpts = loadLegacyExcerpts(); } catch { /* no export — bios are left alone */ }

  // Legacy rows carry their WordPress id in their placeholder email.
  const rows = await db.query<{
    id: string; email: string; bio: string | null; website: string | null;
    photo_url: string | null; legacy_url: string | null;
  }>(
    "SELECT id, email, bio, website, photo_url, legacy_url FROM professionals" +
    " WHERE email LIKE 'legacy-%@needs-email.vesta.invalid'",
  );

  let updated = 0;
  for (const row of rows) {
    const wpId = row.email.slice('legacy-'.length, row.email.indexOf('@'));
    const p = profiles[wpId];
    const sets: string[] = [];
    const params: unknown[] = [];

    // Website: replace only the link back to the old site (or nothing).
    if (!row.website || isLegacyVestaUrl(row.website)) {
      const next = p?.website && !isLegacyVestaUrl(p.website) ? p.website : null;
      if (next !== row.website) { sets.push('website = ?'); params.push(next); }
    }

    // Bio: replace only if it is still the one-line excerpt it was seeded with.
    const excerpt = excerpts.get(wpId);
    const untouched = !row.bio || (excerpt !== undefined && row.bio.trim() === excerpt.trim());
    if (p?.bio && untouched && row.bio !== p.bio) { sets.push('bio = ?'); params.push(p.bio); }

    if (!row.legacy_url && p?.legacyUrl) { sets.push('legacy_url = ?'); params.push(p.legacyUrl); }

    // Photo: replace only a hotlink to the old site (or none), never an upload.
    const photo = photos[wpId];
    if (photo && (!row.photo_url || isLegacyVestaUrl(row.photo_url))) {
      await db.run(
        'INSERT INTO professional_photos (professional_id, mime, bytes, byte_size, uploaded_at)' +
        ' VALUES (?, ?, ?, ?, ?) ON CONFLICT (professional_id) DO NOTHING',
        [row.id, photo.mime, photo.bytes, photo.byteSize, new Date().toISOString()],
      );
      sets.push('photo_url = ?'); params.push(`/api/photo/${row.id}`);
    }

    if (sets.length) {
      params.push(row.id);
      await db.run(`UPDATE professionals SET ${sets.join(', ')} WHERE id = ?`, params);
      updated++;
    }
  }
  return { updated };
}
