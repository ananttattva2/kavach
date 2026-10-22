import assert from 'node:assert/strict';
import { authOrigins } from '../lib/auth-origins.ts';

assert.ok(authOrigins('http://localhost:9000').includes('http://localhost:3000'));
assert.ok(authOrigins('http://localhost:9000').includes('http://localhost:9000'));
assert.deepEqual(authOrigins('https://kavach.example.com'), ['https://kavach.example.com']);
assert.ok(!authOrigins('http://localhost:9000').includes('https://unknown.example.com'));

const base = process.env.QA_BASE_URL || 'http://localhost:9000';
for (const origin of ['http://localhost:3000', 'http://localhost:9000', 'https://unknown.example.com']) {
  const response = await fetch(base + '/api/auth/sign-in/email-otp', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: 'origin-regression=1', 'X-Forwarded-For': '192.0.2.47' },
    body: JSON.stringify({ email: 'origin-regression@example.invalid', type: 'sign-in', otp: '000000' }),
  });
  const result = await response.json();
  if (origin.includes('unknown')) {
    assert.equal(response.status, 403);
    assert.equal(result.code, 'INVALID_ORIGIN');
  } else {
    assert.equal(response.status, 400);
    assert.notEqual(result.code, 'INVALID_ORIGIN');
  }
  console.log(origin + ': ' + response.status + ' ' + result.code);
}
console.log('PASS local origin compatibility and production origin isolation. No emails sent.');



