import Link from 'next/link';
import type { DirectoryRecord } from '../src/data/vestaImport.ts';
import { CATEGORY_LABELS } from '../src/data/vestaImport.ts';
import { ENTITLEMENTS, type Tier } from '../src/directory/tiers.ts';
import { orderForPage } from '../src/directory/pageModel.ts';
import { parseSchedulerLink } from '../src/directory/schedulerLink.ts';
import ConsultCta from './ConsultCta.tsx';
import type { PracticeCategory } from '../src/pricing/catalog.ts';

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
}

/**
 * The content strip.
 *
 * Counts are real, and today they are zero because nothing has been produced
 * yet. The buttons still render live rather than greyed out: a paying member's
 * listing should look like the finished article when the page is being shown
 * to someone, and a row of dimmed controls reads as broken rather than empty.
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

/** Which Platinum frame the directory uses. One place to change it. */
export const PLATINUM_FRAME: 'gold' | 'teal' | 'navy' | 'edge' = 'gold';

function Platinum({
  r, place, frame = PLATINUM_FRAME,
}: { r: DirectoryRecord; place: string; frame?: string }) {
  const scheduler = parseSchedulerLink(r.schedulerUrl);
  return (
    <div className="card plat" data-frame={frame}>
      <div className="ribbon">Platinum Member</div>
      <div className="pbody">
        <div className="mediacol">
          {r.introVideo ? (
            <div className="vid mediafill">
              {/* A poster frame goes here once one exists; the portrait crop is
                  deliberate, so the face is large on the page. */}
              {r.photo && <img className="vposter" src={r.photo} alt="" />}
              <div className="play"><i /></div>
              <div className="vlab">
                <span>Meet {r.name.split(' ')[0]}</span>
                <span className="vdur">{r.introVideo}</span>
              </div>
            </div>
          ) : (
            <div className="vid vempty mediafill">
              Introduction video not produced yet — included at Platinum
            </div>
          )}
          <div className="vcap">Video introduction — Platinum only</div>
        </div>
        <div>
          <div className="pn">{r.name}</div>
          {r.roleLabel && <div className="pcr">{r.roleLabel}</div>}
          <div className="pfirm">{r.firm ? `${r.firm} · ` : ''}{place}</div>
          {r.bio && <p className="pbio">{r.bio}</p>}
          <div className="chips">
            {/* The profession, not the category. What they call themselves is
                more use to a consumer scanning a page than the heading that
                page already sits under. Specialties live on the profile. */}
            {r.profession && <span className="chip">{r.profession}</span>}
            {r.specialties.length > 0 && (
              <span className="chip muted">
                {r.specialties.length} {r.specialties.length === 1 ? 'specialty' : 'specialties'}
              </span>
            )}
            <span className="chip ev">★ Hosts live Vesta events</span>
          </div>
          <ContentStrip r={r} />
        </div>
      </div>
      <div className="pfoot">
        <Link className="prof" href={`/profile/${r.id}`}>View full profile →</Link>
        <ConsultCta
          professionalId={r.id}
          firstName={r.name.split(' ')[0]}
          schedulerHost={scheduler?.host}
          sourcePath={`/${r.hub}/${r.category}`}
        />
      </div>
    </div>
  );
}

function Premium({ r, place }: { r: DirectoryRecord; place: string }) {
  const scheduler = parseSchedulerLink(r.schedulerUrl);
  return (
    <div className="card prem">
      <div className="tierlab">Premium Member</div>
      <div className="pbody">
        <div className="mediacol">
          {r.photo
            ? <img className="avatar mediafill" src={r.photo} alt={r.name} />
            : <div className="avatar mediafill">{initials(r.name)}</div>}
        </div>
        <div>
          <div className="pn">{r.name}</div>
          {r.roleLabel && <div className="pcr">{r.roleLabel}</div>}
          <div className="pfirm">{r.firm ? `${r.firm} · ` : ''}{place}</div>
          {r.bio && <p className="pbio">{r.bio}</p>}
          <div className="chips">
            {r.profession && <span className="chip">{r.profession}</span>}
            {r.specialties.length > 0 && (
              <span className="chip muted">
                {r.specialties.length} {r.specialties.length === 1 ? 'specialty' : 'specialties'}
              </span>
            )}
          </div>
          <ContentStrip r={r} />
        </div>
      </div>
      <div className="pfoot">
        <Link className="prof" href={`/profile/${r.id}`}>View profile →</Link>
        <ConsultCta
          professionalId={r.id}
          firstName={r.name.split(' ')[0]}
          schedulerHost={scheduler?.host}
          sourcePath={`/${r.hub}/${r.category}`}
        />
      </div>
    </div>
  );
}

function Listings({ rows, place }: { rows: DirectoryRecord[]; place: string }) {
  return (
    <div className="lwrap">
      <div className="lhead">
        Standard Members in {place} — {rows.length}
      </div>
      {rows.map((r) => (
        <div className="lrow" key={r.id}>
          {r.photo
            ? <img className="lphoto" src={r.photo} alt={r.name} loading="lazy" />
            : <div className="lini">{initials(r.name)}</div>}
          <div>
            <div className="ln">{r.name}</div>
            <div className="lc">{r.profession || r.roleLabel}</div>
          </div>
          <div className="lf">{r.firm || <span style={{ color: 'var(--ink3)' }}>—</span>}</div>
          <div className="lh">{place}</div>
          <Link className="llink" href={`/profile/${r.id}`}>Contact →</Link>
        </div>
      ))}
    </div>
  );
}

export { Platinum, Premium };

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
      {standard.length > 0 && <Listings rows={standard} place={place} />}
    </>
  );
}
