import { randomBytes } from 'node:crypto';
import { SignJWT, decodeJwt } from 'jose';
import { describe, expect, test } from 'vitest';
import { sessionLifetimeSeconds, signSessionToken, verifySessionToken } from './session-token';

const secret = randomBytes(32).toString('base64');
const otherSecret = randomBytes(32).toString('base64');
const issuedAt = new Date('2026-10-01T12:00:00Z');
const owner = { sub: 'google-subject-1', email: 'owner@example.com' };

function secondsAfter(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

describe('session token', () => {
  test('a signed token verifies back to its claims', async () => {
    const token = await signSessionToken(owner, secret, issuedAt);

    await expect(verifySessionToken(token, secret, issuedAt)).resolves.toEqual(owner);
  });

  test('a token lives for 90 days', async () => {
    const token = await signSessionToken(owner, secret, issuedAt);
    const { iat, exp } = decodeJwt(token);

    expect(sessionLifetimeSeconds).toBe(7776000);
    expect(exp).toBe((iat ?? 0) + 7776000);
  });

  test('a token is still valid just before it expires', async () => {
    const token = await signSessionToken(owner, secret, issuedAt);

    await expect(
      verifySessionToken(token, secret, secondsAfter(issuedAt, sessionLifetimeSeconds - 1)),
    ).resolves.toEqual(owner);
  });

  test('an expired token is rejected', async () => {
    const token = await signSessionToken(owner, secret, issuedAt);

    await expect(
      verifySessionToken(token, secret, secondsAfter(issuedAt, sessionLifetimeSeconds + 1)),
    ).resolves.toBeNull();
  });

  test('a token with an altered payload is rejected', async () => {
    const token = await signSessionToken(owner, secret, issuedAt);
    const [header, , signature] = token.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ ...decodeJwt(token), email: 'intruder@example.com' }),
    ).toString('base64url');

    await expect(
      verifySessionToken(`${header}.${forgedPayload}.${signature}`, secret, issuedAt),
    ).resolves.toBeNull();
  });

  test('a token with an altered signature is rejected', async () => {
    const token = await signSessionToken(owner, secret, issuedAt);
    const tampered = `${token.slice(0, -2)}${token.endsWith('AA') ? 'BB' : 'AA'}`;

    await expect(verifySessionToken(tampered, secret, issuedAt)).resolves.toBeNull();
  });

  test('a token signed with another secret is rejected', async () => {
    const token = await signSessionToken(owner, otherSecret, issuedAt);

    await expect(verifySessionToken(token, secret, issuedAt)).resolves.toBeNull();
  });

  test('a token signed with HS512 is rejected', async () => {
    const token = await new SignJWT({ email: owner.email })
      .setProtectedHeader({ alg: 'HS512' })
      .setSubject(owner.sub)
      .setIssuedAt(issuedAt)
      .setExpirationTime(secondsAfter(issuedAt, 60))
      .sign(Buffer.from(secret, 'base64'));

    await expect(verifySessionToken(token, secret, issuedAt)).resolves.toBeNull();
  });

  test('an unsigned token is rejected', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ ...owner, iat: 0, exp: 4102444800 })).toString(
      'base64url',
    );

    await expect(verifySessionToken(`${header}.${payload}.`, secret, issuedAt)).resolves.toBeNull();
  });

  test('a token missing its email is rejected', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(owner.sub)
      .setIssuedAt(issuedAt)
      .setExpirationTime(secondsAfter(issuedAt, 60))
      .sign(Buffer.from(secret, 'base64'));

    await expect(verifySessionToken(token, secret, issuedAt)).resolves.toBeNull();
  });

  test.each([[''], [undefined], ['not-a-token']])('%j is rejected', async (value) => {
    await expect(verifySessionToken(value, secret, issuedAt)).resolves.toBeNull();
  });
});
