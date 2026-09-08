import Link from 'next/link';
import { loadDirectory, hubsWithCounts, CATEGORY_LABELS } from '../src/data/vestaImport.ts';
import { buildPages } from '../src/directory/pageModel.ts';
import type { PracticeCategory } from '../src/pricing/catalog.ts';

export default function DirectoryHome() {
  const all = loadDirectory();
  // Professionals with no coordinates have no hub, so they cannot appear on a
  // city page. They must never become an "unplaced" URL — they are a data
  // problem to fix, surfaced below, not a place a consumer can browse.
  const unplaced = all.filter((r) => r.hub === 'unplaced');
  const records = all.filter((r) => r.hub !== 'unplaced');
  const hubs = hubsWithCounts(records);
  const pages = buildPages(
    records.map((r) => ({
      id: r.id, hub: r.hub, category: r.category, tier: r.tier, contentCount: r.contentCount,
    })),
    () => false,
  );

  const byHub = new Map<string, typeof pages>();
  for (const p of pages) {
    byHub.set(p.hub, [...(byHub.get(p.hub) ?? []), p]);
  }
  const label = (h: string) => hubs.find((x) => x.hub === h)?.label ?? h;
  const indexable = pages.filter((p) => p.state === 'publish').length;

  return (
    <>
      <header className="top">
        <div className="in">
          <Link href="/" className="logo">VESTA</Link>
        </div>
      </header>

      <div className="hero">
        <div className="in">
          <h1>Find a divorce professional near you.</h1>
          <p>
            Every professional here has been interviewed and vetted by Vesta. Choose where you
            are and what you need — then read, watch and listen before you ever pick up the phone.
          </p>
        </div>
      </div>

      <div className="wrap">
        <div className="notice">
          <b>This is the live Vesta directory data, not demo content.</b> {records.length} placeable
          professionals across {hubs.length} places. Pages exist only where somebody actually
          practises — <b>{indexable} are indexable</b> and the rest are reachable but marked
          noindex until they have content or a second professional. {17 * 6 - pages.length} empty
          combinations were never created as URLs at all.
        </div>

        {unplaced.length > 0 && (
          <div className="notice" style={{
            borderColor: '#e3b8b8', background: '#fdf2f2', color: '#7a2f2f',
          }}>
            <b>{unplaced.length} professionals cannot be placed anywhere.</b> They have no location
            in the source data, so no consumer can find them today and they appear on no page here
            either: {unplaced.map((r) => r.name).join(', ')}. Fixing their addresses is a migration
            task, not a code change.
          </div>
        )}

        {[...byHub.entries()]
          .sort((a, b) => b[1].length - a[1].length || label(a[0]).localeCompare(label(b[0])))
          .map(([hub, hubPages]) => (
            <section key={hub} style={{ marginBottom: 26 }}>
              <h2 style={{ fontSize: 17, letterSpacing: '-.02em', margin: '0 0 10px' }}>
                {label(hub)}
                <span style={{ color: 'var(--ink3)', fontWeight: 400, fontSize: 13.5, marginLeft: 10 }}>
                  {hubs.find((x) => x.hub === hub)?.count} professional
                  {hubs.find((x) => x.hub === hub)?.count === 1 ? '' : 's'}
                </span>
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {hubPages.map((p) => (
                  <Link
                    key={p.url}
                    href={p.url}
                    style={{
                      textDecoration: 'none',
                      background: p.state === 'publish' ? 'var(--card)' : 'transparent',
                      border: `1px solid ${p.state === 'publish' ? 'var(--br)' : 'var(--line2)'}`,
                      borderStyle: p.state === 'publish' ? 'solid' : 'dashed',
                      borderRadius: 10, padding: '10px 14px', fontSize: 13.6,
                      color: p.state === 'publish' ? 'var(--acc2)' : 'var(--ink3)',
                      fontWeight: p.state === 'publish' ? 680 : 500,
                    }}
                  >
                    {CATEGORY_LABELS[p.category as PracticeCategory]}
                    <span style={{ marginLeft: 8, fontSize: 11.6, opacity: .75 }}>
                      {p.professionals} · {p.state === 'publish' ? 'indexable' : 'noindex'}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
      </div>
    </>
  );
}
