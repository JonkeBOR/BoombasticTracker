import { NextResponse } from 'next/server';
import { cookieAttributes, sessionCookieName } from '@/lib/server/session-cookie';

export function POST(request: Request): Response {
  const requestUrl = new URL(request.url);
  const response = NextResponse.redirect(new URL('/sign-in', requestUrl), 303);
  response.cookies.set(sessionCookieName, '', cookieAttributes(requestUrl, 0));
  return response;
}
