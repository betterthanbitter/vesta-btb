import Link from 'next/link';
import { notFound } from 'next/navigation';
import ExpandableBio from '../../../components/ExpandableBio.tsx';
import LeadCapture from '../../../components/LeadCapture.tsx';
import { companionOffer } from '../../../src/products/companionOffer.ts';
import LibrarySections from '../../../components/LibrarySections.tsx';
import SocialLinksRow from '../../../components/SocialLinks.tsx';
import { loadPublishedDirectory } from '../../../src/professionals/directory.ts';
import { getDb } from '../../../src/leads/store.ts';
import { CATEGORY_LABELS, isLegacyVestaUrl } from '../../../src/data/vestaImport.ts';
import { ENTITLEMENTS } from '../../../src/directory/tiers.ts';
import { parseSchedulerLink } from '../../../src/directory/schedulerLink.ts';
import { parseProfileContent } from '../../../src/professionals/profileContent.ts';
import { parseSocialLinks, toHttpsUrl } from '../../../src/professionals/social.ts';
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

export default async function Profile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = (await loadPublishedDirectory(await getDb())).find((x) => x.id === id);
  if (!r) notFound();

  const e = ENTITLEMENTS[r.tier];
  const c = parseProfileContent(r.profileContent);
  // Instant Book is Platinum and Premium only; Standard gets the consult form alone.
  const scheduler = e.instantBook ? parseSchedulerLink(r.schedulerUrl) : null;
  const social = parseSocialLinks(r.socialLinks);
  // Their own site and phone are shown only after the consult form is sent.
  // Validated: this value came from an application form.
  const site = r.website && !isLegacyVestaUrl(r.website) ? toHttpsUrl(r.website) : undefined;
  const first = r.name.split(' ')[0];
  const where = [r.city, r.state].filter(Boolean).join(', ');
  const states = (r.statesLicensed ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  // Shown as one horizontal line of checks in the hero, in the order recorded.
  const specialtyList = [...r.specialties, ...(r.specialtyOther ? [r.specialtyOther] : [])];
  const library = c.shelves ?? [];
  const libraryCount = library.reduce((n, s) => n + s.items.length, 0);
  const back = r.hub !== 'unplaced' ? `/${r.hub}/${r.category}` : '/';

  /* The proof bar shows only numbers that are real. A row of zeroes is worse
     than no row — it advertises an empty profile. */
  const proof = [
    c.questions?.length ? { v: c.questions.length, k: 'Questions answered in full, free' } : null,
    states.length ? { v: states.length, k: 'States licensed to practice in' } : null,
    libraryCount ? { v: libraryCount, k: 'Pieces to read, watch and listen to' } : null,
    specialtyList.length ? { v: specialtyList.length, k: 'Specialties' } : null,
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
            <div className="phhead">
              <div className="eyebrow">
                {r.profession ?? CATEGORY_LABELS[r.category as PracticeCategory]}
              </div>
              <h1>{r.headline ?? r.name}</h1>
              {r.headline && <div className="pwho">{r.name}</div>}
              <div className="psub">{r.firm && <>{r.firm} · </>}{where}</div>
            </div>

            <div className="phbody">
              {(c.lede ?? r.bio) && <ExpandableBio text={c.lede ?? r.bio} name={r.name} />}

              <div className="hactions">
                <a className="prof" href="#talk">Schedule Free Consult</a>
                {c.questions?.length
                  ? <a className="ghost" href="#answers">Start with the questions</a>
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
              </div>

              {specialtyList.length > 0 && (
                <ul id="specialties" className="specline" aria-label={`What ${first} handles`}>
                  {specialtyList.map((item) => <li key={item}>{item}</li>)}
                </ul>
              )}
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
              website={site}
              phone={r.phone}
              offer={companionOffer() ?? undefined}
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
