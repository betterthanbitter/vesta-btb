import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeSocialLinks, toHttpsUrl, parseSocialLinks, SOCIAL_PLATFORMS } from '../src/professionals/social.ts';

describe('social links', () => {
  test('accepts a full address', () => {
    assert.equal(toHttpsUrl('https://linkedin.com/in/me'), 'https://linkedin.com/in/me');
  });

  test('accepts what people actually paste', () => {
    // A bare domain is the common case and refusing it loses the link.
    assert.equal(toHttpsUrl('linkedin.com/in/me'), 'https://linkedin.com/in/me');
    assert.equal(toHttpsUrl('  www.facebook.com/page  '), 'https://www.facebook.com/page');
  });

  test('upgrades http, because all of these serve https', () => {
    assert.equal(toHttpsUrl('http://instagram.com/me'), 'https://instagram.com/me');
  });

  test('a bare handle is refused — it does not identify a page', () => {
    assert.equal(toHttpsUrl('@me'), undefined);
  });

  test('refuses anything that would execute', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,<script>', 'file:///etc/passwd']) {
      assert.equal(toHttpsUrl(bad), undefined, bad);
    }
  });

  test('unknown platforms are dropped', () => {
    const out = sanitizeSocialLinks({ linkedin: 'linkedin.com/in/me', myspace: 'myspace.com/me' });
    assert.deepEqual(Object.keys(out), ['linkedin']);
  });

  test('empty values do not become entries', () => {
    assert.deepEqual(sanitizeSocialLinks({ linkedin: '  ', facebook: '' }), {});
  });

  test('malformed stored JSON does not take a page down', () => {
    assert.deepEqual(parseSocialLinks('{not json'), {});
    assert.deepEqual(parseSocialLinks(null), {});
  });

  test('every platform offered has a placeholder to guide the paste', () => {
    for (const p of SOCIAL_PLATFORMS) {
      assert.ok(p.placeholder.startsWith('https://'), `${p.name} has no example`);
    }
  });
});
