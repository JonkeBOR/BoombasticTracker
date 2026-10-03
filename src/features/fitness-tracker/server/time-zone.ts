import 'server-only';
import { cookies } from 'next/headers';
import { resolveTimeZone } from '../domain/values';

export async function readTimeZone(): Promise<string> {
  const cookieStore = await cookies();
  return resolveTimeZone(cookieStore.get('tz')?.value);
}
