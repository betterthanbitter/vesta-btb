import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  MemoryConsultIntentStore, recordConsultIntent, DEDUP_WINDOW_MS,
} from '../src/leads/consultIntent.ts';

let store: MemoryConsultIntentStore;
beforeEach(() => { store = new MemoryConsultIntentStore(); });

const intent = (over: Partial<Parameters<typeof recordConsultIntent>[1]> = {}) => ({
  id: crypto.randomUUID(),
  professionalId: 'marcus-reyes',
  sourcePath: '/boston-ma/family-law',
  destinationHost: 'calendly.com',
  at: new Date().toISOString(),
  visitorKey: 'visitor-1',
  ...over,
});

describe('a click on Schedule free consult', () => {
  test('reaches the professional as a lead', async () => {
    const r = await recordConsultIntent(store, intent());
    assert.equal(r.recorded, true);
    const leads = await store.forProfessional('marcus-reyes');
    assert.equal(leads.length, 1);
    assert.equal(leads[0].sourcePath, '/boston-ma/family-law');
  });

  test('the same visitor clicking repeatedly is one lead, not four', async () => {
    for (let i = 0; i < 4; i++) await recordConsultIntent(store, intent());
    assert.equal((await store.forProfessional('marcus-reyes')).length, 1);
  });

  test('two different people are two leads', async () => {
    await recordConsultIntent(store, intent({ visitorKey: 'a' }));
    await recordConsultIntent(store, intent({ visitorKey: 'b' }));
    assert.equal((await store.forProfessional('marcus-reyes')).length, 2);
  });

  test('the same visitor coming back days later is a new lead', async () => {
    const old = new Date(Date.now() - DEDUP_WINDOW_MS - 1000).toISOString();
    await recordConsultIntent(store, intent({ at: old }));
    await recordConsultIntent(store, intent());
    assert.equal((await store.forProfessional('marcus-reyes')).length, 2);
  });

  test('one visitor clicking two professionals is a lead for each', async () => {
    await recordConsultIntent(store, intent({ professionalId: 'marcus-reyes' }));
    await recordConsultIntent(store, intent({ professionalId: 'rachel-stern' }));
    assert.equal((await store.forProfessional('marcus-reyes')).length, 1);
    assert.equal((await store.forProfessional('rachel-stern')).length, 1);
  });

  test('records only what we can honestly claim — a request, not a booking', async () => {
    await recordConsultIntent(store, intent());
    const lead = (await store.forProfessional('marcus-reyes'))[0];
    // Nothing in the record asserts a meeting exists. Confirming that needs a
    // webhook from the scheduling product.
    assert.ok(!('bookedAt' in lead) && !('confirmed' in lead));
    assert.equal(lead.destinationHost, 'calendly.com');
  });
});
