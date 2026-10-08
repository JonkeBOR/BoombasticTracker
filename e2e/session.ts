import nextEnv from '@next/env';
import type { BrowserContext } from '@playwright/test';
import { signSessionToken } from '@/lib/session-token';

const baseURL = 'http://localhost:3000';

function sessionSecret(): string {
  nextEnv.loadEnvConfig(process.cwd());
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET is missing from .env.local');
  }
  return secret;
}

export async function signIn(context: BrowserContext): Promise<void> {
  const token = await signSessionToken(
    { sub: `e2e-${crypto.randomUUID()}`, email: 'owner@example.com' },
    sessionSecret(),
    new Date(),
  );
  await context.addCookies([{ name: 'session', value: token, url: baseURL, httpOnly: true }]);
}
