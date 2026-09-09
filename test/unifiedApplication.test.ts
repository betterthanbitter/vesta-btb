import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateUnifiedApplication, hubSlug } from '../src/professionals/unifiedApplication.ts';
import { PROFESSIONS, pricesFor, assertProfessionsComplete, TIER_SUMMARIES } from '../src/professionals/tiers.ts';

const good = {
  firstName: 'Marcus', lastName: 'Reyes', email: 'marcus@reyeslaw.com',
  phone: '617-555-0142', profession: 'Attorney', city: 'Newton', state: 'MA',
  tier: 'platinum',
};

describe('the unified application', () => {
  test('accepts a complete submission', () => {
    assert.equal(validateUnifiedApplication(good).ok, true);
  });

  test('a phone number is required — the concierge rings professionals', () => {
    const r = validateUnifiedApplication({ ...good, phone: '' });
    assert.equal(r.ok, false);
    assert.match((r as any).errors.phone, /concierge/);
  });

  test('city and state are required, because they decide the page', () => {
    // Six professionals in the current directory have no location and appear
    // nowhere. That must not be reproducible through the new form.
    assert.equal(validateUnifiedApplication({ ...good, city: '' }).ok, false);
    assert.equal(validateUnifiedApplication({ ...good, state: '' }).ok, false);
  });

  test('the hub is derived so they land on a real page', () => {
    const r = validateUnifiedApplication(good);
    assert.equal((r as any).value.hub, 'newton-ma');
    assert.equal(hubSlug('Lexington / Winchester', 'MA'), 'lexington-winchester-ma');
  });

  test('a booking link must be a real https address', () => {
    assert.equal(validateUnifiedApplication({ ...good, schedulerUrl: 'calendly.com/x' }).ok, false);
    assert.equal(validateUnifiedApplication({ ...good, schedulerUrl: 'javascript:alert(1)' }).ok, false);
    assert.equal(validateUnifiedApplication({ ...good, schedulerUrl: 'https://calendly.com/x' }).ok, true);
  });

  test('no booking link at all is fine', () => {
    assert.equal(validateUnifiedApplication({ ...good, schedulerUrl: '' }).ok, true);
  });

  test('joining the affiliate programme without a PayPal address is refused', () => {
    // Commissions are paid by PayPal; without one we could not pay them.
    const r = validateUnifiedApplication({ ...good, affiliateOptin: 'on' });
    assert.equal(r.ok, false);
    assert.match((r as any).errors.paypalEmail, /PayPal/);
  });

  test('affiliate with a PayPal address is accepted', () => {
    const r = validateUnifiedApplication({
      ...good, affiliateOptin: 'on', paypalEmail: 'Marcus@Pay.com',
    });
    assert.equal(r.ok, true);
    assert.equal((r as any).value.paypalEmail, 'marcus@pay.com');
    assert.equal((r as any).value.affiliateOptin, true);
  });

  test('a profession not on the list is refused', () => {
    assert.equal(validateUnifiedApplication({ ...good, profession: 'Astronaut' }).ok, false);
  });

  test('an invented tier is refused', () => {
    assert.equal(validateUnifiedApplication({ ...good, tier: 'diamond' }).ok, false);
  });
});

describe('what the form offers', () => {
  test('every profession has a price and a category', () => {
    assertProfessionsComplete();
  });

  test('prices are real numbers for the profession, not a range', () => {
    const attorney = pricesFor('Attorney');
    assert.deepEqual(attorney.map((p) => p.monthly), [49, 295, 795]);
    const realtor = pricesFor('Realtor');
    assert.deepEqual(realtor.map((p) => p.monthly), [29, 99, 349]);
  });

  test('divorce coaches are priced on their own programme', () => {
    // CCMP, not band three — a distinction the strategy document is explicit
    // about and which the form must not flatten.
    assert.deepEqual(pricesFor('Divorce Coach').map((p) => p.monthly), [29, 249, 474]);
  });

  test('each level says what it does not include, except the top one', () => {
    const [standard, premium, platinum] = TIER_SUMMARIES;
    assert.ok(standard.notIncluded?.length, 'nobody should sign up expecting content they get');
    assert.ok(premium.notIncluded?.length);
    assert.ok(platinum.scarcity, 'exclusivity has to be stated before they pay');
  });

  test('every profession offered is priced', () => {
    for (const p of PROFESSIONS) {
      assert.equal(pricesFor(p).length, 3, `${p} is missing prices`);
    }
  });
});
