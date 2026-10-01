import { SignJWT, jwtVerify } from 'jose';

export const sessionLifetimeSeconds = 7776000;

const algorithm = 'HS256';

export type SessionClaims = {
  sub: string;
  email: string;
};

function signingKey(secret: string): Uint8Array {
  return Uint8Array.from(atob(secret), (character) => character.charCodeAt(0));
}

function toEpochSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

export async function signSessionToken(
  claims: SessionClaims,
  secret: string,
  now: Date,
): Promise<string> {
  const issuedAt = toEpochSeconds(now);
  return new SignJWT({ email: claims.email })
    .setProtectedHeader({ alg: algorithm })
    .setSubject(claims.sub)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + sessionLifetimeSeconds)
    .sign(signingKey(secret));
}

export async function verifySessionToken(
  token: string | undefined,
  secret: string,
  now: Date,
): Promise<SessionClaims | null> {
  if (!token) {
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, signingKey(secret), {
      algorithms: [algorithm],
      currentDate: now,
      requiredClaims: ['sub', 'iat', 'exp'],
    });
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
      return null;
    }
    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}
