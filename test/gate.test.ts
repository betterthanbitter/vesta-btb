import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { issueToken, verifyToken, safeNext, timingSafeEqual } from '../src/auth/gate.ts';

describe('the preview gate', () => {
  test('a token it issued, it accepts', async () => {
    assert.equal(await verifyToken(await issueToken('hunter2'), 'hunter2'), true);
  });

  test('a token signed with another password is refused', async () => {
    assert.equal(await verifyToken(await issueToken('hunter2'), 'different'), false);
  });

  test('an expired token is refused', async () => {
    const long_ago = Date.now() - 40 * 24 * 60 * 60 * 1000;
    assert.equal(await verifyToken(await issueToken('p', long_ago), 'p'), false);
  });

  test('a forged token — right shape, invented signature — is refused', async () => {
    const future = Date.now() + 60_000;
    assert.equal(await verifyToken(`${future}.notarealsignature`, 'p'), false);
  });

  test('extending the expiry without re-signing is refused', async () => {
    const token = await issueToken('p');
    const sig = token.slice(token.indexOf('.'));
    const tampered = `${Date.now() + 999_999_999}${sig}`;
    assert.equal(await verifyToken(tampered, 'p'), false);
  });

  test('junk is refused rather than throwing', async () => {
    for (const bad of [undefined, '', 'x', '.', 'abc.def']) {
      assert.equal(await verifyToken(bad as any, 'p'), false, String(bad));
    }
  });
});

describe('where the gate sends you afterwards', () => {
  test('keeps you on this site', () => {
    assert.equal(safeNext('/boston-ma/family-law'), '/boston-ma/family-law');
  });

  test('refuses to be an open redirect', () => {
    for (const bad of ['https://evil.test', '//evil.test', 'javascript:alert(1)', null]) {
      assert.equal(safeNext(bad as any), '/', String(bad));
    }
  });

  test('comparison is length-safe', () => {
    assert.equal(timingSafeEqual('abc', 'abcd'), false);
    assert.equal(timingSafeEqual('abc', 'abc'), true);
  });
});
