process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret';
process.env.COOKIE_SECURE = 'true';
process.env.NODE_ENV = 'production';

const assert = require('node:assert/strict');
const test = require('node:test');
const { buildApp } = require('../src/app');

test('trusts the TLS-terminating proxy before secure sessions are used', () => {
  const app = buildApp();

  assert.equal(app.get('trust proxy'), 1);
});
