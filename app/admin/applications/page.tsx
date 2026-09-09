import Link from 'next/link';
import { decideApplication } from '../../actions.ts';
import { getDb } from '../../../src/leads/store.ts';
import { ProfessionalRepository, type ProfessionalRow } from '../../../src/professionals/repository.ts';
import { CATEGORY_LABELS } from '../../../src/data/vestaImport.ts';
import type { PracticeCategory } from '../../../src/pricing/catalog.ts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Applications — Vesta', robots: { index: false, follow: false } };

function Card({ p }: { p: ProfessionalRow }) {
  const facts: Array<[string, string | undefined]> = [
    ['Profession', p.occupation],
    ['Category', CATEGORY_LABELS[p.category as PracticeCategory] ?? p.category],
    ['Firm', p.company],
    ['Credentials', p.credentials],
    ['Phone', p.phone],
    ['Location', [p.city, p.state].filter(Boolean).join(', ') || undefined],
    ['Licensed in', p.statesLicensed],
    ['Program', p.program],
    ['Came via', p.partnerName ? `${p.partnerName} (reseller)` : 'Direct'],
    ['Group slots', p.groupSlots],
  ].filter((f): f is [string, string] => Boolean(f[1]));

  return (
    <div className="lead">
      <div className="leadmain">
        <div className="leadtop">
          <span className="leadname">{p.firstName} {p.lastName}</span>
          <span className={`pill pill-${p.status}`}>{p.status}</span>
          {!p.hub && (
            <span className="pill pill-did_not_respond">
              No city or state — cannot be placed on a page
            </span>
          )}
        </div>
        <div className="leadmeta">
          <a href={`mailto:${p.email}`}>{p.email}</a>
          {p.website && <> · <a href={p.website} target="_blank" rel="noopener noreferrer nofollow">
            {p.website.replace(/^https?:\/\//, '')}</a></>}
        </div>

        <div className="brief">
          <dl>{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        </div>
        {p.bio && <p className="leadmsg">{p.bio}</p>}
      </div>

      {p.status !== 'published' && p.status !== 'declined' && (
        <form action={decideApplication} className="decide">
          <input type="hidden" name="id" value={p.id} />
          <label>
            Tier
            <select name="tier" defaultValue={p.tier}>
              <option value="standard">Standard</option>
              <option value="premium">Premium</option>
              <option value="platinum">Platinum</option>
            </select>
          </label>
          <button type="submit" name="decision" value="publish" className="won"
            disabled={!p.hub} title={p.hub ? undefined : 'Needs a city and state first'}>
            Approve &amp; publish
          </button>
          <button type="submit" name="decision" value="decline" className="dead">Decline</button>
        </form>
      )}
    </div>
  );
}

export default async function Applications() {
  const repo = new ProfessionalRepository(await getDb());
  const [applied, published, declined, counts] = await Promise.all([
    repo.byStatus('applied'), repo.byStatus('published'),
    repo.byStatus('declined'), repo.counts(),
  ]);

  return (
    <>
      <header className="hubtop" style={{ background: 'var(--acc2)' }}>
        <div className="in">
          <Link href="/" className="logo">VESTA</Link>
          <span className="hubwho">Concierge · Applications</span>
          <span className="sp" />
          <Link href="/admin" style={{ color: '#fff', fontSize: 13.5, opacity: .85 }}>Leads →</Link>
        </div>
      </header>

      <div className="wrap" style={{ maxWidth: 1040 }}>
        <h1 style={{ fontSize: 27, letterSpacing: '-.03em', margin: '0 0 4px' }}>
          Professional applications
        </h1>
        <p style={{ color: 'var(--ink2)', fontSize: 14.5, margin: '0 0 22px', maxWidth: '70ch' }}>
          Straight from the application form. Nothing appears in the public directory until it is
          approved here — every professional is reviewed and vetted, and that has to be true in
          the system, not only in an inbox.
        </p>

        <div className="stats">
          <div data-warn={applied.length ? '1' : undefined}>
            <b>{applied.length}</b><span>Waiting for review</span>
          </div>
          <div><b>{counts.published ?? 0}</b><span>Published</span></div>
          <div><b>{counts.approved ?? 0}</b><span>Approved, not live</span></div>
          <div><b>{counts.declined ?? 0}</b><span>Declined</span></div>
        </div>

        {applied.length === 0 && (
          <div className="empty"><b>Nothing waiting.</b><br />
            New applications arrive here automatically from the application form.</div>
        )}

        {applied.length > 0 && <h2 className="sect">Waiting for review</h2>}
        {applied.map((p) => <Card key={p.id} p={p} />)}

        {published.length > 0 && <h2 className="sect">Published</h2>}
        {published.map((p) => <Card key={p.id} p={p} />)}

        {declined.length > 0 && <h2 className="sect">Declined</h2>}
        {declined.map((p) => <Card key={p.id} p={p} />)}
      </div>
    </>
  );
}
