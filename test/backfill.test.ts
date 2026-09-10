import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openTestDb } from '../src/db/index.ts';
import { backfillLegacyProfessionals } from '../src/professionals/backfill.ts';
import { loadLegacyExcerpts } from '../src/data/vestaImport.ts';

const profiles = JSON.parse(readFileSync('data/legacy-profiles.json', 'utf8'));
const photos = JSON.parse(readFileSync('data/legacy-photos.json', 'utf8'));
const excerpts = loadLegacyExcerpts();
// Two real legacy ids that have both imported copy and a photo.
const [staleId, editedId] = Object.keys(profiles).filter((k) => photos[k] && excerpts.get(k));

async function insert(db: any, wpId: string, fields: Record<string, string | null>) {
  const row = {
    id: `pro-${wpId}`, status: 'published', tier: 'standard', first_name: 'T',
    email: `legacy-${wpId}@needs-email.vesta.invalid`, category: 'family-law',
    created_at: '2026-09-01T00:00:00Z', ...fields,
  };
  const cols = Object.keys(row);
  await db.run(`INSERT INTO professionals (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    Object.values(row));
  return row.id;
}

describe('bringing an old production database up to date', () => {
  test('a row seeded before the import gets the real bio, website and photo', async () => {
    const db = await openTestDb();
    const id = await insert(db, staleId, {
      // Exactly what production holds: the excerpt, a link back to the old
      // site, and a photo hotlinked from it.
      bio: excerpts.get(staleId)!,
      website: 'https://vestadivorce.com/2020/06/04/someone/',
      photo_url: 'https://vestadivorce.com/wp-content/uploads/x-150x150.jpg',
    });

    await backfillLegacyProfessionals(db);
    const [row] = await db.query<any>('SELECT * FROM professionals WHERE id = ?', [id]);

    assert.ok(!String(row.website ?? '').includes('vestadivorce.com'), 'no link back to the old site');
    assert.equal(row.bio, profiles[staleId].bio, 'the full biography replaces the excerpt');
    assert.equal(row.photo_url, `/api/photo/${id}`, 'photo served locally, not hotlinked');
    assert.equal(row.legacy_url, profiles[staleId].legacyUrl, 'old URL kept for the redirect map');
    const [photo] = await db.query<any>('SELECT * FROM professional_photos WHERE professional_id = ?', [id]);
    assert.ok(photo, 'the photo bytes are stored');
    await db.close();
  });

  test('anything edited since is left exactly as it is', async () => {
    const db = await openTestDb();
    const id = await insert(db, editedId, {
      bio: 'Rewritten by the concierge desk.',
      website: 'https://their-corrected-site.example',
      photo_url: '/api/photo/uploaded-by-them',
    });

    await backfillLegacyProfessionals(db);
    const [row] = await db.query<any>('SELECT * FROM professionals WHERE id = ?', [id]);

    assert.equal(row.bio, 'Rewritten by the concierge desk.');
    assert.equal(row.website, 'https://their-corrected-site.example');
    assert.equal(row.photo_url, '/api/photo/uploaded-by-them');
    await db.close();
  });

  test('running on every boot changes nothing the second time', async () => {
    const db = await openTestDb();
    await insert(db, staleId, {
      bio: excerpts.get(staleId)!,
      website: 'https://vestadivorce.com/2020/06/04/someone/',
      photo_url: 'https://vestadivorce.com/wp-content/uploads/x.jpg',
    });
    assert.equal((await backfillLegacyProfessionals(db)).updated, 1);
    assert.equal((await backfillLegacyProfessionals(db)).updated, 0);
    await db.close();
  });

  test('the render guard recognizes every form of a link into the old site', async () => {
    const { isLegacyVestaUrl } = await import('../src/data/vestaImport.ts');
    for (const u of ['https://vestadivorce.com/2020/06/04/lisa-cukier/',
      'http://www.vestadivorce.com/x', 'vestadivorce.com/x']) {
      assert.equal(isLegacyVestaUrl(u), true, u);
    }
    for (const u of ['https://www.ligris.com/attorney/x/', 'https://notvestadivorce.com.example/', undefined]) {
      assert.equal(isLegacyVestaUrl(u), false, String(u));
    }
  });
});

describe('supplied specialties for legacy listings', () => {
  test('they are applied as given, replacing earlier example values', async () => {
    const db = await openTestDb();
    const id = await insert(db, '13893', { specialties: 'Divorce & Family Law Attorney, Old Example' });
    await backfillLegacyProfessionals(db);
    const [row] = await db.query<any>('SELECT specialties FROM professionals WHERE id = ?', [id]);
    assert.equal(row.specialties,
      'Family Law, Divorce Negotiation, Divorce Litigation, Trust & Estate Planning');
    await db.close();
  });

  test('a second run changes nothing', async () => {
    const db = await openTestDb();
    await insert(db, '13893', {});
    await backfillLegacyProfessionals(db);
    const second = await backfillLegacyProfessionals(db);
    const [row] = await db.query<any>(
      "SELECT specialties FROM professionals WHERE email = 'legacy-13893@needs-email.vesta.invalid'");
    assert.ok(row.specialties.startsWith('Family Law'));
    assert.equal(second.updated, 0);
    await db.close();
  });
});
