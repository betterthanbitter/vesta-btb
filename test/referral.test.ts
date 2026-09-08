import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { Outbox, SentLedger } from '../src/referral/outbox.ts';
import { ReferralService } from '../src/referral/referralService.ts';
import { IllegalTransitionError } from '../src/referral/stateMachine.ts';
import { FakeDeliveryEngine } from '../src/delivery/fake.ts';
import { Dispatcher } from '../src/delivery/dispatcher.ts';
import type { Consumer, Professional } from '../src/referral/types.ts';

const SEQUENCES = { consumerAfterRouting: 'SEQ_CONSUMER', professionalNewLead: 'SEQ_PRO' };

const sarah: Consumer = {
  id: 'L104', email: 'sarah.m@example.com', firstName: 'Sarah', lastName: 'M',
  hub: 'boston', categoryNeeded: 'family-law-mediation', stageOfDivorce: 'considering',
};

const pro = (id: string, first: string): Professional => ({
  id, email: `${id}@example.com`, firstName: first, lastName: 'Pro', firm: `${first} Law`,
  hub: 'boston', category: 'family-law-mediation', tier: 'platinum',
});

const marcus = pro('marcus-reyes', 'Marcus');
const rachel = pro('rachel-stern', 'Rachel');
const karen = pro('karen-doyle', 'Karen');

let outbox: Outbox, ledger: SentLedger, engine: FakeDeliveryEngine;
let service: ReferralService, dispatcher: Dispatcher;

beforeEach(() => {
  outbox = new Outbox();
  ledger = new SentLedger();
  engine = new FakeDeliveryEngine();
  service = new ReferralService(outbox);
  dispatcher = new Dispatcher(engine, ledger, SEQUENCES);
});

describe('routing a referral', () => {
  test('one consumer email and one email per professional, and no more', async () => {
    service.route({ referralId: 'R1', consumer: sarah,
      professionals: [marcus, rachel, karen], mode: 'consumer-choice' });

    await dispatcher.dispatch(outbox.drain());

    // Four sequence enrolments: the consumer, and each of three professionals.
    assert.equal(engine.sequenceStarts().length, 4);
    assert.equal(
      engine.sequenceStarts().filter((s) => s.endsWith('SEQ_CONSUMER')).length, 1,
      'the consumer must be enrolled exactly once',
    );
    assert.equal(
      engine.sequenceStarts().filter((s) => s.endsWith('SEQ_PRO')).length, 3,
    );
  });

  test('the hub never sends anything itself — it only writes intents', () => {
    service.route({ referralId: 'R1', consumer: sarah, professionals: [marcus], mode: 'direct' });
    // Nothing has reached the engine, because the dispatcher has not run.
    assert.equal(engine.calls.length, 0);
    assert.equal(outbox.pending, 2);
  });

  test('a direct referral cannot go to more than one professional', () => {
    assert.throws(() => service.route({
      referralId: 'R1', consumer: sarah, professionals: [marcus, rachel], mode: 'direct',
    }), /exactly one professional/);
  });
});

