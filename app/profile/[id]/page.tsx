import Link from 'next/link';
import { notFound } from 'next/navigation';
import ConsultCta from '../../../components/ConsultCta.tsx';
import { loadPublishedDirectory } from '../../../src/professionals/directory.ts';
import { getDb } from '../../../src/leads/store.ts';
import { CATEGORY_LABELS } from '../../../src/data/vestaImport.ts';
import { ENTITLEMENTS } from '../../../src/directory/tiers.ts';
import { parseSchedulerLink } from '../../../src/directory/schedulerLink.ts';
import { SPECIALTY_GROUPS } from '../../../src/professionals/specialties.ts';
import type { PracticeCategory } from '../../../src/pricing/catalog.ts';

export const revalidate = 120;
export const dynamicParams = true;

export async function generateStaticParams() {
  const all = await loadPublishedDirectory(await getDb());
  return all.map((r) => ({ id: r.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = (await loadPublishedDirectory(await getDb())).find((x) => x.id === id);
  if (!r) return {};
  const where = [r.city, r.state].filter(Boolean).join(', ');
  return {
    title: `${r.name}${r.roleLabel ? `, ${r.roleLabel}` : ''} — ${where} | Vesta`,
    description: r.bio
      ? r.bio.slice(0, 155)
      : `${r.profession ?? 'Divorce professional'} in ${where}, vetted by Vesta.`,
  };
}

/** Specialties, kept in the taxonomy's own grouping so a long list stays readable. */
function groupSpecialties(chosen: string[]) {
  return SPECIALTY_GROUPS
    .map((g) => ({ name: g.name, items: g.items.filter((i) => chosen.includes(i)) }))
    .filter((g) => g.items.length > 0);
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
}

export default async function Profile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const all = await loadPublishedDirectory(await getDb());
  const r = all.find((x) => x.id === id);
  if (!r) notFound();

  const e = ENTITLEMENTS[r.tier];
  const scheduler = parseSchedulerLink(r.schedulerUrl);
  const where = [r.city, r.state].filter(Boolean).join(', ');
  const grouped = groupSpecialties(r.specialties);
  const states = (r.statesLicensed ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const backToDirectory = r.hub !== 'unplaced' ? `/${r.hub}/${r.category}` : '/';

  return (
    <>
      <header className="ptop">
        <div className="in">
          <Link href="/" className="logo">VESTA</Link>
          <div className="pname">
            {r.name}{r.roleLabel ? <span>, {r.roleLabel}</span> : null}
          </div>
          <span className="verified">Vetted by Vesta</span>
          <span className="sp" />
          <ConsultCta
            professionalId={r.id}
            firstName={r.name.split(' ')[0]}
            schedulerHost={scheduler?.host}
            sourcePath={`/profile/${r.id}`}
            variant="primary"
          />
        </div>
      </header>

      <section className="phero">
        <div className="in">
          <div className="pgrid">
            <div>
              <div className="eyebrow">{r.profession ?? CATEGORY_LABELS[r.category as PracticeCategory]}</div>
              <h1>{r.name}</h1>
              <div className="psub">
                {r.firm && <>{r.firm} · </>}{where}
              </div>
              {r.bio && <p className="plede">{r.bio}</p>}

              <div className="pfacts">
                {r.roleLabel && <span className="fact">{r.roleLabel}</span>}
                {states.length > 0 && (
                  <span className="fact">
                    Licensed in {states.length > 6 ? `${states.length} states` : states.join(', ')}
                  </span>
                )}
                {r.phone && <span className="fact"><a href={`tel:${r.phone}`}>{r.phone}</a></span>}
                {r.website && (
                  <span className="fact">
                    <a href={r.website} target="_blank" rel="noopener noreferrer nofollow">
                      {r.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                    </a>
                  </span>
                )}
              </div>
            </div>

            <div className="pportrait">
              {r.photo
                ? <img src={r.photo} alt={r.name} />
                : <div className="pinitials">{initials(r.name)}</div>}
            </div>
          </div>
        </div>
      </section>

      <div className="wrap" style={{ maxWidth: 1080 }}>
        <section className="pblock">
          <div className="stitle">What {r.name.split(' ')[0]} handles</div>
          {grouped.length === 0 ? (
            <p className="pmuted">
              No specialties recorded yet. {r.profession ? `Listed as ${r.profession}.` : ''}
            </p>
          ) : (
            <>
              <p className="pintro">
                The specific matters {r.name.split(' ')[0]} works on — worth reading before you
                call, so you know whether they are the right fit.
              </p>
              <div className="specshow">
                {grouped.map((g) => (
                  <div className="specshowgroup" key={g.name}>
                    <h3>{g.name}</h3>
                    <ul>{g.items.map((i) => <li key={i}>{i}</li>)}</ul>
                  </div>
                ))}
              </div>
              {r.specialtyOther && (
                <p className="pmuted" style={{ marginTop: 12 }}>Also: {r.specialtyOther}</p>
              )}
            </>
          )}
        </section>

        {e.contentLibrary && (
          <section className="pblock">
            <div className="stitle">Read, watch and listen</div>
            {r.contentCount === 0 ? (
              <p className="pmuted">
                {r.name.split(' ')[0]}’s content library is in production. Webinars, podcast
                episodes and articles will appear here.
              </p>
            ) : (
              <p className="pintro">{r.contentCount} pieces of content.</p>
            )}
          </section>
        )}

        <section className="pclose">
          <h2>Talk to {r.name.split(' ')[0]}</h2>
          <p>
            {scheduler
              ? 'Book a time directly, or ask for one that suits you better.'
              : `${r.name.split(' ')[0]} arranges consultations directly — leave your details and they will be in touch.`}
          </p>
          <div className="pctas">
            <ConsultCta
              professionalId={r.id}
              firstName={r.name.split(' ')[0]}
              schedulerHost={scheduler?.host}
              sourcePath={`/profile/${r.id}`}
              variant="primary"
            />
          </div>
        </section>

        <p className="pback">
          <Link href={backToDirectory}>
            ← All {CATEGORY_LABELS[r.category as PracticeCategory]?.toLowerCase()} in {where}
          </Link>
        </p>
      </div>
    </>
  );
}
