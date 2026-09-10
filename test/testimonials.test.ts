import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDb } from '../src/db/index.ts';
import { LeadRepository } from '../src/db/leadRepository.ts';
import { SqlOutbox } from '../src/db/repositories.ts';
import { TestimonialRepository } from '../src/testimonials/repository.ts';
import {
  displayName, isReviewToken, newReviewToken, siteOrigin, summarize, validateTestimonial,
} from '../src/testimonials/testimonial.ts';
import { isPublicReviewRequest } from '../src/auth/gate.ts';
import { SentLedger } from '../src/referral/outbox.ts';
import { FakeDeliveryEngine } from '../src/delivery/fake.ts';
import { Dispatcher } from '../src/delivery/dispatcher.ts';
import type { Professional } from '../src/referral/types.ts';

const lisa: Professional = {
  id: '13893', email: 'lisa@example.com', firstName: 'Lisa', lastName: 'Cukier', firm: '',
  hub: 'boston-ma', category: 'family-law', tier: 'platinum',
};

const good = {
  rating: 5,
  liked: 'Lisa explained every step and never made me feel rushed.',
  displayAs: 'initial',
  publish: 'yes',
};

/** A lead taken all the way to hired, the only way a review link is made. */
async function hiredLead() {
  const db = await openTestDb();
  const leads = new LeadRepository(db);
  const consumer = await leads.upsertConsumer({
    email: 'sarah@example.com', firstName: 'Sarah', lastName: 'Miller',
    hub: 'boston-ma', categoryNeeded: 'family-law',
  });
  const referral = await leads.route({ consumer, professionals: [lisa], mode: 'direct' });
  await leads.advance(referral.id, lisa.id, 'contacted');
  await leads.advance(referral.id, lisa.id, 'hired');
  const [lead] = await leads.forProfessional(lisa.id);
  return { db, leads, referral, token: lead.review!.token, repo: new TestimonialRepository(db) };
}

const asks = async (db: any) =>
  (await new SqlOutbox(db).pending()).filter((e) => e.kind === 'testimonial.requested');

describe('what a client writes', () => {
  test('accepts a normal testimonial', () => {
    const r = validateTestimonial(good);
    assert.equal(r.ok, true);
    assert.equal((r as any).value.publish, true);
  });

  test('a rating is a whole number of stars from one to five', () => {
    for (const rating of [0, 6, 4.5, undefined, 'five']) {
      assert.equal(validateTestimonial({ ...good, rating }).ok, false, String(rating));
    }
  });

  test('asks for more than a word or two', () => {
    const r = validateTestimonial({ ...good, liked: 'Great!' });
    assert.equal(r.ok, false);
    assert.match((r as any).errors.liked, /little more/);
  });

  test('publication is only ever something the client ticked', () => {
    assert.equal((validateTestimonial({ ...good, publish: undefined }) as any).value.publish, false);
    assert.equal((validateTestimonial({ ...good, publish: 'no' }) as any).value.publish, false);
  });

  test('the name appears the way the client chose', () => {
    assert.equal(displayName('Sarah', 'Miller', 'initial'), 'Sarah M.');
    assert.equal(displayName('Sarah', 'Miller', 'first'), 'Sarah');
    assert.equal(displayName('Sarah', 'Miller', 'anonymous'), 'A Vesta client');
    assert.equal(displayName('Sarah', '', 'initial'), 'Sarah');
  });

  test('an average needs ratings behind it', () => {
    assert.deepEqual(summarize([]), { count: 0, average: null });
    assert.deepEqual(summarize([5, 4, 4]), { count: 3, average: 4.3 });
  });
});

describe('review links', () => {
  test('are unguessable and recognizably shaped', () => {
    const t = newReviewToken();
    assert.equal(isReviewToken(t), true);
    assert.notEqual(t, newReviewToken());
    for (const bad of ['', 'abc', '../../etc/passwd', `${t}x`, undefined]) {
      assert.equal(isReviewToken(bad), false, String(bad));
    }
  });

  test('point at the real site address', () => {
    assert.equal(siteOrigin({ PUBLIC_SITE_URL: 'https://vesta.example/', URL: 'https://x.netlify.app' }),
      'https://vesta.example');
    assert.equal(siteOrigin({ URL: 'https://directoryvesta.netlify.app' }),
      'https://directoryvesta.netlify.app');
  });

  test('reach a client without the preview password, and nothing else does', () => {
    const t = newReviewToken();
    assert.equal(isPublicReviewRequest('GET', `/review/${t}`), true);
    assert.equal(isPublicReviewRequest('POST', '/api/review'), true);
    // A POST to a page is how Next runs server actions — the back office's
    // included. The review page must never become a way round the gate.
    assert.equal(isPublicReviewRequest('POST', `/review/${t}`), false);
    assert.equal(isPublicReviewRequest('GET', '/admin'), false);
    assert.equal(isPublicReviewRequest('GET', '/review/nope'), false);
  });
});

