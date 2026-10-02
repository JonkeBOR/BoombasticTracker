import 'server-only';
import { eq } from 'drizzle-orm';
import type { Database } from '@/lib/server/database';
import type { Profile } from '../domain/types';
import { profiles } from './schema';

export async function ensureProfile(
  db: Database,
  accountSubject: string,
  now: Date,
): Promise<Profile> {
  await db
    .insert(profiles)
    .values({ id: crypto.randomUUID(), accountSubject, createdAt: now })
    .onConflictDoNothing({ target: profiles.accountSubject });
  const [row] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.accountSubject, accountSubject))
    .limit(1);
  if (!row) {
    throw new Error('The profile was not found after it was ensured');
  }
  return { id: row.id };
}