describe('the double-send guarantees', () => {
  test('the concierge double-clicking Route sends nothing twice', async () => {
    const args = { referralId: 'R1', consumer: sarah,
      professionals: [marcus, rachel], mode: 'consumer-choice' as const };

    service.route(args);
    service.route(args);            // the second click
    service.route(args);            // and an impatient third

    await dispatcher.dispatch(outbox.drain());
    assert.equal(engine.sequenceStarts().length, 3, '1 consumer + 2 professionals, once each');
  });

  test('replaying the whole outbox does not re-enrol anyone', async () => {
    service.route({ referralId: 'R1', consumer: sarah,
      professionals: [marcus, rachel], mode: 'consumer-choice' });

    const entries = outbox.drain();
    await dispatcher.dispatch(entries);
    const afterFirst = engine.sequenceStarts().length;

    const report = await dispatcher.dispatch(entries);   // full replay
    assert.equal(engine.sequenceStarts().length, afterFirst, 'no new enrolments on replay');
    assert.equal(report.skippedAsDuplicate, 3);
  });

  test('a network failure mid-send is flagged for a human, never blindly retried', async () => {
    service.route({ referralId: 'R1', consumer: sarah, professionals: [marcus], mode: 'direct' });
    const entries = outbox.drain();

    // Exhaust the retries on an idempotent call: the entry is reported as
    // retryable, nothing is flagged, and re-running it later succeeds.
    engine.failNextCalls = 3;
    const first = await dispatcher.dispatch(entries);
    assert.equal(first.flaggedForReview.length, 0, 'an idempotent failure is never a review case');
    assert.equal(first.retryable.length, 1, 'it is safe to run this one again');
    assert.equal(engine.sequenceStarts().length, 1, 'the professional still got their lead');

    const recovered = await dispatcher.dispatch(entries);
    assert.equal(recovered.retryable.length, 0, 'the retry succeeds once the network is back');
    assert.equal(
      engine.sequenceStarts().filter((x) => x.endsWith('SEQ_CONSUMER')).length, 1,
      'and the consumer is still enrolled exactly once',
    );

    engine.reset();
    // Now fail exactly the sequence start.
    const o2 = new Outbox(); const s2 = new ReferralService(o2);
    const l2 = new SentLedger(); const d2 = new Dispatcher(engine, l2, SEQUENCES);
    s2.route({ referralId: 'R2', consumer: sarah, professionals: [marcus], mode: 'direct' });
    const e2 = o2.drain();

    let calls = 0;
    const orig = engine.startSequence.bind(engine);
    engine.startSequence = async (c: string, s: string) => {
      if (++calls === 1) throw new Error('connection reset');
      return orig(c, s);
    };

    const report = await d2.dispatch(e2);
    assert.equal(report.flaggedForReview.length, 1);
    assert.equal(l2.needingReview().length, 1);

    // And a retry does NOT quietly send it anyway.
    const retry = await d2.dispatch(e2);
    assert.equal(retry.flaggedForReview.length, 0);
    assert.equal(retry.skippedAsDuplicate, 2);
  });
});

describe('stage changes', () => {
  test('a stage change writes one field, not a tag', async () => {
    service.route({ referralId: 'R1', consumer: sarah, professionals: [marcus], mode: 'direct' });
    outbox.drain();
    engine.reset();

    service.advance('R1', 'marcus-reyes', 'contacted');
    await dispatcher.dispatch(outbox.drain());

    const fieldWrites = engine.callsOf('setFields');
    assert.equal(fieldWrites.length, 1);
    assert.deepEqual((fieldWrites[0].args as any).fields, { referral_status: 'contacted' });
  });

  test('a professional cannot move a lead backwards', () => {
    service.route({ referralId: 'R1', consumer: sarah, professionals: [marcus], mode: 'direct' });
    service.advance('R1', 'marcus-reyes', 'consulted');
    assert.throws(() => service.advance('R1', 'marcus-reyes', 'viewed'), IllegalTransitionError);
  });

  test('re-clicking the current stage is harmless', () => {
    service.route({ referralId: 'R1', consumer: sarah, professionals: [marcus], mode: 'direct' });
    outbox.drain();
    service.advance('R1', 'marcus-reyes', 'contacted');
    outbox.drain();
    service.advance('R1', 'marcus-reyes', 'contacted');
    assert.equal(outbox.pending, 0, 'no duplicate intent for an unchanged stage');
  });

  test('a closed referral cannot be reopened', () => {
    service.route({ referralId: 'R1', consumer: sarah, professionals: [marcus], mode: 'direct' });
    service.advance('R1', 'marcus-reyes', 'contacted');
    service.advance('R1', 'marcus-reyes', 'retained');
    assert.throws(() => service.advance('R1', 'marcus-reyes', 'contacted'), IllegalTransitionError);
  });

  test('when one professional is retained, everyone else stops being chased', () => {
    service.route({ referralId: 'R1', consumer: sarah,
      professionals: [marcus, rachel, karen], mode: 'consumer-choice' });
    outbox.drain();

    service.advance('R1', 'marcus-reyes', 'contacted');
    service.advance('R1', 'marcus-reyes', 'retained');

    const closed = outbox.drain().find((e) => e.kind === 'referral.closed');
    assert.ok(closed, 'a close intent must be emitted');
    assert.deepEqual((closed!.payload as any).alsoStopFor, ['rachel-stern', 'karen-doyle']);
  });
});