describe('asking a hired client', () => {
  test('marking a lead hired makes the link and queues one ask', async () => {
    const { db, token } = await hiredLead();
    const queued = await asks(db);
    assert.equal(queued.length, 1);
    assert.equal(queued[0].payload.reviewUrl, `http://localhost:3100/review/${token}`);
    assert.equal(queued[0].payload.consumerEmail, 'sarah@example.com');
    await db.close();
  });

  test('a lead that is not hired has no link, and cannot be given one', async () => {
    const db = await openTestDb();
    const leads = new LeadRepository(db);
    const consumer = await leads.upsertConsumer({
      email: 'sam@example.com', firstName: 'Sam', hub: 'boston-ma', categoryNeeded: 'family-law',
    });
    const referral = await leads.route({ consumer, professionals: [lisa], mode: 'direct' });
    await leads.advance(referral.id, lisa.id, 'contacted');
    assert.equal((await leads.forProfessional(lisa.id))[0].review, undefined);
    await assert.rejects(() =>
      new TestimonialRepository(db).request(referral.id, lisa.id, 'http://localhost:3100'));
    await db.close();
  });

  test('asking again gives the same link and does not ask twice', async () => {
    const { db, referral, token, repo } = await hiredLead();
    const again = await repo.request(referral.id, lisa.id, 'http://localhost:3100');
    assert.equal(again.token, token);
    assert.equal((await asks(db)).length, 1);
    await db.close();
  });

  test('the ask reaches the delivery engine once, and only when the sequence exists', async () => {
    const { db } = await hiredLead();
    const entries = await asks(db);

    const unset = new FakeDeliveryEngine();
    await new Dispatcher(unset, new SentLedger(),
      { consumerAfterRouting: 'A', professionalNewLead: 'B' }).dispatch(entries);
    assert.equal(unset.sequenceStarts().length, 0);

    const engine = new FakeDeliveryEngine();
    const dispatcher = new Dispatcher(engine, new SentLedger(),
      { consumerAfterRouting: 'A', professionalNewLead: 'B', testimonialRequest: 'SEQ_REVIEW' });
    await dispatcher.dispatch(entries);
    await dispatcher.dispatch(entries);
    assert.equal(engine.sequenceStarts().filter((s) => s.endsWith('SEQ_REVIEW')).length, 1);
    await db.close();
  });
});

describe('testimonials', () => {
  test('one per link — the second attempt is refused', async () => {
    const { db, token, repo, leads } = await hiredLead();
    const first = await repo.submit(token, (validateTestimonial(good) as any).value);
    assert.deepEqual(first, { ok: true, professionalId: lisa.id, status: 'pending' });
    const second = await repo.submit(token, (validateTestimonial(good) as any).value);
    assert.deepEqual(second, { ok: false, reason: 'already' });

    const [lead] = await leads.forProfessional(lisa.id);
    assert.equal(lead.review?.status, 'pending');
    assert.equal(lead.review?.rating, 5);
    const received = (await new SqlOutbox(db).pending()).filter((e) => e.kind === 'testimonial.received');
    assert.equal(received.length, 1, 'the delivery engine is told to stop asking');
    await db.close();
  });

  test('a made-up link gets nowhere', async () => {
    const { db, repo } = await hiredLead();
    const value = (validateTestimonial(good) as any).value;
    assert.deepEqual(await repo.submit(newReviewToken(), value), { ok: false, reason: 'unknown' });
    assert.deepEqual(await repo.submit('not-a-token', value), { ok: false, reason: 'unknown' });
    await db.close();
  });

  test('nothing is public until Vesta approves it', async () => {
    const { db, token, repo } = await hiredLead();
    await repo.submit(token, (validateTestimonial(good) as any).value);
    assert.equal((await repo.published(lisa.id)).length, 0);

    const [pending] = await repo.pending();
    assert.equal(await repo.decide(pending.id, 'published'), lisa.id);
    const shown = await repo.published(lisa.id);
    assert.equal(shown.length, 1);
    assert.equal(shown[0].displayName, 'Sarah M.');
    await db.close();
  });

  test('a declined testimonial stays off the profile', async () => {
    const { db, token, repo } = await hiredLead();
    await repo.submit(token, (validateTestimonial(good) as any).value);
    const [pending] = await repo.pending();
    await repo.decide(pending.id, 'declined');
    assert.equal((await repo.published(lisa.id)).length, 0);
    await db.close();
  });

  test('without the client’s permission it can never be published', async () => {
    const { db, token, repo } = await hiredLead();
    const r = await repo.submit(token, (validateTestimonial({ ...good, publish: undefined }) as any).value);
    assert.equal((r as any).status, 'private');
    assert.equal((await repo.pending()).length, 0);
    const id = (await db.query<{ id: string }>('SELECT id FROM testimonials'))[0].id;
    assert.equal(await repo.decide(id, 'published'), null);
    assert.equal((await repo.published(lisa.id)).length, 0);
    await db.close();
  });
});
