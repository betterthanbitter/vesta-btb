import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  ApplicationError, mapApplication, slugifyHub, OCCUPATION_TO_CATEGORY,
} from '../src/professionals/application.ts';

/** A submission shaped exactly like the live form posts. */
const submission = {
  signup_path: 'reseller',
  partner_name: 'Vesta',
  program: 'Professional Authority Co-Op Marketing Partnership (PAC.MP)',
  first_name: 'Marcus', last_name: 'Reyes',
  email: '  Marcus@ReyesLaw.COM ',
  phone: '617-555-0142',
  credentials: 'JD, CDFA®',
  company: 'Reyes Family Law',
  website: 'https://reyeslaw.com',
  street: '1 City Hall Square', city: 'Newton', state: 'MA', zip: '02458',
  states_licensed: ['MA', 'RI', 'NH'],
  occupation: 'Attorney',
  bio: 'Attorney-mediator focused on keeping families out of court.',
};

describe('an application from the live form', () => {
  test('captures everything the directory is currently missing', () => {
    const p = mapApplication(submission);
    assert.equal(p.company, 'Reyes Family Law', 'the live directory has no firm for anyone');
    assert.equal(p.phone, '617-555-0142', 'the live directory has no phone for anyone');
    assert.equal(p.credentials, 'JD, CDFA®', 'currently jammed into the name field');
    assert.equal(p.statesLicensed, 'MA, RI, NH');
  });

  test('never publishes anyone straight from a form', () => {
    // Every application is reviewed and vetted. That promise has to be true in
    // the data, not only in somebody's inbox.
    assert.equal(mapApplication(submission).status, 'applied');
  });

  test('the email is normalized, so one person is one record', () => {
    assert.equal(mapApplication(submission).email, 'marcus@reyeslaw.com');
  });

  test('a profession becomes the category a consumer browses', () => {
    assert.equal(mapApplication(submission).category, 'family-law');
    assert.equal(
      mapApplication({ ...submission, occupation: 'Lending Professional' }).category,
      'mortgage',
    );
  });

  test('every profession on the live form maps to something', () => {
    const onTheForm = [
      'Attorney', 'CDFA', 'Mediator', 'Lending Professional', 'Realtor', 'Accountant',
      'Career Coach', 'Divorce Coach (Coach Co-Op Marketing Partnership)',
      'Other professional service',
    ];
    for (const o of onTheForm) {
      assert.ok(OCCUPATION_TO_CATEGORY[o], `"${o}" is on the form but maps to nothing`);
    }
  });

  test('an unmapped profession is refused rather than guessed', () => {
    // Guessing would file an attorney under coaching and tell nobody.
    assert.throws(
      () => mapApplication({ ...submission, occupation: 'Astronaut' }),
      ApplicationError,
    );
  });

  test('both content programs arrive at Premium', () => {
    assert.equal(mapApplication(submission).tier, 'premium');
    assert.equal(
      mapApplication({ ...submission, program: 'Coach Co-Op Marketing Partnership (CCMP)',
        occupation: 'Divorce Coach (Coach Co-Op Marketing Partnership)' }).tier,
      'premium',
    );
  });

  test('no program means Standard, not nothing', () => {
    assert.equal(mapApplication({ ...submission, program: '' }).tier, 'standard');
  });

  test('the hub is derived so they land on a real directory page', () => {
    assert.equal(mapApplication(submission).hub, 'newton-ma');
    assert.equal(slugifyHub('Lexington / Winchester', 'MA'), 'lexington-winchester-ma');
    assert.equal(slugifyHub(undefined, 'MA'), undefined);
  });

  test('the reseller who placed them is kept, for commission', () => {
    const p = mapApplication(submission);
    assert.equal(p.signupPath, 'reseller');
    assert.equal(p.partnerName, 'Vesta');
  });

  test('CCMP group slots are collapsed into one field', () => {
    const p = mapApplication({
      ...submission, group_slot_1: 'Tue 7pm', group_slot_2: 'Thu 12pm', group_slot_3: '',
    });
    assert.equal(p.groupSlots, 'Tue 7pm | Thu 12pm');
  });

  test('an application with no email is refused', () => {
    assert.throws(() => mapApplication({ ...submission, email: '' }), ApplicationError);
  });
});
