import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Outbox } from '../src/referral/outbox.ts';
import { ReferralService } from '../src/referral/referralService.ts';
import { findColdLeads, emitNurtureTriggers } from '../src/referral/coldLeads.ts';
import type { Consumer, Professional } from '../src/referral/types.ts';

const DAY = 24 * 60 * 60 * 1000;
const sarah: Consumer = {
  id: 'L104', email: 's@example.com', firstName: 'Sarah', lastName: 'M',
  hub: 'boston-ma', categoryNeeded: 'family-law',
};
const pro = (id: string): Professional => ({
  id, email: `${id}@e.com`, firstName: id, lastName: 'P', firm: 'F',
  hub: 'boston-ma', category: 'family-law', tier: 'platinum',
});

/** A clock we can wind forward, so tests do not depend on real time. */
function clockAt(iso: string) {
  let current = iso;
  return { now: () => current, set(next: string) { current = next; } };
}

let outbox: Outbox;
beforeEach(() => { outbox = new Outbox(); });

function routedOn(iso: string, pros = ['marcus']) {
  const clock = clockAt(iso);
  const svc = new ReferralService(outbox, clock);
  svc.route({ referralId: 'R1', consumer: sarah, professionals: pros.map(pro),
    mode: pros.length > 1 ? 'consumer-choice' : 'direct' });
  outbox.drain();
  return { svc, clock };
}

describe('leads that go cold', () => {
  test('a lead untouched for a week is cold', () => {
    const { svc } = routedOn('2026-09-01T09:00:00Z');
    const cold = findColdLeads([svc.get('R1')!], new Date('2026-09-09T09:00:00Z'));
    assert.equal(cold.length, 1);
    assert.equal(cold[0].daysStale, 8);
  });

  test('six days is not yet cold', () => {
    const { svc } = routedOn('2026-09-01T09:00:00Z');
    assert.equal(findColdLeads([svc.get('R1')!], new Date('2026-09-07T08:00:00Z')).length, 0);
  });

  test('the clock restarts when the professional does something', () => {
    const { svc, clock } = routedOn('2026-09-01T09:00:00Z');
    // They made contact on day six.
    clock.set('2026-09-07T09:00:00Z');
    svc.advance('R1', 'marcus', 'contacted');
    // Day eight overall, but only one day since anything happened.
    const cold = findColdLeads([svc.get('R1')!], new Date('2026-09-09T09:00:00Z'));
    assert.equal(cold.length, 0, 'contacting resets staleness');
  });

  test('a lead someone already won is never chased', () => {
    const { svc } = routedOn('2026-09-01T09:00:00Z', ['marcus', 'rachel']);
    svc.advance('R1', 'marcus', 'contacted');
    svc.advance('R1', 'marcus', 'hired');
    outbox.drain();
    assert.deepEqual(findColdLeads([svc.get('R1')!], new Date('2026-10-01T09:00:00Z')), []);
  });

  test('a declined lead is not cold, it is finished', () => {
    const { svc } = routedOn('2026-09-01T09:00:00Z');
    svc.advance('R1', 'marcus', 'dead_lead');
    outbox.drain();
    assert.equal(findColdLeads([svc.get('R1')!], new Date('2026-10-01T09:00:00Z')).length, 0);
  });
});

describe('what the hub hands Ontraport', () => {
  test('one nurture trigger per cold lead', () => {
    const { svc } = routedOn('2026-09-01T09:00:00Z', ['marcus', 'rachel']);
    const cold = findColdLeads([svc.get('R1')!], new Date('2026-09-09T09:00:00Z'));
    const entries = emitNurtureTriggers(outbox, cold);
    assert.equal(entries.length, 2);
    assert.equal(entries[0].kind, 'referral.went_cold');
  });

  test('running the sweep every day does not nurture the same lead every day', () => {
    const { svc } = routedOn('2026-09-01T09:00:00Z');
    const keys = new Set<string>();
    for (const day of ['2026-09-09', '2026-09-10', '2026-09-11']) {
      const cold = findColdLeads([svc.get('R1')!], new Date(`${day}T09:00:00Z`));
      for (const e of emitNurtureTriggers(outbox, cold)) keys.add(e.dedupKey);
    }
    assert.equal(keys.size, 1, 'the dispatcher sees one distinct intent, not three');
  });

  test('going cold again at a later stage is a different situation, and triggers again', () => {
    const { svc, clock } = routedOn('2026-09-01T09:00:00Z');
    const first = emitNurtureTriggers(outbox,
      findColdLeads([svc.get('R1')!], new Date('2026-09-09T09:00:00Z')));

    clock.set('2026-09-09T10:00:00Z');
    svc.advance('R1', 'marcus', 'contacted');
    const second = emitNurtureTriggers(outbox,
      findColdLeads([svc.get('R1')!], new Date('2026-09-20T09:00:00Z')));

    assert.equal(second.length, 1);
    assert.notEqual(first[0].dedupKey, second[0].dedupKey);
  });
});
