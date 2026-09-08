import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { loadDirectory } from '../../../src/data/vestaImport.ts';
import { validateConsultRequest } from '../../../src/leads/consultRequest.ts';
import { getConsultRequestStore } from '../../../src/leads/store.ts';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Malformed request.' }, { status: 400 });
  }

  const result = validateConsultRequest(body as any);
  if (!result.ok) {
    return NextResponse.json({ errors: result.errors }, { status: 422 });
  }

  // The professional must exist. Otherwise this endpoint is a way to write
  // arbitrary rows into the lead table.
  const professional = loadDirectory().find((r) => r.id === result.value.professionalId);
  if (!professional) {
    return NextResponse.json({ message: 'Unknown professional.' }, { status: 404 });
  }

  try {
    await getConsultRequestStore().record({
      ...result.value,
      id: randomUUID(),
      at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[consult-request] failed to record', err);
    return NextResponse.json(
      { message: 'We could not save that just now. Please try again.' },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true });
}
