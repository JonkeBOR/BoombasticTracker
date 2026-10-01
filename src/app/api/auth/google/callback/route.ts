import type { NextRequest } from 'next/server';
import { getConfig } from '@/lib/server/config';
import { callbackUrl, completeSignIn, createGoogleClient } from '@/lib/server/google-sign-in';

export async function GET(request: NextRequest): Promise<Response> {
  const config = getConfig();
  return completeSignIn(
    request,
    createGoogleClient(config, callbackUrl(request)),
    config,
    new Date(),
  );
}
