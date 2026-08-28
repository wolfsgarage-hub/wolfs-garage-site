// Auth gate tests for the Weekend Sheet drafter endpoint.
// The trigger paths demand a valid x-wg-token; the status probe is public but
// leaks nothing beyond "was this week drafted".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/sheet-draft.js';

function fakeRes() {
  return {
    statusCode: null,
    body: null,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; return this; },
    send(t) { this.body = t; return this; }
  };
}

test('trigger without a token is refused', async () => {
  const res = fakeRes();
  await handler({ method: 'GET', headers: {}, query: {} }, res);
  assert.equal(res.statusCode, 401);
});

test('trigger with a wrong token is refused', async () => {
  const res = fakeRes();
  await handler({ method: 'GET', headers: { 'x-wg-token': 'not-the-token' }, query: {} }, res);
  assert.equal(res.statusCode, 401);
});

test('dry mode still demands the token', async () => {
  const res = fakeRes();
  await handler({ method: 'GET', headers: {}, query: { dry: '1' } }, res);
  assert.equal(res.statusCode, 401);
});

test('status probe is public but degrades cleanly without the Mailchimp key', async () => {
  const res = fakeRes();
  await handler({ method: 'GET', headers: {}, query: { status: '1' } }, res);
  assert.notEqual(res.statusCode, 401);
  assert.equal(res.body && res.body.error, 'not_configured');
});

test('non-GET/POST methods are refused', async () => {
  const res = fakeRes();
  await handler({ method: 'DELETE', headers: {}, query: {} }, res);
  assert.equal(res.statusCode, 405);
});
