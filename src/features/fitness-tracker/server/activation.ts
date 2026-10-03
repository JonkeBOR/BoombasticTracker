import 'server-only';
import { asc, eq } from 'drizzle-orm';
import type { Database } from '@/lib/server/database';
import { isActivatable } from '../domain/program';
import { decideSkip } from '../domain/progression';
import { fail, type Result, succeed } from '../domain/result';
import type { Cycle } from '../domain/types';
import { runBatch } from './batch';
import { closeInProgressStatements, startPassStatements } from './cycle-statements';
import { toCycle } from './mapping';
import { loadProgramRows } from './programs';
import { cycles, profiles, trainingBlocks } from './schema';

async function activeProgramIdOf(db: Database, profileId: string): Promise<string | null> {
  const [profile] = await db
    .select({ activeProgramId: profiles.activeProgramId })
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);
  return profile?.activeProgramId ?? null;
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
  const [cycle] = rows.cycles;
  if (!cycle) {
    throw new Error(`The program ${programId} has no cycle`);
  }
  if (rows.isActive) {
    return succeed(toCycle(cycle));
  }
  const previousProgramId = await activeProgramIdOf(db, profileId);
  await runBatch(db, [
    ...(previousProgramId === null ? [] : closeInProgressStatements(db, previousProgramId, now)),
    db.update(profiles).set({ activeProgramId: programId }).where(eq(profiles.id, profileId)),
  ]);
  return succeed(toCycle(cycle));
}

export async function pauseActiveProgram(
  db: Database,
  profileId: string,
  now: Date,
): Promise<Result<void, 'no-active-program'>> {
  const programId = await activeProgramIdOf(db, profileId);
  if (programId === null) {
    return fail('no-active-program');
  }
  await runBatch(db, [
    ...closeInProgressStatements(db, programId, now),
    db.update(profiles).set({ activeProgramId: null }).where(eq(profiles.id, profileId)),
  ]);
  return succeed(undefined);
}

export async function skipToBlock(
  db: Database,
  profileId: string,
  input: { blockId: string },
  now: Date,
): Promise<Result<{ newPass: boolean }, 'no-active-program' | 'invalid-block'>> {
  const programId = await activeProgramIdOf(db, profileId);
  if (programId === null) {
    return fail('no-active-program');
  }
  const [cycleRows, blockRows] = await Promise.all([
    db.select().from(cycles).where(eq(cycles.programId, programId)).limit(1),
    db
      .select({ id: trainingBlocks.id })
      .from(trainingBlocks)
      .where(eq(trainingBlocks.programId, programId))
      .orderBy(asc(trainingBlocks.position)),
  ]);
  const [cycle] = cycleRows;
  const blockIds = blockRows.map((block) => block.id);
  const firstBlockId = blockIds[0];
  if (!cycle || firstBlockId === undefined) {
    throw new Error(`The program ${programId} has no cycle or no block`);
  }
  const decision = decideSkip({
    blockIds,
    currentBlockId: cycle.currentBlockId,
    targetBlockId: input.blockId,
  });
  if (!decision.ok) {
    return fail(decision.error);
  }
  if (decision.value.kind === 'new-pass') {
    await runBatch(db, startPassStatements(db, { id: cycle.id, programId }, firstBlockId, now));
    return succeed({ newPass: true });
  }
  await runBatch(db, [
    ...closeInProgressStatements(db, programId, now),
    db
      .update(cycles)
      .set({ currentBlockId: decision.value.toBlockId })
      .where(eq(cycles.id, cycle.id)),
  ]);
  return succeed({ newPass: false });
}
