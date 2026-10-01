import 'server-only';
import { Google, decodeIdToken, generateCodeVerifier, generateState } from 'arctic';
import { NextResponse, type NextRequest } from 'next/server';
import { safeReturnTo } from '@/lib/return-to';
import type { SignInError } from '@/lib/sign-in-error';
import { signSessionToken, sessionLifetimeSeconds } from '@/lib/session-token';
import type { Config } from './config';
import {
  cookieAttributes,
  oauthReturnToCookieName,
  oauthStateCookieName,
  oauthVerifierCookieName,
  sessionCookieName,
} from './session-cookie';

export type GoogleClient = {
  createAuthorizationURL(state: string, codeVerifier: string, scopes: string[]): URL;
  validateAuthorizationCode(code: string, codeVerifier: string): Promise<{ idToken(): string }>;
};

type IdentityClaims = {
  sub: string;
  email: string;
  email_verified: boolean;
};

const identityScopes = ['openid', 'email', 'profile'];
const signInAttemptSeconds = 600;
const oauthCookieNames = [oauthStateCookieName, oauthVerifierCookieName, oauthReturnToCookieName];

export function createGoogleClient(config: Config, redirectUri: string): GoogleClient {
  return new Google(config.googleClientId, config.googleClientSecret, redirectUri);
}

export function callbackUrl(request: Request): string {
  return new URL('/api/auth/google/callback', request.url).toString();
}

export function isOwner(claims: Partial<IdentityClaims>, ownerEmail: string): boolean {
  return (
    claims.email_verified === true &&
    typeof claims.email === 'string' &&
    claims.email.toLowerCase() === ownerEmail.toLowerCase()
  );
}

function isIdentityClaims(value: object): value is IdentityClaims {
  return 'sub' in value && typeof value.sub === 'string' && value.sub.length > 0;
}

export function startSignIn(request: NextRequest, client: GoogleClient): NextResponse {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const authorizationUrl = client.createAuthorizationURL(state, codeVerifier, identityScopes);
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get('returnTo'));

  const response = NextResponse.redirect(authorizationUrl, 302);
  const attributes = cookieAttributes(request.nextUrl, signInAttemptSeconds);
  response.cookies.set(oauthStateCookieName, state, attributes);
  response.cookies.set(oauthVerifierCookieName, codeVerifier, attributes);
  response.cookies.set(oauthReturnToCookieName, returnTo, attributes);
  return response;
}

function finishAttempt(request: NextRequest, location: string): NextResponse {
  const response = NextResponse.redirect(new URL(location, request.url), 302);
  const expired = cookieAttributes(request.nextUrl, 0);
  for (const name of oauthCookieNames) {
    response.cookies.set(name, '', expired);
  }
  return response;
}

function signInFailed(request: NextRequest, error: SignInError): NextResponse {
  return finishAttempt(request, `/sign-in?error=${error}`);
}

async function exchangeForIdentity(
  client: GoogleClient,
  code: string,
  codeVerifier: string,
): Promise<object | null> {
  try {
    const tokens = await client.validateAuthorizationCode(code, codeVerifier);
    return decodeIdToken(tokens.idToken());
  } catch {
    return null;
  }
}

export async function completeSignIn(
  request: NextRequest,
  client: GoogleClient,
  config: Config,
  now: Date,
): Promise<NextResponse> {
  const query = request.nextUrl.searchParams;
  const providerError = query.get('error');
  if (providerError === 'access_denied') {
    return signInFailed(request, 'cancelled');
  }
  if (providerError) {
    return signInFailed(request, 'unavailable');
  }

  const state = query.get('state');
  const code = query.get('code');
  const expectedState = request.cookies.get(oauthStateCookieName)?.value;
  const codeVerifier = request.cookies.get(oauthVerifierCookieName)?.value;
  if (!state || !code || !expectedState || state !== expectedState || !codeVerifier) {
    return signInFailed(request, 'expired');
  }

  const claims = await exchangeForIdentity(client, code, codeVerifier);
  if (!claims) {
    return signInFailed(request, 'unavailable');
  }
  if (!isIdentityClaims(claims) || !isOwner(claims, config.ownerEmail)) {
    return signInFailed(request, 'not-allowed');
  }

  const sessionToken = await signSessionToken(
    { sub: claims.sub, email: claims.email },
    config.sessionSecret,
    now,
  );
  const returnTo = safeReturnTo(request.cookies.get(oauthReturnToCookieName)?.value);
  const response = finishAttempt(request, returnTo);
  response.cookies.set(
    sessionCookieName,
    sessionToken,
    cookieAttributes(request.nextUrl, sessionLifetimeSeconds),
  );
  return response;
}
