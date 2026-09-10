import Link from 'next/link';
import type { DirectoryRecord } from '../src/data/vestaImport.ts';
import { CATEGORY_LABELS } from '../src/data/vestaImport.ts';
import { ENTITLEMENTS, type Tier } from '../src/directory/tiers.ts';
import { orderForPage } from '../src/directory/pageModel.ts';
import ScheduleCta from './ScheduleCta.tsx';
import type { PracticeCategory } from '../src/pricing/catalog.ts';

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
}

/**
 * The content strip. Counts are real (zero until content is produced) but the
 * buttons render live: a paying member's listing should look finished when the
 * page is being shown to someone.
 */
function ContentStrip({ r }: { r: DirectoryRecord }) {
  const kinds = [
    { icon: '🎬', label: 'Watch Webinars', n: r.webinars },
    { icon: '🎙', label: 'Watch / Listen Podcasts', n: r.podcasts },
    { icon: '📝', label: 'Articles', n: r.articles },
  ];
  return (
    <div className="cstrip">
      {kinds.map((k) => (
        <button key={k.label} className="cbtn">
          {k.icon} {k.label} <span className="n">{k.n}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * The description on a directory card: eight lines for Platinum and Premium,
 * two for Standard, then "More…" to the full profile — where the same text
 * opens in place. The card stays a card instead of a biography.
 */
function Description({ r, lines }: { r: DirectoryRecord; lines: 2 | 8 }) {
  if (!r.bio) return null;
  const flow = r.bio.replace(/\s*\n+\s*/g, ' ');
  return (
    <div className="pdesc">
      <p className={`pbio clamp${lines}`}>{flow}</p>
      <Link className="moretext" href={`/profile/${r.id}`}>More…</Link>
    </div>
  );
}

/**
 * The picture. One fixed size for all three levels — video for Platinum, photo
 * for Premium and Standard — so a Standard member is not visibly smaller, and
 * a long description cannot stretch the image down the page.
 */
function Media({ r, video }: { r: DirectoryRecord; video: boolean }) {
  if (video) {
    return (
      <div className="mediacol">
        <div className="vid mediafill">
          {r.photo && <img className="vposter" src={r.photo} alt="" />}
          <div className="play"><i /></div>
          <div className="vlab">
            <span>Meet {r.name.split(' ')[0]}</span>
            {r.introVideo && <span className="vdur">{r.introVideo}</span>}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="mediacol">
      {r.photo
        ? <img className="avatar mediafill" src={r.photo} alt={r.name} />
        : <div className="avatar mediafill">{initials(r.name)}</div>}
    </div>
  );
}

function Heading({ r, place }: { r: DirectoryRecord; place: string }) {
  return (
    <>
      <div className="pn">{r.name}</div>
      {r.roleLabel && <div className="pcr">{r.roleLabel}</div>}
      <div className="pfirm">{r.firm ? `${r.firm} · ` : ''}{place}</div>
    </>
  );
}

function Chips({ r, events }: { r: DirectoryRecord; events?: boolean }) {
  return (
    <div className="chips">
      {r.profession && <span className="chip">{r.profession}</span>}
      {r.specialties.length > 0 && (
        <span className="chip muted">
          {r.specialties.length} {r.specialties.length === 1 ? 'specialty' : 'specialties'}
        </span>
      )}
      {events && <span className="chip ev">★ Hosts live Vesta events</span>}
    </div>
  );
}

function Footer({ r }: { r: DirectoryRecord }) {
  return (
    <div className="pfoot">
      <Link className="prof" href={`/profile/${r.id}`}>View full profile →</Link>
      <ScheduleCta professionalId={r.id} from={`/${r.hub}/${r.category}`} variant="ghost" />
    </div>
  );
}

/** Which Platinum frame the directory uses. One place to change it. */
export const PLATINUM_FRAME: 'gold' | 'teal' | 'navy' | 'edge' = 'gold';

function Platinum({
  r, place, frame = PLATINUM_FRAME,
}: { r: DirectoryRecord; place: string; frame?: string }) {
  return (
    <div className="card plat" data-frame={frame}>
      <div className="ribbon">Platinum Member</div>
      <div className="pbody">
        <div className="phead"><Heading r={r} place={place} /></div>
        <Media r={r} video />
        <div className="pmain">
          <Description r={r} lines={8} />
          <Chips r={r} events />
          <ContentStrip r={r} />
        </div>
      </div>
      <Footer r={r} />
    </div>
  );
}

function Premium({ r, place }: { r: DirectoryRecord; place: string }) {
  return (
    <div className="card prem">
      <div className="tierlab">Premium Member</div>
      <div className="pbody">
        <div className="phead"><Heading r={r} place={place} /></div>
        <Media r={r} video={false} />
        <div className="pmain">
          <Description r={r} lines={8} />
          <Chips r={r} />
          <ContentStrip r={r} />
        </div>
      </div>
      <Footer r={r} />
    </div>
  );
}

function Standard({ r, place }: { r: DirectoryRecord; place: string }) {
  return (
    <div className="card std">
      <div className="tierlab">Standard Member</div>
      <div className="pbody">
        <div className="phead"><Heading r={r} place={place} /></div>
        <Media r={r} video={false} />
        <div className="pmain">
          <Description r={r} lines={2} />
          <Chips r={r} />
        </div>
      </div>
      <Footer r={r} />
    </div>
  );
}

export { Platinum, Premium, Standard };

export default function DirectoryResults({
  records, category, place,
}: { records: DirectoryRecord[]; category: PracticeCategory; place: string }) {
  const catLabel = CATEGORY_LABELS[category];
  const ordered = orderForPage(
    records.map((r) => ({
      id: r.id, hub: r.hub, category: r.category, tier: r.tier, contentCount: r.contentCount,
    })),
    (t: Tier) => ENTITLEMENTS[t].placementWeight,
  ).map((o) => records.find((r) => r.id === o.id)!);

  const platinum = ordered.filter((r) => r.tier === 'platinum');
  const premium = ordered.filter((r) => r.tier === 'premium');
  const standard = ordered.filter((r) => r.tier === 'standard');

  return (
    <>
      <div className="rhead">
        <h2>{catLabel} in {place}</h2>
        <span className="rcount">
          {records.length} professional{records.length === 1 ? '' : 's'}
        </span>
      </div>

      {records.length === 0 && (
        <div className="empty">
          <b>No professionals listed here yet.</b><br />
          Try another location, or ask the concierge to find someone for you.
        </div>
      )}

      {platinum.map((r) => <Platinum key={r.id} r={r} place={place} />)}

      {platinum.length === 0 && records.length > 0 && (
        <div className="seat">
          <h4>The Platinum seat for {catLabel} in {place} is open</h4>
          <p>
            Nobody holds the exclusive position in this category and city.{' '}
            {records.length === 1 ? (
              <>With <b>one professional here</b>, exclusivity currently excludes nobody — this
              is a recruiting job before it is a sale.</>
            ) : (
              <><b>{records.length} candidates</b> could hold it. A consumer arriving here sees no
              video, no library and no host.</>
            )}
          </p>
        </div>
      )}

      {premium.map((r) => <Premium key={r.id} r={r} place={place} />)}
      {standard.map((r) => <Standard key={r.id} r={r} place={place} />)}
    </>
  );
}
