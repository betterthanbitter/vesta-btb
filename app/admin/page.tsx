import Link from 'next/link';
import LeadCard from '../../components/LeadCard.tsx';
import RouteLeadForm from '../../components/RouteLeadForm.tsx';
import { getDb } from '../../src/leads/store.ts';
import { LeadRepository } from '../../src/db/leadRepository.ts';
import { CATEGORY_LABELS, hubsWithCounts } from '../../src/data/vestaImport.ts';
import { loadPublishedDirectory } from '../../src/professionals/directory.ts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Vesta — Concierge', robots: { index: false, follow: false } };

export default async function BackOffice() {
  const directory = (await loadPublishedDirectory(await getDb())).filter((d) => d.hub !== 'unplaced');
  const repo = new LeadRepository(await getDb());
  const leads = await repo.all();
  const needingReview = await repo.ledger().needingReview();

  const nameOf = (id: string) => directory.find((d) => d.id === id)?.name ?? id;
  const open = leads.filter(
    (l) => !['hired', 'dead_lead'].includes(l.stage),
  );
  const cold = open.filter((l) => l.daysSinceActivity >= 7);
  const untouched = open.filter((l) => l.stage === 'new');

  return (
    <>
      <header className="hubtop" style={{ background: 'var(--acc2)' }}>
        <div className="in">
          <Link href="/" className="logo">VESTA</Link>
          <span className="hubwho">Concierge · Back office</span>
          <span className="sp" />
          <Link href="/hub/leads" style={{ color: '#fff', fontSize: 13.5, opacity: .85 }}>
            Professional view →
          </Link>
        </div>
      </header>

      <div className="wrap" style={{ maxWidth: 1040 }}>
        <h1 style={{ fontSize: 27, letterSpacing: '-.03em', margin: '0 0 4px' }}>Leads</h1>
        <p style={{ color: 'var(--ink2)', fontSize: 14.5, margin: '0 0 22px' }}>
          Everything the network has received — from the directory and from the concierge desk.
          Take a call below and route it.
        </p>

        <div className="stats">
          <div><b>{leads.length}</b><span>Total</span></div>
          <div><b>{untouched.length}</b><span>Not yet contacted</span></div>
          <div data-warn={cold.length ? '1' : undefined}>
            <b>{cold.length}</b><span>Cold — 7+ days</span>
          </div>
          <div data-warn={needingReview.length ? '1' : undefined}>
            <b>{needingReview.length}</b><span>Sends to check</span>
          </div>
        </div>

        {needingReview.length > 0 && (
          <div className="notice" style={{ borderColor: '#e3b8b8', background: '#fdf2f2', color: '#7a2f2f' }}>
            <b>{needingReview.length} email sends could not be confirmed.</b> The delivery engine
            was called but did not answer, so we cannot tell whether it went out. Nothing is
            retried automatically — a duplicate to someone mid-divorce is worse than a late one.
            Check these by hand in Ontraport.
          </div>
        )}

        <RouteLeadForm
          professionals={directory.map((d) => ({
            id: d.id,
            label: `${d.name}${d.roleLabel ? ` — ${d.roleLabel}` : ''}`,
            hub: d.hub,
            hubLabel: `${d.city}, ${d.state}`,
            category: d.category,
            categoryLabel: CATEGORY_LABELS[d.category],
            tier: d.tier,
          }))}
          hubs={hubsWithCounts(directory).map((h) => ({ value: h.hub, label: h.label }))}
        />

        <h2 className="sect">All leads</h2>
        {leads.length === 0 && (
          <div className="empty"><b>Nothing yet.</b><br />
            Route one above, or wait for the directory to send one.</div>
        )}
        {leads.map((l) => (
          <LeadCard key={`${l.referralId}:${l.professionalId}`} lead={l}
            showWho={`with ${nameOf(l.professionalId)}`} />
        ))}
      </div>
    </>
  );
}
