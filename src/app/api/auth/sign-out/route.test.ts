import { expect, test } from 'vitest';
import { POST } from './route';

const signOutUrl = 'https://app.example.com/api/auth/sign-out';

test.each([
  ['with a session', { cookie: 'session=signed-session-token' }],
  ['without a session', {}],
])('signing out %s clears the session and returns to sign-in', (_, headers) => {
  const response = POST(new Request(signOutUrl, { method: 'POST', headers }));

  expect(response.status).toBe(303);
  expect(response.headers.get('location')).toBe('https://app.example.com/sign-in');
  const sessionCookie = response.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith('session='));
  expect(sessionCookie).toMatch(/^session=;/);
  expect(sessionCookie).toMatch(/Max-Age=0/i);
  expect(sessionCookie).toMatch(/HttpOnly/i);
});
