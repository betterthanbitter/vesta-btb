import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadDirectory, CATEGORY_LABELS, type DirectoryRecord } from '../../../src/data/vestaImport.ts';
import { ENTITLEMENTS, type Tier } from '../../../src/directory/tiers.ts';
import { orderForPage, classify } from '../../../src/directory/pageModel.ts';
import type { PracticeCategory } from '../../../src/pricing/catalog.ts';

export async function generateStaticParams() {
  const seen = new Set<string>();
  return loadDirectory()
    .filter((r) => r.hub !== 'unplaced')
    .filter((r) => !seen.has(`${r.hub}/${r.category}`) && seen.add(`${r.hub}/${r.category}`))
    .map((r) => ({ hub: r.hub, category: r.category }));
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
}

function Card({ r }: { r: DirectoryRecord }) {
  const e = ENTITLEMENTS[r.tier];
  const isPlatinum = r.tier === 'platinum';

  return (
    <article style={{
      background: 'var(--card)',
      border: `1px solid ${isPlatinum ? 'var(--br)' : 'var(--line)'}`,
      borderRadius: 14, marginBottom: 14, overflow: 'hidden',
      boxShadow: isPlatinum ? '0 4px 18px rgba(60,45,110,.10)' : 'none',
    }}>
      {isPlatinum && (
        <div style={{
          background: 'linear-gradient(90deg,var(--acc) 0%,#7a67ad 100%)', color: '#fff',
          padding: '9px 20px', fontSize: 11.6, fontWeight: 750, letterSpacing: '.07em',
          textTransform: 'uppercase',
        }}>Platinum Partner</div>
      )}
      {!isPlatinum && (
        <div style={{
          padding: '8px 22px 0', fontSize: 10.4, fontWeight: 780, letterSpacing: '.1em',
          textTransform: 'uppercase', color: 'var(--ink3)',
        }}>{r.tier === 'premium' ? 'Premium Member' : 'Standard Listing'}</div>
      )}

      <div style={{ display: 'flex', gap: 18, padding: '18px 22px 16px', alignItems: 'flex-start' }}>
        {e.photo ? (
          r.photo
            ? <img src={r.photo} alt="" width={92} height={92}
                style={{ borderRadius: 12, objectFit: 'cover', flex: 'none' }} />
            : <div style={{
                width: 92, height: 92, borderRadius: 12, flex: 'none', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 750,
                color: '#fff', background: 'linear-gradient(140deg,#6a5a9e,#9b86c9)',
              }}>{initials(r.name)}</div>
        ) : (
          <div style={{
            width: 40, height: 40, borderRadius: 9, flex: 'none', background: 'var(--bg)',
            border: '1px solid var(--line2)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 13, fontWeight: 750, color: 'var(--ink3)',
          }}>{initials(r.name)}</div>
        )}

        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 19.5, fontWeight: 730, letterSpacing: '-.02em' }}>{r.name}</div>
          {r.roleLabel && (
            <div style={{ fontSize: 13.6, color: 'var(--acc)', fontWeight: 700 }}>{r.roleLabel}</div>
          )}
          <div style={{ fontSize: 13.2, color: 'var(--ink3)', marginBottom: 9 }}>
            {r.city}, {r.state}
            {!r.firm && <span title="No firm recorded in the source data"> · firm not recorded</span>}
          </div>

          {e.photo && r.bio && (
            <p style={{ margin: '0 0 10px', fontSize: 14, color: 'var(--ink2)', maxWidth: '64ch' }}>
              {r.bio}
            </p>
          )}

          {e.contentLibrary ? (
            <div style={{ fontSize: 13, color: 'var(--ink3)' }}>
              {r.contentCount > 0
                ? `${r.contentCount} pieces of content`
                : 'Content library — nothing produced yet'}
            </div>
          ) : (
            <div style={{ fontSize: 12.6, color: 'var(--ink3)' }}>
              Standard listing — name, speciality and contact only
            </div>
          )}
        </div>

        <div style={{ marginLeft: 'auto', flex: 'none' }}>
          <Link href={`/profile/${r.id}`} style={{
            display: 'inline-block', background: e.photo ? 'var(--acc)' : '#fff',
            color: e.photo ? '#fff' : 'var(--acc)',
            border: `1px solid ${e.photo ? 'var(--acc)' : 'var(--br)'}`,
            borderRadius: 9, padding: '9px 16px', fontSize: 13.4, fontWeight: 680,
            textDecoration: 'none', whiteSpace: 'nowrap',
          }}>{e.photo ? 'View profile →' : 'Contact →'}</Link>
        </div>
      </div>
    </article>
  );
}

