import { randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';
import { describe, expect, test } from 'vitest';
import { verifySessionToken } from '@/lib/session-token';
import type { Config } from './config';
import {
  type GoogleClient,
  callbackUrl,
  completeSignIn,
  isOwner,
  startSignIn,
} from './google-sign-in';

const origin = 'https://app.example.com';
const now = new Date('2026-10-01T12:00:00Z');
const config: Config = {
  googleClientId: 'client-id',
  googleClientSecret: 'client-secret',
  sessionSecret: randomBytes(32).toString('base64'),
  ownerEmail: 'owner@example.com',
};
const ownerClaims = { sub: 'google-subject-1', email: 'Owner@Example.com', email_verified: true };
const authorizationCode = 'authorization-code-value';
const accessToken = 'ya29.access-token-value';

function encodeSegment(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function idTokenFor(claims: object): string {
  return `${encodeSegment({ alg: 'RS256' })}.${encodeSegment(claims)}.signature`;
}

type FakeClientOptions = {
  claims?: object;
  exchangeFails?: boolean;
};

type FakeClient = GoogleClient & {
  authorizationRequests: { state: string; codeVerifier: string; scopes: string[] }[];
  exchanges: { code: string; codeVerifier: string }[];
};

function fakeClient({
  claims = ownerClaims,
  exchangeFails = false,
}: FakeClientOptions = {}): FakeClient {
  const client: FakeClient = {
    authorizationRequests: [],
    exchanges: [],
    createAuthorizationURL(state, codeVerifier, scopes) {
      client.authorizationRequests.push({ state, codeVerifier, scopes });
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.searchParams.set('state', state);
      url.searchParams.set('scope', scopes.join(' '));
      url.searchParams.set('code_challenge_method', 'S256');
      return url;
    },
    validateAuthorizationCode(code, codeVerifier) {
      client.exchanges.push({ code, codeVerifier });
      if (exchangeFails) {
        return Promise.reject(new Error('token endpoint unreachable'));
      }
      return Promise.resolve({
        idToken: () => idTokenFor(claims),
        accessToken: () => accessToken,
      });
    },
  };
  return client;
}

type CallbackOptions = {
  query?: Record<string, string>;
  cookies?: Record<string, string>;
};

function callbackRequest({ query = {}, cookies }: CallbackOptions = {}): NextRequest {
  const url = new URL('/api/auth/google/callback', origin);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  const cookieHeader = Object.entries(
    cookies ?? {
      oauth_state: 'expected-state',
      oauth_code_verifier: 'code-verifier',
      oauth_return_to: '/fitness-tracker',
    },
  )
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
  return new NextRequest(url, { headers: { cookie: cookieHeader } });
}

const validCallbackQuery = { code: authorizationCode, state: 'expected-state' };

function setCookies(response: Response): string[] {
  return response.headers.getSetCookie();
}

function cookieNamed(response: Response, name: string): string | undefined {
  return setCookies(response).find((cookie) => cookie.startsWith(`${name}=`));
}

function cookieValue(response: Response, name: string): string | undefined {
  return cookieNamed(response, name)
    ?.split(';')[0]
    ?.slice(name.length + 1);
}

function expectRedirectTo(response: Response, location: string): void {
  expect(response.status).toBe(302);
  expect(response.headers.get('location')).toBe(new URL(location, origin).toString());
}

function expectOauthCookiesCleared(response: Response): void {
  for (const name of ['oauth_state', 'oauth_code_verifier', 'oauth_return_to']) {
    expect(cookieNamed(response, name)).toMatch(/Max-Age=0/i);
  }
}

async function expectNoSecretsLeaked(response: Response): Promise<void> {
  const exposed = `${response.headers.get('location') ?? ''}${await response.text()}`;
  expect(exposed).not.toContain(authorizationCode);
  expect(exposed).not.toContain(accessToken);
  expect(exposed).not.toContain(idTokenFor(ownerClaims));
}

describe('isOwner', () => {
  test('accepts the verified owner email in any letter case', () => {
    expect(isOwner(ownerClaims, config.ownerEmail)).toBe(true);
  });

  test('rejects an unverified owner email', () => {
    expect(isOwner({ ...ownerClaims, email_verified: false }, config.ownerEmail)).toBe(false);
  });

  test('rejects another account', () => {
    expect(isOwner({ ...ownerClaims, email: 'someone@example.com' }, config.ownerEmail)).toBe(
      false,
    );
  });

  test('rejects claims without an email', () => {
    expect(isOwner({ sub: 'google-subject-1', email_verified: true }, config.ownerEmail)).toBe(
      false,
    );
  });
});

describe('callbackUrl', () => {
  test('points at the callback route on the request origin', () => {
    expect(callbackUrl(new Request(`${origin}/api/auth/google?returnTo=%2F`))).toBe(
      `${origin}/api/auth/google/callback`,
    );
  });
});

describe('startSignIn', () => {
  test('redirects to Google asking only for identity, with PKCE and state', () => {
    const client = fakeClient();
    const response = startSignIn(new NextRequest(`${origin}/api/auth/google`), client);

    expect(response.status).toBe(302);
    const location = new URL(response.headers.get('location') ?? '');
    expect(location.origin).toBe('https://accounts.google.com');
    expect(location.searchParams.get('scope')).toBe('openid email profile');
    expect(location.searchParams.get('code_challenge_method')).toBe('S256');
    expect(location.searchParams.get('state')).toBe(client.authorizationRequests[0]?.state);
  });

  test('remembers state, verifier and return path in short-lived http-only cookies', () => {
    const client = fakeClient();
    const response = startSignIn(
      new NextRequest(`${origin}/api/auth/google?returnTo=%2Ffitness-tracker`),
      client,
    );
    const [request] = client.authorizationRequests;

    expect(cookieValue(response, 'oauth_state')).toBe(request?.state);
    expect(cookieValue(response, 'oauth_code_verifier')).toBe(request?.codeVerifier);
    expect(cookieValue(response, 'oauth_return_to')).toBe(encodeURIComponent('/fitness-tracker'));
    for (const name of ['oauth_state', 'oauth_code_verifier', 'oauth_return_to']) {
      expect(cookieNamed(response, name)).toMatch(/Max-Age=600/i);
      expect(cookieNamed(response, name)).toMatch(/HttpOnly/i);
    }
  });

  test('replaces an unsafe return path with the landing page', () => {
    const response = startSignIn(
      new NextRequest(`${origin}/api/auth/google?returnTo=%2F%2Fevil.com`),
      fakeClient(),
    );

    expect(cookieValue(response, 'oauth_return_to')).toBe(encodeURIComponent('/'));
  });

  test('each attempt uses a fresh state and verifier', () => {
    const client = fakeClient();
    startSignIn(new NextRequest(`${origin}/api/auth/google`), client);
    startSignIn(new NextRequest(`${origin}/api/auth/google`), client);
    const [first, second] = client.authorizationRequests;

    expect(first?.state).not.toBe(second?.state);
    expect(first?.codeVerifier).not.toBe(second?.codeVerifier);
  });
});

describe('completeSignIn', () => {
  test('a cancelled consent returns to the sign-in screen as cancelled', async () => {
    const response = await completeSignIn(
      callbackRequest({ query: { error: 'access_denied', state: 'expected-state' } }),
      fakeClient(),
      config,
      now,
    );

    expectRedirectTo(response, '/sign-in?error=cancelled');
    expectOauthCookiesCleared(response);
  });

  test('any other Google error reports sign-in as unavailable', async () => {
    const response = await completeSignIn(
      callbackRequest({ query: { error: 'server_error' } }),
      fakeClient(),
      config,
      now,
    );

    expectRedirectTo(response, '/sign-in?error=unavailable');
    expectOauthCookiesCleared(response);
  });

  test.each([
    ['the state is missing', { code: authorizationCode }, undefined],
    ['the state does not match', { code: authorizationCode, state: 'forged-state' }, undefined],
    [
      'the state cookie is missing',
      validCallbackQuery,
      { oauth_code_verifier: 'code-verifier', oauth_return_to: '/' },
    ],
    [
      'the verifier cookie is missing',
      validCallbackQuery,
      { oauth_state: 'expected-state', oauth_return_to: '/' },
    ],
    ['the code is missing', { state: 'expected-state' }, undefined],
  ])('an attempt where %s is reported as expired', async (_, query, cookies) => {
    const client = fakeClient();
    const response = await completeSignIn(callbackRequest({ query, cookies }), client, config, now);

    expectRedirectTo(response, '/sign-in?error=expired');
    expectOauthCookiesCleared(response);
    expect(client.exchanges).toHaveLength(0);
  });

  test('a failed code exchange reports sign-in as unavailable', async () => {
    const response = await completeSignIn(
      callbackRequest({ query: validCallbackQuery }),
      fakeClient({ exchangeFails: true }),
      config,
      now,
    );

    expectRedirectTo(response, '/sign-in?error=unavailable');
    expectOauthCookiesCleared(response);
  });

  test('another account is refused without a session', async () => {
    const response = await completeSignIn(
      callbackRequest({ query: validCallbackQuery }),
      fakeClient({ claims: { ...ownerClaims, email: 'someone@example.com' } }),
      config,
      now,
    );

    expectRedirectTo(response, '/sign-in?error=not-allowed');
    expect(cookieNamed(response, 'session')).toBeUndefined();
    expectOauthCookiesCleared(response);
  });

  test('the owner gets a 90-day session and returns to where they were heading', async () => {
    const client = fakeClient();
    const response = await completeSignIn(
      callbackRequest({ query: validCallbackQuery }),
      client,
      config,
      now,
    );

    expectRedirectTo(response, '/fitness-tracker');
    expect(client.exchanges).toEqual([{ code: authorizationCode, codeVerifier: 'code-verifier' }]);
    expect(cookieNamed(response, 'session')).toMatch(/Max-Age=7776000/i);
    expect(cookieNamed(response, 'session')).toMatch(/HttpOnly/i);
    expect(cookieNamed(response, 'session')).toMatch(/Secure/i);
    await expect(
      verifySessionToken(cookieValue(response, 'session'), config.sessionSecret, now),
    ).resolves.toEqual({ sub: ownerClaims.sub, email: ownerClaims.email });
    expectOauthCookiesCleared(response);
  });

  test('an unsafe remembered return path falls back to the landing page', async () => {
    const response = await completeSignIn(
      callbackRequest({
        query: validCallbackQuery,
        cookies: {
          oauth_state: 'expected-state',
          oauth_code_verifier: 'code-verifier',
          oauth_return_to: '//evil.com',
        },
      }),
      fakeClient(),
      config,
      now,
    );

    expectRedirectTo(response, '/');
  });

  test('the session never carries a Google token', async () => {
    const response = await completeSignIn(
      callbackRequest({ query: validCallbackQuery }),
      fakeClient(),
      config,
      now,
    );

    expect(setCookies(response).join('\n')).not.toContain(accessToken);
    await expectNoSecretsLeaked(response);
  });
});
