import Link from 'next/link';
import Finder from '../components/Finder.tsx';
import DirectoryResults from '../components/DirectoryResults.tsx';
import TierExplainer from '../components/TierExplainer.tsx';
import { loadDirectory, hubsWithCounts, CATEGORY_LABELS } from '../src/data/vestaImport.ts';
import type { PracticeCategory } from '../src/pricing/catalog.ts';

/** Where the finder starts, matching the prototype. */
const DEFAULT_HUB = 'boston-ma';
const DEFAULT_CATEGORY: PracticeCategory = 'family-law';

export default function DirectoryHome() {
  const all = loadDirectory();
  const placeable = all.filter((r) => r.hub !== 'unplaced');
  const hubs = hubsWithCounts(placeable);
  const here = placeable.filter(
    (r) => r.hub === DEFAULT_HUB && r.allCategories.includes(DEFAULT_CATEGORY),
  );
  const place = hubs.find((h) => h.hub === DEFAULT_HUB)?.label ?? DEFAULT_HUB;

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
        <DirectoryResults records={here} category={DEFAULT_CATEGORY} place={place} />
        <TierExplainer />
      </div>
    </>
  );
}
