import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { type SessionClaims, verifySessionToken } from '@/lib/session-token';
import { getConfig } from './config';

export const sessionCookieName = 'session';
export const oauthStateCookieName = 'oauth_state';
export const oauthVerifierCookieName = 'oauth_code_verifier';
export const oauthReturnToCookieName = 'oauth_return_to';

export type CookieAttributes = {
  httpOnly: true;
  sameSite: 'lax';
  path: '/';
  maxAge: number;
  secure: boolean;
};

export function cookieAttributes(requestUrl: URL, maxAgeSeconds: number): CookieAttributes {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds,
    secure: requestUrl.protocol === 'https:',
  };
}

export const getSession = cache(async (): Promise<SessionClaims | null> => {
  const cookieStore = await cookies();
  return verifySessionToken(
    cookieStore.get(sessionCookieName)?.value,
    getConfig().sessionSecret,
    new Date(),
  );
});

export async function requireSession(returnPath: string): Promise<SessionClaims> {
  const session = await getSession();
  if (!session) {
    redirect(`/sign-in?returnTo=${encodeURIComponent(returnPath)}`);
  }
  return session;
}
