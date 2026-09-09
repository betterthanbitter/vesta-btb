import Link from 'next/link';
import LeadCard from '../../../components/LeadCard.tsx';
import { getDb } from '../../../src/leads/store.ts';
import { LeadRepository } from '../../../src/db/leadRepository.ts';
import { loadDirectory } from '../../../src/data/vestaImport.ts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your leads — Vesta', robots: { index: false, follow: false } };

export default async function LeadDashboard({
  searchParams,
}: { searchParams: Promise<{ as?: string }> }) {
  const { as } = await searchParams;
  const directory = loadDirectory();
  // Until sign-in exists, who you are is a query parameter. See the note below.
  const me = directory.find((d) => d.id === as) ?? directory.find((d) => d.id === '13285')!;

  const leads = await new LeadRepository(await getDb()).forProfessional(me.id);
  const open = leads.filter((l) => !['hired', 'dead_lead'].includes(l.stage));
  const isNew = open.filter((l) => l.stage === 'new');
  const won = leads.filter((l) => l.stage === 'hired');
  const cold = open.filter((l) => l.daysSinceActivity >= 7);

  return (
    <>
      <header className="hubtop">
        <div className="in">
          <Link href="/" className="logo">VESTA</Link>
          <span className="hubwho">Professional Hub</span>
          <span className="sp" />
          <span className="hubname">{me.name}</span>
          <span className={`tierbadge t-${me.tier}`}>{me.tier}</span>
        </div>
      </header>

      <div className="wrap" style={{ maxWidth: 900 }}>
        <h1 style={{ fontSize: 27, letterSpacing: '-.03em', margin: '0 0 4px' }}>Your leads</h1>
        <p style={{ color: 'var(--ink2)', fontSize: 14.5, margin: '0 0 22px' }}>
          People who asked to speak to you. Free with every membership — you are never charged
          per lead.
        </p>

        <div className="stats">
          <div><b>{isNew.length}</b><span>New</span></div>
          <div><b>{open.length - isNew.length}</b><span>In progress</span></div>
          <div><b>{won.length}</b><span>Retained</span></div>
          <div data-warn={cold.length ? '1' : undefined}>
            <b>{cold.length}</b><span>Need chasing</span>
          </div>
        </div>

        {leads.length === 0 && (
          <div className="empty" style={{ marginTop: 20 }}>
            <b>No leads yet.</b><br />
            When someone asks for a consultation through your listing, they appear here.
          </div>
        )}

        {open.length > 0 && <h2 className="sect">Open</h2>}
        {open.map((l) => <LeadCard key={l.referralId} lead={l} />)}

        {leads.length > open.length && <h2 className="sect">Closed</h2>}
        {leads.filter((l) => !open.includes(l)).map((l) => (
          <LeadCard key={l.referralId} lead={l} />
        ))}

        {process.env.REVIEW_NAV === '1' && (
          <div className="notice" style={{ marginTop: 28 }}>
            <b>Internal — there is no sign-in yet.</b> Which professional you are is taken from
            the URL, so anyone could view anyone. That is the next decision: a magic link by
            email, a password you issue, or Circle SSO. View as:{' '}
            {directory.slice(0, 6).map((d) => (
              <span key={d.id}>
                <Link href={`/hub/leads?as=${d.id}`}>{d.name.split(' ')[0]}</Link>{' '}
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
