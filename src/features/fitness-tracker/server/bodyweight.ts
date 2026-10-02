import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import type { Database } from '@/lib/server/database';
import { decideRecordBodyweight, weighInStatus } from '../domain/bodyweight';
import { fail, type Result, succeed } from '../domain/result';
import type { BodyweightEntry } from '../domain/types';
import { localDate } from '../domain/values';
import { isUniqueConstraintViolation } from './batch';
import { toBodyweightEntry } from './mapping';
import { bodyweightEntries } from './schema';

async function entryExists(db: Database, profileId: string, entryDate: string): Promise<boolean> {
  const [row] = await db
    .select({ id: bodyweightEntries.id })
    .from(bodyweightEntries)
    .where(
      and(eq(bodyweightEntries.profileId, profileId), eq(bodyweightEntries.entryDate, entryDate)),
    )
    .limit(1);
  return row !== undefined;
}

export async function getWeighInStatus(
  db: Database,
  profileId: string,
  now: Date,
  timeZone: string,
): Promise<Result<{ isAvailable: boolean; today: string }, 'invalid-time-zone'>> {
  const today = localDate(now, timeZone);
  if (!today.ok) {
    return fail(today.error);
  }
  return succeed(
    weighInStatus({
      todayEntryExists: await entryExists(db, profileId, today.value),
      today: today.value,
    }),
  );
}

export async function recordBodyweight(
  db: Database,
  profileId: string,
  input: { weightKg: number },
  now: Date,
  timeZone: string,
): Promise<
  Result<BodyweightEntry, 'invalid-time-zone' | 'invalid-weight' | 'already-weighed-in-today'>
> {
  const today = localDate(now, timeZone);
  if (!today.ok) {
    return fail(today.error);
  }
  const decision = decideRecordBodyweight({
    weightKg: input.weightKg,
    today: today.value,
    todayEntryExists: await entryExists(db, profileId, today.value),
  });
  if (!decision.ok) {
    return fail(decision.error);
  }
  const row = {
    id: crypto.randomUUID(),
    profileId,
    entryDate: decision.value.entryDate,
    weightGrams: decision.value.weightGrams,
    recordedAt: now,
  };
  try {
    await db.insert(bodyweightEntries).values(row);
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      return fail('already-weighed-in-today');
    }
    throw error;
  }
  return succeed(toBodyweightEntry(row));
}

export async function listBodyweight(db: Database, profileId: string): Promise<BodyweightEntry[]> {
  const rows = await db
    .select()
    .from(bodyweightEntries)
    .where(eq(bodyweightEntries.profileId, profileId))
    .orderBy(asc(bodyweightEntries.entryDate));
  return rows.map(toBodyweightEntry);
}
