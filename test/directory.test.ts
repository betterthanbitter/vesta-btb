import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { ENTITLEMENTS, whatUpgradingAdds } from '../src/directory/tiers.ts';
import { SeatRegister, SeatTakenError } from '../src/directory/seats.ts';
import {
  buildPages, classify, orderForPage, type DirectoryProfessional,
} from '../src/directory/pageModel.ts';

const AT = '2026-09-08T12:00:00Z';

const pro = (
  id: string, hub: string, category: any, tier: any, contentCount = 0,
): DirectoryProfessional => ({ id, hub, category, tier, contentCount });

describe('what a tier actually buys', () => {
  test('Standard is a listing, a photo, and nothing else', () => {
    const e = ENTITLEMENTS.standard;
    assert.equal(e.listing, true);
    assert.equal(e.photo, true, 'a face is not a paid privilege');
    assert.equal(e.contentLibrary, false);
    assert.equal(e.introVideo, false);
    assert.equal(e.exclusiveSeat, false);
  });

  test('Premium is the content programme — library yes, video and events no', () => {
    const e = ENTITLEMENTS.premium;
    assert.equal(e.contentLibrary, true, 'PAC.MP / CCMP content renders on the listing');
    assert.equal(e.communityPlacement, true);
    assert.equal(e.introVideo, false, 'the video is what Platinum adds');
    assert.equal(e.hostsEvents, false);
  });

  test('only Platinum holds a seat and hosts events', () => {
    assert.equal(ENTITLEMENTS.platinum.exclusiveSeat, true);
    assert.equal(ENTITLEMENTS.platinum.hostsEvents, true);
    assert.equal(ENTITLEMENTS.platinum.hubHostingIncluded, true);
  });

  test('the upgrade gap is a list of things, not a price', () => {
    // A photograph is not one of them. Everyone gets a face; Premium buys the
    // bio, the content library and the community placement.
    assert.deepEqual(whatUpgradingAdds('standard', 'premium'),
      ['contentLibrary', 'communityPlacement']);
    assert.deepEqual(whatUpgradingAdds('premium', 'platinum'),
      ['introVideo', 'hostsEvents', 'exclusiveSeat', 'hubHostingIncluded']);
  });
});

describe('Platinum seats are inventory, not a flag', () => {
  let seats: SeatRegister;
  beforeEach(() => { seats = new SeatRegister(); });

  test('the same seat cannot be sold twice', () => {
    seats.claim('boston', 'family-law', 'marcus-reyes', AT);
    assert.throws(
      () => seats.claim('boston', 'family-law', 'rachel-stern', AT),
      SeatTakenError,
    );
  });

  test('the same seat in a different city is a different seat', () => {
    seats.claim('boston', 'family-law', 'marcus-reyes', AT);
    seats.claim('newton', 'family-law', 'rachel-stern', AT);
    assert.equal(seats.held().length, 2);
  });

  test('a retried checkout does not fail after the money is taken', () => {
    const first = seats.claim('boston', 'family-law', 'marcus-reyes', AT);
    const retry = seats.claim('boston', 'family-law', 'marcus-reyes', AT);
    assert.deepEqual(first, retry);
    assert.equal(seats.held().length, 1);
  });

  test('releasing puts the seat back on the market', () => {
    seats.claim('boston', 'family-law', 'marcus-reyes', AT);
    seats.release('boston', 'family-law');
    assert.equal(seats.isAvailable('boston', 'family-law'), true);
    seats.claim('boston', 'family-law', 'rachel-stern', AT);
    assert.equal(seats.get('boston', 'family-law')?.heldBy, 'rachel-stern');
  });

  test('the sales list is densest-first, and skips cells with nobody in them', () => {
    const occupancy = new Map([
      ['boston:family-law', { hub: 'boston', category: 'family-law' as const, professionals: 4 }],
      ['newton:mortgage', { hub: 'newton', category: 'mortgage' as const, professionals: 1 }],
      ['tulsa:family-law', { hub: 'tulsa', category: 'family-law' as const, professionals: 0 }],
    ]);
    const list = seats.sellable(occupancy);
    assert.deepEqual(list.map((s) => s.hub), ['boston', 'newton']);
    assert.equal(list[0].candidates, 4, 'the densest seat is worth selling first');
  });
});

describe('which pages exist', () => {
  const noSeats = () => false;

  test('a cell with nobody in it does not become a URL', () => {
    const { state } = classify(0, 0);
    assert.equal(state, 'omit');
  });

  test('two or more professionals is a page', () => {
    assert.equal(classify(2, 0).state, 'publish');
  });

  test('one professional with a real library is a legitimate page', () => {
    const { state, reason } = classify(1, 5);
    assert.equal(state, 'publish');
    assert.match(reason, /pieces of content/);
  });

  test('one professional with nothing to read is reachable but not indexed', () => {
    assert.equal(classify(1, 0).state, 'thin');
  });

  test('the fixed grid problem: empty cells never reach the sitemap', () => {
    const pages = buildPages([
      pro('a', 'boston', 'family-law', 'platinum', 8),
      pro('b', 'boston', 'family-law', 'premium', 3),
      pro('c', 'baltimore', 'family-law', 'standard', 0),
    ], noSeats);

    assert.deepEqual(pages.map((p) => p.url), ['/boston/family-law/', '/baltimore/family-law/']);
    assert.equal(pages[0].state, 'publish');
    assert.equal(pages[1].state, 'thin', 'a lone Standard listing is not an indexable page');
    // Nothing was invented for the five categories nobody occupies in Boston.
    assert.equal(pages.length, 2);
  });

  test('an open seat is flagged on the page for the sales team', () => {
    const pages = buildPages(
      [pro('a', 'boston', 'family-law', 'premium', 4), pro('b', 'boston', 'family-law', 'premium', 4)],
      () => false,
    );
    assert.equal(pages[0].seatOpen, true);
  });

  test('Platinum sits above Premium, and content breaks the tie', () => {
    const ordered = orderForPage([
      pro('std', 'boston', 'family-law', 'standard', 0),
      pro('prem-lots', 'boston', 'family-law', 'premium', 9),
      pro('plat', 'boston', 'family-law', 'platinum', 1),
      pro('prem-few', 'boston', 'family-law', 'premium', 2),
    ], (t) => ENTITLEMENTS[t].placementWeight);

    assert.deepEqual(ordered.map((p) => p.id), ['plat', 'prem-lots', 'prem-few', 'std']);
  });
});
