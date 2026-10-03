import 'server-only';
import type { Database } from '@/lib/server/database';
import { getDatabase } from '@/lib/server/database';
import { requireSession } from '@/lib/server/session-cookie';
import { ensureProfile } from './profile';

export type PageContext = { db: Database; profileId: string; now: Date };

export async function requireFitnessContext(path: string): Promise<PageContext> {
  const session = await requireSession(path);
  const db = getDatabase();
  const now = new Date();
  const profile = await ensureProfile(db, session.sub, now);
  return { db, profileId: profile.id, now };
}