export default async function CategoryPage(
  { params }: { params: Promise<{ hub: string; category: string }> },
) {
  const { hub, category } = await params;
  // 'unplaced' is a bucket for records with no location, not a place. It must
  // never resolve as a URL — generateStaticParams excludes it from the build,
  // and this stops the dynamic route serving it in development or on a miss.
  if (hub === 'unplaced') notFound();

  const all = loadDirectory();
  const here = all.filter(
    (r) => r.hub === hub && r.allCategories.includes(category as PracticeCategory),
  );
  if (!here.length) notFound();

  const catLabel = CATEGORY_LABELS[category as PracticeCategory] ?? category;
  const place = `${here[0].city}, ${here[0].state}`;
  const contentItems = here.reduce((n, r) => n + r.contentCount, 0);
  const { state, reason } = classify(here.length, contentItems);
  const ordered = orderForPage(
    here.map((r) => ({ id: r.id, hub: r.hub, category: r.category, tier: r.tier, contentCount: r.contentCount })),
    (t: Tier) => ENTITLEMENTS[t].placementWeight,
  ).map((o) => here.find((r) => r.id === o.id)!);

  const seatOpen = !here.some((r) => r.tier === 'platinum');

  return (
    <>
      <header className="top">
        <div className="in">
          <Link href="/" className="logo">VESTA</Link>
          <span style={{ fontSize: 13.5, color: 'var(--ink3)' }}>
            <Link href="/" style={{ textDecoration: 'none', color: 'var(--acc)' }}>Directory</Link>
            {' / '}{place}{' / '}{catLabel}
          </span>
          <span className="spacer" />
          <span className="urlchip" style={{ background: 'var(--soft)', color: 'var(--acc2)',
            borderColor: 'var(--br)' }}>/{hub}/{category}/</span>
        </div>
      </header>

      <div className="wrap">
        <h1 style={{ fontSize: 26, letterSpacing: '-.025em', margin: '0 0 4px' }}>
          {catLabel} in {place}
        </h1>
        <p style={{ fontSize: 13.4, color: 'var(--ink2)', margin: '0 0 20px' }}>
          {here.length} professional{here.length === 1 ? '' : 's'} ·{' '}
          <span style={{
            fontWeight: 700,
            color: state === 'publish' ? 'var(--ok)' : 'var(--gold)',
          }}>
            {state === 'publish' ? 'indexable' : 'noindex'}
          </span>{' '}
          <span style={{ color: 'var(--ink3)' }}>— {reason}</span>
        </p>

        {ordered.map((r) => <Card key={r.id} r={r} />)}

        {seatOpen && (
          <div style={{
            border: '1px dashed var(--gold-br)', background: 'var(--gold-bg)',
            borderRadius: 14, padding: '17px 20px', marginTop: 4,
          }}>
            <h3 style={{ margin: '0 0 5px', fontSize: 14.6, color: 'var(--gold)' }}>
              The Platinum seat for {catLabel} in {place} is open
            </h3>
            <p style={{ margin: 0, fontSize: 13.2, color: '#6a5418', lineHeight: 1.5 }}>
              Nobody holds the exclusive position here.{' '}
              {here.length === 1
                ? <>With one professional in this category, exclusivity currently{' '}
                   <b>excludes nobody</b> — worth recruiting before it is worth selling.</>
                : <>There are <b>{here.length} candidates</b> who could hold it.</>}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
