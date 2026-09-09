import ApplyForm from '../../components/ApplyForm.tsx';
import { TIER_SUMMARIES, PROFESSIONS, PROFESSION_BAND } from '../../src/professionals/tiers.ts';
import { PRICING } from '../../src/pricing/catalog.ts';

export const metadata = {
  title: 'Join the Vesta network',
  description: 'Apply to join the Vesta directory of vetted divorce professionals.',
  robots: { index: false, follow: false },
};

export default function Apply() {
  // Prices for every profession, sent once so the levels update the moment a
  // profession is chosen — no round trip, and no "from $29".
  const priceTable = Object.fromEntries(
    PROFESSIONS.map((p) => {
      const b = PRICING[PROFESSION_BAND[p]];
      return [p, { standard: b.standard, premium: b.premium, platinum: b.platinum }];
    }),
  );

  return (
    <ApplyForm
      tiers={TIER_SUMMARIES}
      professions={[...PROFESSIONS]}
      prices={priceTable}
    />
  );
}
