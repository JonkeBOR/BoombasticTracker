import 'server-only';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { Database } from '@/lib/server/database';
import { fail, type Result, succeed } from '../domain/result';
import type { Exercise, SetLog } from '../domain/types';
import { toExercise, toSetLog } from './mapping';
import { exercises, setLogs } from './schema';

export async function getExerciseHistory(
  db: Database,
  profileId: string,
  exerciseId: string,
): Promise<Result<{ exercise: Exercise; setLogs: SetLog[] }, 'not-found'>> {
  const [exercise] = await db
    .select()
    .from(exercises)
    .where(and(eq(exercises.id, exerciseId), eq(exercises.profileId, profileId)))
    .limit(1);
  if (!exercise) {
    return fail('not-found');
  }
  const rows = await db
    .select()
    .from(setLogs)
    .where(and(eq(setLogs.profileId, profileId), eq(setLogs.exerciseId, exerciseId)))
    .orderBy(asc(setLogs.performedAt), sql`rowid`);
  return succeed({ exercise: toExercise(exercise), setLogs: rows.map(toSetLog) });
}
