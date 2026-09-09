import Link from 'next/link';
import { notFound } from 'next/navigation';
import Finder from '../../../components/Finder.tsx';
import DirectoryResults from '../../../components/DirectoryResults.tsx';
import InternalNote from '../../../components/InternalNote.tsx';
import { hubsWithCounts, CATEGORY_LABELS } from '../../../src/data/vestaImport.ts';
import { loadPublishedDirectory } from '../../../src/professionals/directory.ts';
import { getDb } from '../../../src/leads/store.ts';
import { classify } from '../../../src/directory/pageModel.ts';
import type { PracticeCategory } from '../../../src/pricing/catalog.ts';

/**
 * Pages are revalidated rather than frozen at build time, so approving an
 * application publishes it without waiting for a deploy. Unknown combinations
 * are still rendered on demand and 404 if nobody is there.
 */
export const revalidate = 120;
export const dynamicParams = true;

export async function generateStaticParams() {
  const seen = new Set<string>();
  const all = await loadPublishedDirectory(await getDb());
  return all
    .filter((r) => r.hub !== 'unplaced')
    .flatMap((r) => r.allCategories.map((c) => ({ hub: r.hub, category: c })))
    .filter((p) => !seen.has(`${p.hub}/${p.category}`) && seen.add(`${p.hub}/${p.category}`));
}

export async function generateMetadata(
  { params }: { params: Promise<{ hub: string; category: string }> },
) {
  const { hub, category } = await params;
  const all = (await loadPublishedDirectory(await getDb())).filter(
    (r) => r.hub === hub && r.allCategories.includes(category as PracticeCategory),
  );
  if (!all.length) return {};
  const place = `${all[0].city}, ${all[0].state}`;
  const label = CATEGORY_LABELS[category as PracticeCategory];
  const { state } = classify(all.length, all.reduce((n, r) => n + r.contentCount, 0));
  return {
    title: `${label} in ${place} — Vesta`,
    description: `Interviewed and vetted ${label.toLowerCase()} professionals in ${place}.`,
    // Thin pages stay reachable but are kept out of the index.
    robots: state === 'publish' ? undefined : { index: false, follow: true },
  };
}

export default async function CategoryPage(
  { params }: { params: Promise<{ hub: string; category: string }> },
) {
  const { hub, category } = await params;
  if (hub === 'unplaced') notFound();

  const all = (await loadPublishedDirectory(await getDb())).filter((r) => r.hub !== 'unplaced');
  const here = all.filter(
    (r) => r.hub === hub && r.allCategories.includes(category as PracticeCategory),
  );
  if (!here.length) notFound();

  const hubs = hubsWithCounts(all);
  const place = hubs.find((h) => h.hub === hub)?.label ?? hub;
  const { state, reason } = classify(here.length, here.reduce((n, r) => n + r.contentCount, 0));

  return (
    <>
      <header className="top">
        <div className="in">
          <Link href="/" className="logo">VESTA</Link>
          <div className="nav">
            <a href="/" className="on">Find a Professional</a>
            <a href="#">Events</a>
            <a href="#">Resource Library</a>
            <a href="#">For Professionals</a>
          </div>
          <div className="sp" />
          <button className="navcta">Talk to a concierge</button>
        </div>
      </header>

      <div className="hero">
        <div className="in">
          <h1>Find a divorce professional near you.</h1>
          <p>
            Every professional here has been interviewed and vetted by Vesta. Choose where you are
            and what you need — then read, watch and listen before you ever pick up the phone.
          </p>
          <Finder
            hub={hub}
            category={category}
            hubs={hubs.map((h) => ({ value: h.hub, label: h.label, count: h.count }))}
            categories={Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))}
          />
        </div>
      </div>

      <div className="wrap">
        <InternalNote>
          Serving <code style={{
            background: '#fff', border: '1px solid var(--gold-br)', borderRadius: 6,
            padding: '2px 8px',
          }}>/{hub}/{category}/</code>
          {' · '}
          <b>{state === 'publish' ? 'indexable' : 'noindex'}</b> — {reason}
        </InternalNote>
        <DirectoryResults records={here} category={category as PracticeCategory} place={place} />
      </div>
    </>
  );
}
