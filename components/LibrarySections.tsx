import type { Shelf } from '../src/professionals/profileContent.ts';

/**
 * The three library sections every profile shows.
 *
 * Fixed rather than driven by whatever shelves happen to exist, so the page
 * has the same shape for everybody and a consumer learns where to look. An
 * empty section says what will be there rather than disappearing — a
 * professional halfway through their first quarter should look like someone
 * whose content is coming, not someone with none.
 */
const SECTIONS = [
  {
    title: 'Webinars',
    icon: '🎬',
    /** Shelf names in the stored content that belong under this heading. */
    matches: ['webinars', 'workshops'],
    empty: 'A fully produced webinar every quarter — a deck built for them, recorded and edited, with a companion download.',
  },
  {
    title: 'Podcast Episodes',
    icon: '🎙',
    matches: ['podcast episodes', 'podcasts', 'short clips'],
    empty: 'Guest episodes on the Better Than Bitter™ Divorce Podcast, recorded with the founder.',
  },
  {
    title: 'Resources & Articles',
    icon: '📝',
    matches: ['free downloads', 'written pieces', 'articles', 'resources', 'downloads'],
    empty: 'Worksheets, checklists and written pieces — free to read and download, no sign-up.',
  },
];

export default function LibrarySections({
  first, shelves, showLibrary,
}: { first: string; shelves: Shelf[]; showLibrary: boolean }) {
  // A Standard member has no content programme at all, so the section would be
  // a permanent promise rather than a placeholder.
  if (!showLibrary) return null;

  return (
    <section id="library" className="pblock">
      <div className="in">
        <div className="stitle">The library</div>
        <h2>Everything {first} makes, free to read, watch and listen to.</h2>
        <p className="ssub">
          Produced with {first} under the Vesta content program. The same pieces appear on their
          own page, in the Vesta Resource Library, and on their listing.
        </p>

        {SECTIONS.map((section) => {
          const items = shelves
            .filter((s) => section.matches.includes(s.name.trim().toLowerCase()))
            .flatMap((s) => s.items);

          return (
            <div className="shelf" key={section.title}>
              <div className="shh">
                <h3><span className="shicon">{section.icon}</span> {section.title}</h3>
                <span className="n">{items.length}</span>
              </div>

              {items.length === 0 ? (
                <div className="shelfempty">
                  <p>{section.empty}</p>
                  <span>In production — this fills up as pieces are published.</span>
                </div>
              ) : (
                items.map((it) => (
                  <div className="item" key={it.title}>
                    <h4>{it.title}</h4>
                    {it.meta && <div className="m">{it.meta}</div>}
                    {it.summary && <p>{it.summary}</p>}
                    {it.actions?.length ? (
                      <div className="acts">
                        {it.actions.map((a, i) => (
                          <button key={a} className={i === 0 ? 'pri' : undefined}>{a}</button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
