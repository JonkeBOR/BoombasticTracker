import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import type { Database } from '@/lib/server/database';
import type { Statement } from './batch';
import { cycles, workoutSessions } from './schema';

export function closeInProgressStatements(db: Database, programId: string, now: Date): Statement[] {
  return [
    db
      .update(workoutSessions)
      .set({ status: 'finished', finishedAt: now })
      .where(
        and(eq(workoutSessions.programId, programId), eq(workoutSessions.status, 'in_progress')),
      ),
  ];
}

export function startPassStatements(
  db: Database,
  cycle: { id: string; programId: string },
  firstBlockId: string,
  now: Date,
): Statement[] {
  return [
    ...closeInProgressStatements(db, cycle.programId, now),
    db
      .update(cycles)
      .set({ pass: sql`${cycles.pass} + 1`, currentBlockId: firstBlockId })
      .where(eq(cycles.id, cycle.id)),
  ];
}

export function insertCycleStatement(
  db: Database,
  programId: string,
  firstBlockId: string,
): Statement {
  return db.insert(cycles).values({
    id: crypto.randomUUID(),
    programId,
    currentBlockId: firstBlockId,
    pass: 1,
  });
}
