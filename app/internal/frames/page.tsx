import DirectoryResults from '../../../components/DirectoryResults.tsx';
import { CATEGORY_LABELS } from '../../../src/data/vestaImport.ts';
import { loadPublishedDirectory } from '../../../src/professionals/directory.ts';
import { getDb } from '../../../src/leads/store.ts';
import type { PracticeCategory } from '../../../src/pricing/catalog.ts';

export const metadata = { robots: { index: false, follow: false } };

/**
 * The three tiers together, so the hierarchy can be judged as a consumer sees
 * it — one after another down a page — rather than as three swatches.
 */
export const dynamic = 'force-dynamic';

export default async function Frames() {
  const all = (await loadPublishedDirectory(await getDb())).filter((d) => d.hub !== 'unplaced');
  const platinum = all.find((d) => d.tier === 'platinum')!;
  const premium = all.find((d) => d.tier === 'premium')!;
  const standard = all.filter((d) => d.tier === 'standard' && d.hub === platinum.hub).slice(0, 3);

  return (
    <div className="wrap" style={{ maxWidth: 1000 }}>
      <h1 style={{ fontSize: 27, letterSpacing: '-.03em', margin: '0 0 6px' }}>
        Tier frames
      </h1>
      <p style={{ color: 'var(--ink2)', fontSize: 14.5, maxWidth: '72ch', margin: '0 0 6px' }}>
        Gold for Platinum, teal for Premium, navy for Standard — your choice, all sampled from
        vestadivorce.com.
      </p>
      <p style={{ color: 'var(--ink3)', fontSize: 13.2, maxWidth: '72ch', margin: '0 0 26px' }}>
        The weights differ deliberately. Navy is the darkest of the three, so at the same
        thickness Standard would out-shout Premium and the frames would argue against the price
        list. Platinum gets 2px and a glow, Premium 2px flat, Standard a thin line.
      </p>

      <div style={{ display: 'flex', gap: 18, marginBottom: 26, flexWrap: 'wrap' }}>
        {[['Platinum', '#ffc91f'], ['Premium', '#0098a8'], ['Standard', '#0c4777']].map(
          ([name, hex]) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 18, height: 18, borderRadius: 4, background: hex,
                border: '1px solid rgba(0,0,0,.12)',
              }} />
              <b style={{ fontSize: 13.5 }}>{name}</b>
              <code style={{ fontSize: 12, color: 'var(--ink3)' }}>{hex}</code>
            </div>
          ),
        )}
      </div>

      <DirectoryResults
        records={[platinum, premium, ...standard]}
        category={platinum.category as PracticeCategory}
        place={`${platinum.city}, ${platinum.state}`}
      />
    </div>
  );
}
