import type { NextRequest } from 'next/server';
import { getConfig } from '@/lib/server/config';
import { callbackUrl, createGoogleClient, startSignIn } from '@/lib/server/google-sign-in';

export function GET(request: NextRequest): Response {
  return startSignIn(request, createGoogleClient(getConfig(), callbackUrl(request)));
}
