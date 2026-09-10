import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { companionOffer, DEFAULT_COMPANION_TRIAL_URL } from '../src/products/companionOffer.ts';

describe('the community offer after a consult request', () => {
  test('uses Better Than Bitter’s own link when no channel link is set', () => {
    // Compared by parts, not as a string prefix: the tracking tags go before
    // the #email fragment, so the finished link never starts with the default.
    const got = new URL(companionOffer(undefined)!.href);
    const want = new URL(DEFAULT_COMPANION_TRIAL_URL);
    assert.equal(got.origin + got.pathname, want.origin + want.pathname);
    assert.equal(got.searchParams.get('request_host'), want.searchParams.get('request_host'));
  });

  test('records that the click came from the directory', () => {
    const u = new URL(companionOffer(undefined)!.href);
    assert.equal(u.searchParams.get('utm_source'), 'vesta-directory');
    assert.equal(u.searchParams.get('utm_medium'), 'consult-thank-you');
  });

  test('keeps a channel’s affiliate code intact', () => {
    const u = new URL(companionOffer('https://community.betterthanbitter.coach/checkout/companion-plus?af=CHANNEL42')!.href);
    assert.equal(u.searchParams.get('af'), 'CHANNEL42', 'the affiliate code is how the channel gets paid');
  });

  test('does not overwrite tracking a channel link already carries', () => {
    const u = new URL(companionOffer('https://example.com/x?utm_source=their-site')!.href);
    assert.equal(u.searchParams.get('utm_source'), 'their-site');
  });

  test('refuses a link that is not https', () => {
    assert.equal(companionOffer('javascript:alert(1)'), null);
    assert.equal(companionOffer('http://example.com'), null);
    assert.equal(companionOffer('not a url'), null);
  });
});

describe('the Circle sign-up link', () => {
  test('keeps everything Circle needs, and adds only the tracking', () => {
    const u = new URL(companionOffer(undefined)!.href);
    assert.equal(u.hostname, 'login.circle.so');
    assert.equal(u.pathname, '/sign_up');
    assert.equal(u.searchParams.get('request_host'), 'community.betterthanbitter.coach');
    assert.ok(u.searchParams.has('user[invitation_token]'), 'the token slot must survive');
    assert.equal(u.hash, '#email', 'the fragment Circle uses to focus the email field');
  });

  test('a channel’s invitation token is carried through untouched', () => {
    const channel = 'https://login.circle.so/sign_up?request_host=community.betterthanbitter.coach'
      + '&user%5Binvitation_token%5D=abc123-channel#email';
    const u = new URL(companionOffer(channel)!.href);
    assert.equal(u.searchParams.get('user[invitation_token]'), 'abc123-channel');
    assert.equal(u.hash, '#email');
  });
});
