import Link from 'next/link';
import { notFound } from 'next/navigation';
import ExpandableBio from '../../../components/ExpandableBio.tsx';
import LeadCapture from '../../../components/LeadCapture.tsx';
import LibrarySections from '../../../components/LibrarySections.tsx';
import SocialLinksRow from '../../../components/SocialLinks.tsx';
import { loadPublishedDirectory } from '../../../src/professionals/directory.ts';
import { getDb } from '../../../src/leads/store.ts';
import { CATEGORY_LABELS } from '../../../src/data/vestaImport.ts';
import { ENTITLEMENTS } from '../../../src/directory/tiers.ts';
import { parseSchedulerLink } from '../../../src/directory/schedulerLink.ts';
import { SPECIALTY_GROUPS } from '../../../src/professionals/specialties.ts';
import { parseProfileContent } from '../../../src/professionals/profileContent.ts';
import { parseSocialLinks } from '../../../src/professionals/social.ts';
import type { PracticeCategory } from '../../../src/pricing/catalog.ts';

/**
 * Rendered on demand and cached, rather than pre-rendered at build time.
 *
 * generateStaticParams would connect to the database during the build — from
 * several parallel workers at once — which couples deploying to the database
 * being up, reachable and not mid-migration. Nothing is gained: these pages
 * revalidate every two minutes anyway, so a build-time snapshot is stale
 * almost immediately. The first visitor after a deploy renders the page; the
 * rest get it from cache.
 */
export const revalidate = 120;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = (await loadPublishedDirectory(await getDb())).find((x) => x.id === id);
  if (!r) return {};
  const where = [r.city, r.state].filter(Boolean).join(', ');
  return {
    title: `${r.name}${r.roleLabel ? `, ${r.roleLabel}` : ''} — ${where} | Vesta`,
    description: (r.headline ?? r.bio ?? `${r.profession ?? 'Divorce professional'} in ${where}.`)
      .slice(0, 155),
  };
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
}

function groupSpecialties(chosen: string[]) {
  return SPECIALTY_GROUPS
    .map((g) => ({ name: g.name, items: g.items.filter((i) => chosen.includes(i)) }))
    .filter((g) => g.items.length > 0);
}

