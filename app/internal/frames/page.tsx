import { Platinum } from '../../../components/DirectoryResults.tsx';
import { loadDirectory, CATEGORY_LABELS } from '../../../src/data/vestaImport.ts';

export const metadata = { robots: { index: false, follow: false } };

const OPTIONS = [
  { key: 'gold', name: 'A · Gold',
    hex: '#ffc91f',
    note: 'The sunburst gold from your logo mark. The strongest “this one is different” signal, and the colour people already read as premium. The risk is that it reads as advertising rather than endorsement.' },
  { key: 'teal', name: 'B · Teal',
    hex: '#0098a8',
    note: 'Your secondary brand colour, used across the current site’s hero panels. Calmer than gold and unmistakably Vesta, but less separation from the ribbon, which is already navy-to-teal.' },
  { key: 'navy', name: 'C · Navy',
    hex: '#0c4777',
    note: 'The wordmark colour. The most serious and least decorative of the four — reads as authority rather than promotion, which may suit an audience making a hard decision.' },
  { key: 'edge', name: 'D · Aqua edge',
    hex: '#5bc9c3',
    note: 'A thick left bar rather than a full border. The quietest option: it marks the listing without boxing it in, and stays legible if you ever have two Platinum cards on one page.' },
];

export default function Frames() {
  const r = loadDirectory().find((d) => d.tier === 'platinum')
    ?? loadDirectory().find((d) => d.photo)!;
  const place = `${r.city}, ${r.state}`;
  const catLabel = CATEGORY_LABELS[r.category];

  return (
    <div className="wrap" style={{ maxWidth: 1000 }}>
      <h1 style={{ fontSize: 27, letterSpacing: '-.03em', margin: '0 0 4px' }}>
        Platinum frame — four options
      </h1>
      <p style={{ color: 'var(--ink2)', fontSize: 14.5, maxWidth: '70ch', margin: '0 0 8px' }}>
        The same real listing, four ways. All colours are sampled from vestadivorce.com. Tell me
        a letter and I will set it; it is one line to change.
      </p>
      <p style={{ color: 'var(--ink3)', fontSize: 13, margin: '0 0 30px' }}>
        Worth scrolling past a Premium and Standard card afterwards to check the difference is
        obvious at a glance, not only side by side.
      </p>

      {OPTIONS.map((o) => (
        <section key={o.key} style={{ marginBottom: 34 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{
              width: 16, height: 16, borderRadius: 4, background: o.hex,
              border: '1px solid rgba(0,0,0,.12)',
            }} />
            <h2 style={{ fontSize: 16.5, margin: 0, letterSpacing: '-.02em' }}>{o.name}</h2>
            <code style={{ fontSize: 12, color: 'var(--ink3)' }}>{o.hex}</code>
          </div>
          <p style={{ fontSize: 13.4, color: 'var(--ink2)', maxWidth: '78ch', margin: '0 0 12px' }}>
            {o.note}
          </p>
          <Platinum r={r} catLabel={catLabel} place={place} frame={o.key} />
        </section>
      ))}
    </div>
  );
}
