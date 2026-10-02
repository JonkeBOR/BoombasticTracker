import 'server-only';
import { and, eq } from 'drizzle-orm';
import type { Database } from '@/lib/server/database';
import type { Statement } from './batch';
import { cycles, workoutSessions } from './schema';

export function endCycleStatements(
  db: Database,
  cycle: { id: string; status: 'completed' | 'ended_early'; currentBlockNumber?: number },
  now: Date,
): Statement[] {
  return [
    db
      .update(cycles)
      .set({
        status: cycle.status,
        endedAt: now,
        ...(cycle.currentBlockNumber === undefined
          ? {}
          : { currentBlockNumber: cycle.currentBlockNumber }),
      })
      .where(eq(cycles.id, cycle.id)),
    db
      .update(workoutSessions)
      .set({ status: 'finished', finishedAt: now })
      .where(and(eq(workoutSessions.cycleId, cycle.id), eq(workoutSessions.status, 'in_progress'))),
  ];
}

export function startCycleStatement(
  db: Database,
  cycle: { programId: string; number: number },
  now: Date,
): Statement {
  return db.insert(cycles).values({
    id: crypto.randomUUID(),
    programId: cycle.programId,
    number: cycle.number,
    status: 'active',
    currentBlockNumber: 1,
    startedAt: now,
    endedAt: null,
  });
}