export default async function Profile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = (await loadPublishedDirectory(await getDb())).find((x) => x.id === id);
  if (!r) notFound();

  const e = ENTITLEMENTS[r.tier];
  const c = parseProfileContent(r.profileContent);
  const scheduler = parseSchedulerLink(r.schedulerUrl);
  const social = parseSocialLinks(r.socialLinks);
  const first = r.name.split(' ')[0];
  const where = [r.city, r.state].filter(Boolean).join(', ');
  const states = (r.statesLicensed ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const grouped = groupSpecialties(r.specialties);
  const library = c.shelves ?? [];
  const libraryCount = library.reduce((n, s) => n + s.items.length, 0);
  const back = r.hub !== 'unplaced' ? `/${r.hub}/${r.category}` : '/';

  /* The proof bar shows only numbers that are real. A row of zeroes is worse
     than no row — it advertises an empty profile. */
  const proof = [
    c.questions?.length ? { v: c.questions.length, k: 'Questions answered in full, free' } : null,
    states.length ? { v: states.length, k: 'States licensed to practice in' } : null,
    libraryCount ? { v: libraryCount, k: 'Pieces to read, watch and listen to' } : null,
    grouped.length ? { v: r.specialties.length, k: 'Specialties' } : null,
    c.books?.length ? { v: c.books.length, k: 'Books published' } : null,
  ].filter(Boolean).slice(0, 4) as { v: number; k: string }[];

  return (
    <>
      <header className="ptop">
        <div className="in">
          <Link href="/" className="logo">VESTA</Link>
          <div className="pname">{r.name}{r.roleLabel ? <span>, {r.roleLabel}</span> : null}</div>
          <span className="verified">Verified · Vesta network</span>
          <span className="sp" />
          <a className="prof" href="#talk">Schedule Free Consult</a>
        </div>
      </header>

      <section className="phero">
        <div className="in">
          <div className="pgrid">
            <div>
              <div className="eyebrow">
                {r.profession ?? CATEGORY_LABELS[r.category as PracticeCategory]}
              </div>
              <h1>{r.headline ?? r.name}</h1>
              {r.headline && <div className="pwho">{r.name}</div>}
              <div className="psub">{r.firm && <>{r.firm} · </>}{where}</div>
              {(c.lede ?? r.bio) && <ExpandableBio text={c.lede ?? r.bio} name={r.name} />}

              <div className="hactions">
                <a className="prof" href="#talk">Schedule Free Consult</a>
                {c.questions?.length
                  ? <a className="ghost" href="#answers">Start with the questions</a>
                  : grouped.length
                    ? <a className="ghost" href="#specialties">See what {first} handles</a>
                    : null}
              </div>

              <div className="pfacts">
                {r.roleLabel && <span className="fact">{r.roleLabel}</span>}
                {states.length > 0 && (
                  <span className="fact">
                    Licensed in {states.length > 6 ? `${states.length} states` : states.join(', ')}
                  </span>
                )}
                {where && <span className="fact">{where}</span>}
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
              {r.photo ? <img src={r.photo} alt={r.name} />
                : <div className="pinitials">{initials(r.name)}</div>}
            </div>
          </div>
        </div>
      </section>

      {proof.length > 0 && (
        <div className="proof">
          <div className="in">
            {proof.map((p) => (
              <div className="pf" key={p.k}><div className="v">{p.v}</div><div className="k">{p.k}</div></div>
            ))}
          </div>
        </div>
      )}

      {c.questions?.length ? (
        <section id="answers" className="pblock">
          <div className="in">
            <div className="stitle">Start here</div>
            <h2>Questions {first} is asked most, answered properly.</h2>
            <p className="ssub">
              Not a blog. These are the questions that come up in a first meeting, with the answer
              they would actually give you. <b>Read them before you decide whether to call.</b>
            </p>
            <div className="qa">
              {c.questions.map((q, i) => (
                <details key={q.question} open={i === 0}>
                  <summary>{q.question}</summary>
                  <div className="ans">
                    {q.answer}
                    {q.source && <div className="src">From {q.source}</div>}
                  </div>
                </details>
              ))}
            </div>
            {c.quote && (
              <blockquote className="quote">
                <p>{c.quote.text}</p>
                {c.quote.attribution && <cite>{c.quote.attribution}</cite>}
              </blockquote>
            )}
          </div>
        </section>
      ) : null}

      <LibrarySections first={first} shelves={library} showLibrary={e.contentLibrary} />

      <section id="specialties" className="pblock">
        <div className="in">
          <div className="stitle">What {first} handles</div>
          {grouped.length === 0 ? (
            <p className="pmuted">
              No specialties recorded yet{r.profession ? ` — listed as ${r.profession}` : ''}.
            </p>
          ) : (
            <>
              <h2>The specific matters {first} works on.</h2>
              <p className="ssub">
                Worth reading before you call, so you know whether they are the right fit.
              </p>
              <div className="specshow">
                {grouped.map((g) => (
                  <div className="specshowgroup" key={g.name}>
                    <h3>{g.name}</h3>
                    <ul>{g.items.map((i) => <li key={i}>{i}</li>)}</ul>
                  </div>
                ))}
              </div>
              {r.specialtyOther && <p className="pmuted" style={{ marginTop: 14 }}>Also: {r.specialtyOther}</p>}
            </>
          )}
        </div>
      </section>


      {c.stat && (
        <section className="pblock">
          <div className="in">
            <div className="stitle">One number</div>
            <div className="statbox">
              <p className="c">{c.stat.claim}</p>
              {c.stat.source && <div className="s">{c.stat.source}</div>}
            </div>
          </div>
        </section>
      )}

      {(c.about?.length || c.books?.length) && (
        <section className="pblock">
          <div className="in">
            <div className="stitle">About</div>
            <h2>Why {first} does this work.</h2>
            <div className="about">
              <div>{c.about?.map((p, i) => <p key={i}>{p}</p>)}</div>
              {c.books?.length ? (
                <aside className="books">
                  <h4>Books</h4>
                  <ul>{c.books.map((b) => <li key={b}>{b}</li>)}</ul>
                </aside>
              ) : null}
            </div>
          </div>
        </section>
      )}

      <section id="talk" className="pblock talkblock">
        <div className="in">
          <div className="talkgrid">
            <div>
              <div className="stitle">Get in touch</div>
              <h2>{c.questions?.length ? 'Read everything first. Then decide.' : `Talk to ${first}.`}</h2>
              <p className="ssub">
                {scheduler
                  ? `Leave your details and you can book a time with ${first} straight afterwards.`
                  : `${first} arranges consultations directly. Leave your details and they will be in touch.`}
              </p>
              <SocialLinksRow links={social} name={r.name} />
            </div>
            <LeadCapture
              professionalId={r.id}
              firstName={first}
              schedulerHost={scheduler?.host}
              sourcePath={`/profile/${r.id}`}
            />
          </div>
        </div>
      </section>

      <div className="wrap" style={{ maxWidth: 1080 }}>
        <p className="pback">
          <Link href={back}>
            ← All {CATEGORY_LABELS[r.category as PracticeCategory]?.toLowerCase()} in {where}
          </Link>
        </p>
      </div>
    </>
  );
}
