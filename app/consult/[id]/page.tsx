import Link from 'next/link';
import { notFound } from 'next/navigation';
import LeadCapture from '../../../components/LeadCapture.tsx';
import { loadPublishedDirectory } from '../../../src/professionals/directory.ts';
import { getDb } from '../../../src/leads/store.ts';
import { parseSchedulerLink } from '../../../src/directory/schedulerLink.ts';
import { ENTITLEMENTS } from '../../../src/directory/tiers.ts';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
}

/**
 * The capture page every "Schedule Free Consult" leads to.
 *
 * It shows who the consumer is about to contact, so the step does not feel
 * like a toll gate on the way to a calendar. Instant booking is offered on the
 * far side of the form for professionals who have a link.
 */
export default async function ConsultPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const r = (await loadPublishedDirectory(await getDb())).find((x) => x.id === id);
  if (!r) notFound();

  const scheduler = ENTITLEMENTS[r.tier].instantBook ? parseSchedulerLink(r.schedulerUrl) : null;
  const first = r.name.split(' ')[0];
  const where = [r.city, r.state].filter(Boolean).join(', ');
  const back = from && from.startsWith('/') && !from.startsWith('//') ? from : `/profile/${r.id}`;

  return (
    <>
      <header className="ptop">
        <div className="in">
          <Link href="/" className="logo">VESTA</Link>
          <span className="sp" />
          <Link href={back} style={{ fontSize: 13.5, color: 'var(--acc)', textDecoration: 'none' }}>
            ← Back
          </Link>
        </div>
      </header>

      <div className="capturepage">
        <div className="capwho">
          {r.photo
            ? <img src={r.photo} alt={r.name} />
            : <div className="capinitials">{initials(r.name)}</div>}
          <div>
            <div className="capname">{r.name}</div>
            {r.roleLabel && <div className="caprole">{r.roleLabel}</div>}
            <div className="capwhere">{r.firm ? `${r.firm} · ` : ''}{where}</div>
            <Link className="caplink" href={`/profile/${r.id}`}>Read their full profile →</Link>
          </div>
        </div>

        <LeadCapture
          professionalId={r.id}
          firstName={first}
          schedulerHost={scheduler?.host}
          sourcePath={back}
        />
      </div>
    </>
  );
}
