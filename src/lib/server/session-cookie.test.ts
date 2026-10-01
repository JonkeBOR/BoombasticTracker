import { expect, test } from 'vitest';
import { cookieAttributes } from './session-cookie';

test('cookies are http-only, lax and site-wide with the given lifetime', () => {
  expect(cookieAttributes(new URL('https://app.example.com/callback'), 600)).toEqual({
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
    secure: true,
  });
});

test('cookies are secure only when the request arrived over https', () => {
  expect(cookieAttributes(new URL('http://localhost:3000/callback'), 600).secure).toBe(false);
});
