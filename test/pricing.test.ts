import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PRICING, TOTAL_IN_NETWORK, weightedAverage } from '../src/pricing/catalog.ts';

describe('the price table as transcribed', () => {
  // The source table published its own weighted averages. If our numbers
  // reproduce them, the transcription is right. If not, something is a typo.
  test('reproduces the published weighted averages', () => {
    assert.equal(TOTAL_IN_NETWORK, 78);
    assert.equal(Math.round(weightedAverage('current')), 357);
    assert.equal(Math.round(weightedAverage('premium')), 200);
    assert.equal(Math.round(weightedAverage('platinum')), 554);
    assert.equal(Math.round(weightedAverage('standard')), 38);
  });

  test('every band is priced standard < premium < platinum', () => {
    for (const [name, p] of Object.entries(PRICING)) {
      assert.ok(p.standard < p.premium, `${name}: standard should undercut premium`);
      assert.ok(p.premium < p.platinum, `${name}: premium should undercut platinum`);
    }
  });
});

describe('how Platinum is actually constructed', () => {
  /**
   * Platinum is not a new price. In four of the five bands it is exactly what
   * the professional pays Vesta today, plus the Premier/PAC.MP content price
   * from the strategy document:
   *
   *   attorneys      500 + 295 = 795
   *   cdfa-mediators 375 + 195 = 570
   *   lending etc.   250 +  99 = 349
   *   therapists     250 +  99 = 349
   *
   * That matters commercially: Platinum is "keep what you have and add
   * content", not a rise. Premium is "drop the concierge and events, keep
   * only content" — which is why it costs less than today.
   */
  const CONTENT_PRICE: Record<string, number> = {
    attorneys: 295,
    'cdfa-mediators': 195,
    'lending-realty-accounting': 99,
    'divorce-coaches': 249, // CCMP
    'therapists-wellness-other': 99,
  };

  test('Platinum = current Vesta price + the content program', () => {
    const exceptions: string[] = [];
    for (const [band, p] of Object.entries(PRICING)) {
      const implied = p.current + CONTENT_PRICE[band];
      if (implied !== p.platinum) {
        exceptions.push(`${p.label}: table says $${p.platinum}, formula gives $${implied}`);
      }
    }
    // One band does not follow the rule. Documented, not silently tolerated:
    // Divorce Coaches are priced $474 where 250 + 249 = 499. Either a $25
    // concession to coaches or a slip. Confirm before billing anyone.
    assert.deepEqual(exceptions, [
      'Divorce Coaches: table says $474, formula gives $499',
    ]);
  });
});
