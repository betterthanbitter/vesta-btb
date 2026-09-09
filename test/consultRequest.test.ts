import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateConsultRequest } from '../src/leads/consultRequest.ts';

const good = {
  professionalId: '13893', name: 'Sarah M', email: 'sarah@example.com',
  sourcePath: '/boston-ma/family-law',
};

describe('the consult request form', () => {
  test('accepts a normal submission', () => {
    const r = validateConsultRequest(good);
    assert.equal(r.ok, true);
  });

  test('a lead with no way to reach them is not a lead', () => {
    const r = validateConsultRequest({ ...good, email: '' });
    assert.equal(r.ok, false);
    assert.match((r as any).errors.email, /email/i);
  });

  test('accepts the awkward addresses that trip up clever regexes', () => {
    for (const email of [
      "o'brien+divorce@sub.example.co.uk",
      'firstname.lastname@example-firm.com',
      'a@b.co',
    ]) {
      assert.equal(validateConsultRequest({ ...good, email }).ok, true, email);
    }
  });

  test('rejects what is plainly not an address', () => {
    for (const email of ['sarah', 'sarah@', '@example.com', 'a b@example.com', 'a@@b.com']) {
      assert.equal(validateConsultRequest({ ...good, email }).ok, false, email);
    }
  });

  test('normalizes the email so the same person is one contact in the CRM', () => {
    const r = validateConsultRequest({ ...good, email: '  Sarah@Example.COM ' });
    assert.equal((r as any).value.email, 'sarah@example.com');
  });

  test('an absolute sourcePath is discarded rather than stored', () => {
    for (const bad of ['https://evil.test/x', '//evil.test/x', 'javascript:alert(1)']) {
      const r = validateConsultRequest({ ...good, sourcePath: bad });
      assert.equal((r as any).value.sourcePath, '/', bad);
    }
  });

  test('caps a paste-bomb rather than storing it', () => {
    const r = validateConsultRequest({ ...good, message: 'x'.repeat(2001) });
    assert.equal(r.ok, false);
  });

  test('phone and message are optional', () => {
    const r = validateConsultRequest(good);
    assert.equal((r as any).value.phone, undefined);
    assert.equal((r as any).value.message, undefined);
  });
});
