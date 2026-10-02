import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import type { Database } from '@/lib/server/database';
import { isActivatable } from '../domain/program';
import { decideActivation, decideStartOver } from '../domain/progression';
import { fail, type Result, succeed } from '../domain/result';
import type { Cycle } from '../domain/types';
import { runBatch, type Statement } from './batch';
import { endCycleStatements, startCycleStatement } from './cycle-statements';
import { type CycleRow, toCycle } from './mapping';
import { loadProgramRows } from './programs';
import { cycles, profiles, programs } from './schema';

async function activeCycleOf(db: Database, programId: string): Promise<Cycle | null> {
  const [row] = await db
    .select()
    .from(cycles)
    .where(and(eq(cycles.programId, programId), eq(cycles.status, 'active')))
    .limit(1);
  return row ? toCycle(row) : null;
}

export async function activateProgram(
  db: Database,
  profileId: string,
  programId: string,
  now: Date,
): Promise<Result<Cycle, 'not-found' | 'program-incomplete'>> {
  const rows = await loadProgramRows(db, profileId, programId);
  if (!rows) {
    return fail('not-found');
  }
  const activatable = isActivatable({
    blockIds: rows.blocks.map((block) => block.id),
    workouts: rows.workouts.map((workout) => ({
      slots: workout.slots.map((slot) => ({ plannedSets: slot.plannedSets })),
    })),
  });
  if (!activatable) {
    return fail('program-incomplete');
  }

  const [profile] = await db
    .select({ activeProgramId: profiles.activeProgramId })
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);
  const previousProgramId = profile?.activeProgramId ?? null;
  const previousCycle =
    previousProgramId !== null && previousProgramId !== programId
      ? await activeCycleOf(db, previousProgramId)
      : null;
  const targetActive = rows.cycles.find((cycle) => cycle.status === 'active');
  const decision = decideActivation({
    isAlreadyActive: rows.isActive,
    previousActiveCycleId: previousCycle?.id ?? null,
    targetActiveCycleId: targetActive?.id ?? null,
    targetLastCycleNumber: Math.max(0, ...rows.cycles.map((cycle) => cycle.number)),
  });

  const statements: Statement[] = [];
  if (decision.endCycleId !== null) {
    statements.push(
      ...endCycleStatements(db, { id: decision.endCycleId, status: 'ended_early' }, now),
    );
  }
  if (decision.setActiveProgram) {
    statements.push(
      db.update(profiles).set({ activeProgramId: programId }).where(eq(profiles.id, profileId)),
    );
  }
  if (decision.startCycleNumber !== null) {
    statements.push(startCycleStatement(db, { programId, number: decision.startCycleNumber }, now));
  }
  await runBatch(db, statements);

  const cycle = await activeCycleOf(db, programId);
  if (!cycle) {
    throw new Error('The program has no active cycle after it was activated');
  }
  return succeed(cycle);
}

async function loadActiveCycleRow(db: Database, profileId: string): Promise<CycleRow | null> {
  const [profile] = await db
    .select({ activeProgramId: profiles.activeProgramId })
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);
  if (!profile?.activeProgramId) {
    return null;
  }
  const [cycle] = await db
    .select()
    .from(cycles)
    .where(and(eq(cycles.programId, profile.activeProgramId), eq(cycles.status, 'active')))
    .limit(1);
  return cycle ?? null;
}

export async function pauseActiveProgram(
  db: Database,
  profileId: string,
  now: Date,
): Promise<Result<void, 'no-active-program'>> {
  const cycle = await loadActiveCycleRow(db, profileId);
  if (!cycle) {
    return fail('no-active-program');
  }
  await runBatch(db, [
    ...endCycleStatements(db, { id: cycle.id, status: 'ended_early' }, now),
    db.update(profiles).set({ activeProgramId: null }).where(eq(profiles.id, profileId)),
  ]);
  return succeed(undefined);
}

export async function startOver(
  db: Database,
  profileId: string,
  now: Date,
): Promise<Result<Cycle, 'no-active-program'>> {
  const cycle = await loadActiveCycleRow(db, profileId);
  if (!cycle) {
    return fail('no-active-program');
  }
  const decision = decideStartOver(cycle);
  await runBatch(db, [
    ...endCycleStatements(db, { id: cycle.id, status: 'ended_early' }, now),
    startCycleStatement(db, { programId: cycle.programId, number: decision.newCycleNumber }, now),
  ]);
  const fresh = await activeCycleOf(db, cycle.programId);
  if (!fresh) {
    throw new Error('The program has no active cycle after starting over');
  }
  return succeed(fresh);
}

export async function listCycles(
  db: Database,
  profileId: string,
  programId: string,
): Promise<Cycle[]> {
  const rows = await db
    .select({ cycle: cycles })
    .from(cycles)
    .innerJoin(programs, eq(programs.id, cycles.programId))
    .where(and(eq(cycles.programId, programId), eq(programs.profileId, profileId)))
    .orderBy(asc(cycles.number));
  return rows.map((row) => toCycle(row.cycle));
}
