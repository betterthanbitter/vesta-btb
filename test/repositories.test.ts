import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDb, type Db } from '../src/db/index.ts';
import {
  SqlConsultIntentStore, SqlConsultRequestStore, SqlLedger, SqlOutbox,
} from '../src/db/repositories.ts';
import { recordConsultIntent } from '../src/leads/consultIntent.ts';
import { Outbox, flushOutbox } from '../src/referral/outbox.ts';

let db: Db;
beforeEach(async () => { db = await openTestDb(); });

const intent = (over = {}) => ({
  id: crypto.randomUUID(), professionalId: '13893', sourcePath: '/boston-ma/family-law',
  destinationHost: 'calendly.com', visitorKey: 'v1', at: new Date().toISOString(), ...over,
});

describe('leads survive a restart now', () => {
  test('a consult intent written by one instance is read by another', async () => {
    await new SqlConsultIntentStore(db).record(intent());
    // A different store object, as a second serverless invocation would be.
    const other = new SqlConsultIntentStore(db);
    assert.equal((await other.forProfessional('13893')).length, 1);
  });

  test('dedup works against the database, not a Map in one process', async () => {
    const store = new SqlConsultIntentStore(db);
    await recordConsultIntent(store, intent());
    await recordConsultIntent(new SqlConsultIntentStore(db), intent());
    assert.equal((await store.forProfessional('13893')).length, 1,
      'a second instance must see what the first recorded');
  });

  test('a consult request keeps its contact details and optional fields', async () => {
    const store = new SqlConsultRequestStore(db);
    await store.record({
      id: 'r1', professionalId: '13285', name: 'Sarah M', email: 'sarah@example.com',
      sourcePath: '/boston-ma/family-law', at: new Date().toISOString(),
    });
    const [row] = await store.forProfessional('13285');
    assert.equal(row.email, 'sarah@example.com');
    assert.equal(row.phone, undefined, 'an absent phone reads back as absent, not null');
  });
});

describe('the ledger, which is the no-double-send guarantee', () => {
  test('exactly one caller wins a claim', async () => {
    const ledger = new SqlLedger(db);
    assert.equal(await ledger.claim('k'), true);
    assert.equal(await ledger.claim('k'), false);
  });

  test('two workers racing on the same key — only one proceeds', async () => {
    // Separate instances, as two concurrent functions would be.
    const results = await Promise.all(
      Array.from({ length: 8 }, () => new SqlLedger(db).claim('referral:R1:consumer:seq:SEQ')),
    );
    assert.equal(results.filter(Boolean).length, 1,
      'eight workers, one send — this is the property the whole design rests on');
  });

  test('a claim survives the process that made it', async () => {
    await new SqlLedger(db).claim('k');
    assert.equal(await new SqlLedger(db).state('k'), 'claimed');
  });

  test('review cases are findable for the back office', async () => {
    const l = new SqlLedger(db);
    await l.claim('a'); await l.flagForReview('a');
    await l.claim('b'); await l.confirm('b');
    assert.deepEqual(await l.needingReview(), ['a']);
  });
});

describe('the outbox is durable', () => {
  test('what the domain buffered is persisted and read back', async () => {
    const buffer = new Outbox();
    buffer.add({ dedupKey: 'k1', kind: 'consumer.routed', payload: { a: 1 }, createdAt: '2026-09-08T00:00:00Z' });
    buffer.add({ dedupKey: 'k2', kind: 'professional.assigned', payload: { b: 2 }, createdAt: '2026-09-08T00:00:01Z' });

    const store = new SqlOutbox(db);
    assert.equal(await flushOutbox(buffer, store), 2);

    const pending = await store.pending();
    assert.deepEqual(pending.map((p) => p.dedupKey), ['k1', 'k2']);
    assert.deepEqual(pending[0].payload, { a: 1 }, 'payload round-trips through JSON');
  });

  test('the same intent written twice is queued once', async () => {
    const store = new SqlOutbox(db);
    const e = { dedupKey: 'k', kind: 'consumer.routed' as const, payload: {}, createdAt: '2026-09-08T00:00:00Z' };
    await store.add(e);
    await store.add(e);
    assert.equal((await store.pending()).length, 1);
  });

  test('dispatched entries drop out of pending', async () => {
    const store = new SqlOutbox(db);
    await store.add({ dedupKey: 'k', kind: 'consumer.routed', payload: {}, createdAt: '2026-09-08T00:00:00Z' });
    await store.markDispatched('k');
    assert.equal((await store.pending()).length, 0);
  });

  test('a rolled-back transaction leaves no intent behind', async () => {
    // The point of flushing inside the transaction: we must never email about
    // a referral that was never written.
    await assert.rejects(() => db.transaction(async (tx) => {
      await new SqlOutbox(tx).add({
        dedupKey: 'k', kind: 'consumer.routed', payload: {}, createdAt: '2026-09-08T00:00:00Z',
      });
      throw new Error('referral insert failed');
    }));
    assert.equal((await new SqlOutbox(db).pending()).length, 0);
  });
});
