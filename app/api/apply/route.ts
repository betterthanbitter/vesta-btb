import { NextResponse, type NextRequest } from 'next/server';
import { validateUnifiedApplication } from '../../../src/professionals/unifiedApplication.ts';
import { ProfessionalRepository } from '../../../src/professionals/repository.ts';
import { getDb } from '../../../src/leads/store.ts';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Malformed request.' }, { status: 400 });
  }

  const result = validateUnifiedApplication(body as any);
  if (!result.ok) return NextResponse.json({ errors: result.errors }, { status: 422 });
  const v = result.value;

  try {
    const repo = new ProfessionalRepository(await getDb());
    const { id, isNew } = await repo.receiveApplication({
      // Applied, never published. The tier they chose is what they are
      // applying for, not what they have been granted — the seat may be taken,
      // and every professional is reviewed before they appear.
      status: 'applied',
      tier: v.tier,
      firstName: v.firstName, lastName: v.lastName, email: v.email, phone: v.phone,
      credentials: v.credentials, company: v.company, bio: v.bio,
      photoUrl: v.photoUrl, website: v.website, linkedin: v.linkedin,
      street: v.street, city: v.city, state: v.state, zip: v.zip,
      hub: v.hub, statesLicensed: v.statesLicensed,
      occupation: v.profession, category: v.category,
      specialties: v.specialties.join(', '),
      specialtyOther: v.specialtyOther,
      headline: v.headline,
      socialLinks: Object.keys(v.socialLinks).length ? JSON.stringify(v.socialLinks) : undefined,
      signupPath: v.signupPath, partnerName: v.partnerName,
      program: v.tier === 'standard' ? undefined : 'Directory tier application',
      affiliateOptin: v.affiliateOptin ? 'yes' : 'no',
      schedulerUrl: v.schedulerUrl,
      appliedAt: new Date().toISOString(),
    } as any);

    // Store the headshot and point the listing at it. Written after the
    // professional exists so there is always a row to attach it to.
    if (v.photo) {
      const db = await getDb();
      await db.run('DELETE FROM professional_photos WHERE professional_id = ?', [id]);
      await db.run(
        'INSERT INTO professional_photos' +
        ' (professional_id, mime, bytes, byte_size, width, height, uploaded_at)' +
        ' VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, v.photo.mime, v.photo.base64, v.photo.byteSize,
         v.photo.width ?? null, v.photo.height ?? null, new Date().toISOString()],
      );
      await db.run('UPDATE professionals SET photo_url = ? WHERE id = ?',
        [`/api/photo/${id}`, id]);
    }

    if (v.affiliateOptin) {
      await (await getDb()).run(
        'UPDATE professionals SET paypal_email = ?, channel_type = ?, channel_url = ?,' +
        ' audience = ? WHERE id = ?',
        [v.paypalEmail ?? null, v.channelType ?? null, v.channelUrl ?? null,
         v.audience ?? null, id],
      );
    }

    return NextResponse.json({ ok: true, id, isNew }, { status: isNew ? 201 : 200 });
  } catch (err) {
    console.error('[apply] failed', err);
    return NextResponse.json({ message: 'We could not save that. Please try again.' }, { status: 503 });
  }
}
