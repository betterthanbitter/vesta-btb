import { NextResponse } from 'next/server';
import { getDb } from '../../../../src/leads/store.ts';

/** Serves a stored headshot. Cached hard — the bytes never change per id. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = await getDb();
  const rows = await db.query<{ mime: string; bytes: string }>(
    'SELECT mime, bytes FROM professional_photos WHERE professional_id = ?', [id],
  );
  if (!rows.length) return new NextResponse('Not found', { status: 404 });

  return new NextResponse(Buffer.from(rows[0].bytes, 'base64'), {
    headers: {
      'content-type': rows[0].mime,
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}
