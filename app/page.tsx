import Link from 'next/link';
import Finder from '../components/Finder.tsx';
import DirectoryResults from '../components/DirectoryResults.tsx';
import InternalNote from '../components/InternalNote.tsx';
import { hubsWithCounts, CATEGORY_LABELS } from '../src/data/vestaImport.ts';
import { loadPublishedDirectory } from '../src/professionals/directory.ts';
import { getDb } from '../src/leads/store.ts';
import type { PracticeCategory } from '../src/pricing/catalog.ts';

/** Where the finder starts, matching the prototype. */
const DEFAULT_HUB = 'boston-ma';
const DEFAULT_CATEGORY: PracticeCategory = 'family-law';

/**
 * Rendered per request rather than pre-rendered at build.
 *
 * Everything else that reads the database is already on demand; leaving the
 * home page pre-rendered would keep a deploy dependent on the database being
 * up, for the sake of caching one cheap list. An approval in the back office
 * also shows here immediately instead of after a revalidation window.
 */
export const dynamic = 'force-dynamic';

export default async function DirectoryHome() {
  const all = await loadPublishedDirectory(await getDb());
  const placeable = all.filter((r) => r.hub !== 'unplaced');
  const hubs = hubsWithCounts(placeable);
  const here = placeable.filter(
    (r) => r.hub === DEFAULT_HUB && r.allCategories.includes(DEFAULT_CATEGORY),
  );
  const place = hubs.find((h) => h.hub === DEFAULT_HUB)?.label ?? DEFAULT_HUB;
  // Records with no coordinates have no hub, so they appear on no page at all.
  const unplaced = all.filter((r) => r.hub === 'unplaced');

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
            hub={DEFAULT_HUB}
            category={DEFAULT_CATEGORY}
            hubs={hubs.map((h) => ({ value: h.hub, label: h.label, count: h.count }))}
            categories={Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))}
          />
        </div>
      </div>

      <div className="wrap">
        {unplaced.length > 0 && (
          <InternalNote tone="warn">
            <b>{unplaced.length} professionals cannot be placed anywhere.</b> They have no location
            in the source data, so no consumer can find them today and they appear on no page
            here either: {unplaced.map((r) => r.name).join(', ')}. Fixing their addresses is a
            migration task, not a code change.
          </InternalNote>
        )}
        <DirectoryResults records={here} category={DEFAULT_CATEGORY} place={place} />
      </div>
    </>
  );
}
