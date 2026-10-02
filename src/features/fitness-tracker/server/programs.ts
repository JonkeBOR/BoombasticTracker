import 'server-only';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '@/lib/server/database';
import { canUseInSlot } from '../domain/exercise';
import {
  draftsForNewBlock,
  draftsForNewSlot,
  type PlannedSetDraft,
  planPrescriptionChange,
  reorder,
  validateBlockCount,
} from '../domain/program';
import { reevaluateAfterEdit } from '../domain/progression';
import { fail, type Result, succeed } from '../domain/result';
import type { Program, ProgramSummary } from '../domain/types';
import { parseName } from '../domain/values';
import { chunkIds, chunkRows, runBatch, type Statement } from './batch';
import { endCycleStatements, startCycleStatement } from './cycle-statements';
import { type ProgramRows, toProgram } from './mapping';
import {
  cycles,
  exerciseSlots,
  exercises,
  plannedSets,
  profiles,
  programs,
  trainingBlocks,
  workoutSessions,
  workouts,
} from './schema';

type NameError = 'name-required' | 'name-too-long';
type MoveError = 'not-found' | 'invalid-position';
type TargetsError = 'prescription-needs-a-set' | 'invalid-target';

const plannedSetColumns = 6;
const trainingBlockColumns = 4;

export async function loadProgramRows(
  db: Database,
  profileId: string,
  programId: string,
): Promise<ProgramRows | null> {
  const found = await db.query.programs.findFirst({
    where: and(eq(programs.id, programId), eq(programs.profileId, profileId)),
    with: {
      blocks: true,
      workouts: { with: { slots: { with: { exercise: true, plannedSets: true } } } },
      cycles: true,
    },
  });
  if (!found) {
    return null;
  }
  const [profile] = await db
    .select({ activeProgramId: profiles.activeProgramId })
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);
  const { blocks, workouts: workoutRows, cycles: cycleRows, ...program } = found;
  return {
    program,
    isActive: profile?.activeProgramId === programId,
    blocks,
    workouts: workoutRows,
    cycles: cycleRows,
  };
}

export async function getProgram(
  db: Database,
  profileId: string,
  programId: string,
): Promise<Result<Program, 'not-found'>> {
  const rows = await loadProgramRows(db, profileId, programId);
  return rows ? succeed(toProgram(rows)) : fail('not-found');
}

async function programIdOfBlock(
  db: Database,
  profileId: string,
  blockId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ programId: trainingBlocks.programId })
    .from(trainingBlocks)
    .innerJoin(programs, eq(programs.id, trainingBlocks.programId))
    .where(and(eq(trainingBlocks.id, blockId), eq(programs.profileId, profileId)))
    .limit(1);
  return row?.programId ?? null;
}

async function programIdOfWorkout(
  db: Database,
  profileId: string,
  workoutId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ programId: workouts.programId })
    .from(workouts)
    .innerJoin(programs, eq(programs.id, workouts.programId))
    .where(and(eq(workouts.id, workoutId), eq(programs.profileId, profileId)))
    .limit(1);
  return row?.programId ?? null;
}

async function programIdOfSlot(
  db: Database,
  profileId: string,
  slotId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ programId: workouts.programId })
    .from(exerciseSlots)
    .innerJoin(workouts, eq(workouts.id, exerciseSlots.workoutId))
    .innerJoin(programs, eq(programs.id, workouts.programId))
    .where(and(eq(exerciseSlots.id, slotId), eq(programs.profileId, profileId)))
    .limit(1);
  return row?.programId ?? null;
}

function insertPlannedSets(db: Database, drafts: readonly PlannedSetDraft[]): Statement[] {
  const rows = drafts.map((draft) => ({
    id: crypto.randomUUID(),
    exerciseSlotId: draft.exerciseSlotId,
    trainingBlockId: draft.trainingBlockId,
    setNumber: draft.setNumber,
    targetReps: draft.targetReps,
    lastWeightGrams: null,
  }));
  return chunkRows(rows, plannedSetColumns).map((part) => db.insert(plannedSets).values(part));
}

function reorderBlocks(
  db: Database,
  programId: string,
  orderedIds: readonly string[],
): Statement[] {
  return [
    db
      .update(trainingBlocks)
      .set({ position: sql`-${trainingBlocks.position}` })
      .where(eq(trainingBlocks.programId, programId)),
    ...orderedIds.map((id, index) =>
      db
        .update(trainingBlocks)
        .set({ position: index + 1 })
        .where(eq(trainingBlocks.id, id)),
    ),
  ];
}

function reorderWorkouts(
  db: Database,
  programId: string,
  orderedIds: readonly string[],
): Statement[] {
  return [
    db
      .update(workouts)
      .set({ position: sql`-${workouts.position}` })
      .where(eq(workouts.programId, programId)),
    ...orderedIds.map((id, index) =>
      db
        .update(workouts)
        .set({ position: index + 1 })
        .where(eq(workouts.id, id)),
    ),
  ];
}

function reorderSlots(db: Database, workoutId: string, orderedIds: readonly string[]): Statement[] {
  return [
    db
      .update(exerciseSlots)
      .set({ position: sql`-${exerciseSlots.position}` })
      .where(eq(exerciseSlots.workoutId, workoutId)),
    ...orderedIds.map((id, index) =>
      db
        .update(exerciseSlots)
        .set({ position: index + 1 })
        .where(eq(exerciseSlots.id, id)),
    ),
  ];
}

export async function listPrograms(db: Database, profileId: string): Promise<ProgramSummary[]> {
  const rows = await db
    .select({ id: programs.id, name: programs.name })
    .from(programs)
    .where(eq(programs.profileId, profileId))
    .orderBy(asc(programs.createdAt), asc(programs.id));
  const [profile] = await db
    .select({ activeProgramId: profiles.activeProgramId })
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);
  return rows.map((row) => ({ ...row, isActive: profile?.activeProgramId === row.id }));
}

export async function createProgram(
  db: Database,
  profileId: string,
  input: { name: string; blockCount: number },
  now: Date,
): Promise<Result<Program, NameError | 'invalid-block-count'>> {
  const name = parseName(input.name);
  if (!name.ok) {
    return fail(name.error);
  }
  const blockCount = validateBlockCount(input.blockCount);
  if (!blockCount.ok) {
    return fail(blockCount.error);
  }
  const programId = crypto.randomUUID();
  const blockRows = Array.from({ length: blockCount.value }, (_, index) => ({
    id: crypto.randomUUID(),
    programId,
    position: index + 1,
    label: null,
  }));
  await runBatch(db, [
    db.insert(programs).values({ id: programId, profileId, name: name.value, createdAt: now }),
    ...chunkRows(blockRows, trainingBlockColumns).map((part) =>
      db.insert(trainingBlocks).values(part),
    ),
  ]);
  return getProgram(db, profileId, programId).then((found) => {
    if (!found.ok) {
      throw new Error('The program was not found after it was created');
    }
    return succeed(found.value);
  });
}

export async function renameProgram(
  db: Database,
  profileId: string,
  programId: string,
  input: { name: string },
): Promise<Result<Program, NameError | 'not-found'>> {
  const name = parseName(input.name);
  if (!name.ok) {
    return fail(name.error);
  }
  const [row] = await db
    .update(programs)
    .set({ name: name.value })
    .where(and(eq(programs.id, programId), eq(programs.profileId, profileId)))
    .returning({ id: programs.id });
  return row ? getProgram(db, profileId, programId) : fail('not-found');
}

export async function addTrainingBlock(
  db: Database,
  profileId: string,
  programId: string,
  input: { label?: string | null },
): Promise<Result<Program, 'not-found'>> {
  const rows = await loadProgramRows(db, profileId, programId);
  if (!rows) {
    return fail('not-found');
  }
  const lastBlock = [...rows.blocks].sort((left, right) => right.position - left.position)[0];
  if (!lastBlock) {
    return fail('not-found');
  }
  const newBlockId = crypto.randomUUID();
  const slotTargets = rows.workouts.flatMap((workout) =>
    workout.slots.map((slot) => ({
      slotId: slot.id,
      targetReps: slot.plannedSets
        .filter((plannedSet) => plannedSet.trainingBlockId === lastBlock.id)
        .sort((left, right) => left.setNumber - right.setNumber)
        .map((plannedSet) => plannedSet.targetReps),
    })),
  );
  await runBatch(db, [
    db.insert(trainingBlocks).values({
      id: newBlockId,
      programId,
      position: lastBlock.position + 1,
      label: normalizeLabel(input.label),
    }),
    ...insertPlannedSets(db, draftsForNewBlock(slotTargets, newBlockId)),
  ]);
  return getProgram(db, profileId, programId);
}

function normalizeLabel(label: string | null | undefined): string | null {
  const trimmed = label?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

export async function labelTrainingBlock(
  db: Database,
  profileId: string,
  blockId: string,
  input: { label: string | null },
): Promise<Result<Program, 'not-found'>> {
  const programId = await programIdOfBlock(db, profileId, blockId);
  if (programId === null) {
    return fail('not-found');
  }
  await db
    .update(trainingBlocks)
    .set({ label: normalizeLabel(input.label) })
    .where(eq(trainingBlocks.id, blockId));
  return getProgram(db, profileId, programId);
}

export async function moveTrainingBlock(
  db: Database,
  profileId: string,
  blockId: string,
  input: { toPosition: number },
): Promise<Result<Program, MoveError>> {
  const programId = await programIdOfBlock(db, profileId, blockId);
  if (programId === null) {
    return fail('not-found');
  }
  const siblings = await db
    .select({ id: trainingBlocks.id })
    .from(trainingBlocks)
    .where(eq(trainingBlocks.programId, programId))
    .orderBy(asc(trainingBlocks.position));
  const order = reorder(
    siblings.map((sibling) => sibling.id),
    blockId,
    input.toPosition,
  );
  if (!order.ok) {
    return fail(order.error);
  }
  await runBatch(db, reorderBlocks(db, programId, order.value));
  return getProgram(db, profileId, programId);
}

export async function addWorkout(
  db: Database,
  profileId: string,
  programId: string,
  input: { name: string },
): Promise<Result<Program, NameError | 'not-found'>> {
  const name = parseName(input.name);
  if (!name.ok) {
    return fail(name.error);
  }
  const rows = await loadProgramRows(db, profileId, programId);
  if (!rows) {
    return fail('not-found');
  }
  await db.insert(workouts).values({
    id: crypto.randomUUID(),
    programId,
    position: rows.workouts.length + 1,
    name: name.value,
  });
  return getProgram(db, profileId, programId);
}

export async function renameWorkout(
  db: Database,
  profileId: string,
  workoutId: string,
  input: { name: string },
): Promise<Result<Program, NameError | 'not-found'>> {
  const name = parseName(input.name);
  if (!name.ok) {
    return fail(name.error);
  }
  const programId = await programIdOfWorkout(db, profileId, workoutId);
  if (programId === null) {
    return fail('not-found');
  }
  await db.update(workouts).set({ name: name.value }).where(eq(workouts.id, workoutId));
  return getProgram(db, profileId, programId);
}

export async function moveWorkout(
  db: Database,
  profileId: string,
  workoutId: string,
  input: { toPosition: number },
): Promise<Result<Program, MoveError>> {
  const programId = await programIdOfWorkout(db, profileId, workoutId);
  if (programId === null) {
    return fail('not-found');
  }
  const siblings = await db
    .select({ id: workouts.id })
    .from(workouts)
    .where(eq(workouts.programId, programId))
    .orderBy(asc(workouts.position));
  const order = reorder(
    siblings.map((sibling) => sibling.id),
    workoutId,
    input.toPosition,
  );
  if (!order.ok) {
    return fail(order.error);
  }
  await runBatch(db, reorderWorkouts(db, programId, order.value));
  return getProgram(db, profileId, programId);
}

export async function addExerciseSlot(
  db: Database,
  profileId: string,
  workoutId: string,
  input: { exerciseId: string; targetReps: number[] },
): Promise<Result<Program, 'not-found' | 'exercise-archived' | TargetsError>> {
  const programId = await programIdOfWorkout(db, profileId, workoutId);
  if (programId === null) {
    return fail('not-found');
  }
  const [exercise] = await db
    .select({ archivedAt: exercises.archivedAt })
    .from(exercises)
    .where(and(eq(exercises.id, input.exerciseId), eq(exercises.profileId, profileId)))
    .limit(1);
  if (!exercise) {
    return fail('not-found');
  }
  const usable = canUseInSlot({ isArchived: exercise.archivedAt !== null });
  if (!usable.ok) {
    return fail(usable.error);
  }
  const [blocks, existingSlots] = await Promise.all([
    db
      .select({ id: trainingBlocks.id })
      .from(trainingBlocks)
      .where(eq(trainingBlocks.programId, programId))
      .orderBy(asc(trainingBlocks.position)),
    db
      .select({ id: exerciseSlots.id })
      .from(exerciseSlots)
      .where(eq(exerciseSlots.workoutId, workoutId)),
  ]);
  const slotId = crypto.randomUUID();
  const drafts = draftsForNewSlot(
    slotId,
    input.targetReps,
    blocks.map((block) => block.id),
  );
  if (!drafts.ok) {
    return fail(drafts.error);
  }
  await runBatch(db, [
    db.insert(exerciseSlots).values({
      id: slotId,
      workoutId,
      position: existingSlots.length + 1,
      exerciseId: input.exerciseId,
      isOptional: false,
    }),
    ...insertPlannedSets(db, drafts.value),
  ]);
  return getProgram(db, profileId, programId);
}

export async function setSlotOptional(
  db: Database,
  profileId: string,
  slotId: string,
  input: { isOptional: boolean },
): Promise<Result<Program, 'not-found'>> {
  const programId = await programIdOfSlot(db, profileId, slotId);
  if (programId === null) {
    return fail('not-found');
  }
  await db
    .update(exerciseSlots)
    .set({ isOptional: input.isOptional })
    .where(eq(exerciseSlots.id, slotId));
  return getProgram(db, profileId, programId);
}

async function workoutIdOfSlot(db: Database, slotId: string): Promise<string | null> {
  const [row] = await db
    .select({ workoutId: exerciseSlots.workoutId })
    .from(exerciseSlots)
    .where(eq(exerciseSlots.id, slotId))
    .limit(1);
  return row?.workoutId ?? null;
}

async function orderedSlotIds(db: Database, workoutId: string): Promise<string[]> {
  const rows = await db
    .select({ id: exerciseSlots.id })
    .from(exerciseSlots)
    .where(eq(exerciseSlots.workoutId, workoutId))
    .orderBy(asc(exerciseSlots.position));
  return rows.map((row) => row.id);
}

export async function moveExerciseSlot(
  db: Database,
  profileId: string,
  slotId: string,
  input: { toPosition: number },
): Promise<Result<Program, MoveError>> {
  const programId = await programIdOfSlot(db, profileId, slotId);
  const workoutId = programId === null ? null : await workoutIdOfSlot(db, slotId);
  if (programId === null || workoutId === null) {
    return fail('not-found');
  }
  const order = reorder(await orderedSlotIds(db, workoutId), slotId, input.toPosition);
  if (!order.ok) {
    return fail(order.error);
  }
  await runBatch(db, reorderSlots(db, workoutId, order.value));
  return getProgram(db, profileId, programId);
}

export async function removeExerciseSlot(
  db: Database,
  profileId: string,
  slotId: string,
): Promise<Result<Program, 'not-found'>> {
  const programId = await programIdOfSlot(db, profileId, slotId);
  const workoutId = programId === null ? null : await workoutIdOfSlot(db, slotId);
  if (programId === null || workoutId === null) {
    return fail('not-found');
  }
  const remaining = (await orderedSlotIds(db, workoutId)).filter((id) => id !== slotId);
  await runBatch(db, [
    db.delete(exerciseSlots).where(eq(exerciseSlots.id, slotId)),
    ...reorderSlots(db, workoutId, remaining),
  ]);
  return getProgram(db, profileId, programId);
}

export async function setPrescription(
  db: Database,
  profileId: string,
  slotId: string,
  blockId: string,
  input: { targetReps: number[] },
): Promise<Result<Program, 'not-found' | TargetsError>> {
  const [slotProgramId, blockProgramId] = await Promise.all([
    programIdOfSlot(db, profileId, slotId),
    programIdOfBlock(db, profileId, blockId),
  ]);
  if (slotProgramId === null || slotProgramId !== blockProgramId) {
    return fail('not-found');
  }
  const existing = await db
    .select({ id: plannedSets.id, setNumber: plannedSets.setNumber })
    .from(plannedSets)
    .where(and(eq(plannedSets.exerciseSlotId, slotId), eq(plannedSets.trainingBlockId, blockId)));
  const change = planPrescriptionChange(existing, input.targetReps);
  if (!change.ok) {
    return fail(change.error);
  }
  await runBatch(db, [
    ...change.value.update.map((item) =>
      db
        .update(plannedSets)
        .set({ targetReps: item.targetReps })
        .where(eq(plannedSets.id, item.id)),
    ),
    ...insertPlannedSets(
      db,
      change.value.insert.map((item) => ({
        exerciseSlotId: slotId,
        trainingBlockId: blockId,
        setNumber: item.setNumber,
        targetReps: item.targetReps,
      })),
    ),
    ...chunkIds(change.value.deleteIds).map((ids) =>
      db.delete(plannedSets).where(inArray(plannedSets.id, ids)),
    ),
  ]);
  return getProgram(db, profileId, slotProgramId);
}

export async function replaceSlotExercise(
  db: Database,
  profileId: string,
  slotId: string,
  input: { exerciseId: string },
): Promise<Result<Program, 'not-found' | 'exercise-archived'>> {
  const programId = await programIdOfSlot(db, profileId, slotId);
  if (programId === null) {
    return fail('not-found');
  }
  const [exercise] = await db
    .select({ archivedAt: exercises.archivedAt })
    .from(exercises)
    .where(and(eq(exercises.id, input.exerciseId), eq(exercises.profileId, profileId)))
    .limit(1);
  if (!exercise) {
    return fail('not-found');
  }
  const usable = canUseInSlot({ isArchived: exercise.archivedAt !== null });
  if (!usable.ok) {
    return fail(usable.error);
  }
  await runBatch(db, [
    db
      .update(exerciseSlots)
      .set({ exerciseId: input.exerciseId })
      .where(eq(exerciseSlots.id, slotId)),
    db
      .update(plannedSets)
      .set({ lastWeightGrams: null })
      .where(eq(plannedSets.exerciseSlotId, slotId)),
  ]);
  return getProgram(db, profileId, programId);
}

async function progressionAfterEdit(
  db: Database,
  programId: string,
  remaining: { workoutIds: string[]; blockCount: number },
  now: Date,
): Promise<Statement[]> {
  const [cycle] = await db
    .select()
    .from(cycles)
    .where(and(eq(cycles.programId, programId), eq(cycles.status, 'active')))
    .limit(1);
  if (!cycle) {
    return [];
  }
  const block = Math.min(cycle.currentBlockNumber, remaining.blockCount);
  const finished = await db
    .select({ workoutId: workoutSessions.workoutId })
    .from(workoutSessions)
    .where(
      and(
        eq(workoutSessions.cycleId, cycle.id),
        eq(workoutSessions.blockNumber, block),
        eq(workoutSessions.status, 'finished'),
      ),
    );
  const decision = reevaluateAfterEdit({
    cycle,
    blockCount: remaining.blockCount,
    workoutIds: remaining.workoutIds,
    finishedWorkoutIdsInBlock: finished.map((row) => row.workoutId),
  });
  if (decision.kind === 'move') {
    return [
      db
        .update(cycles)
        .set({ currentBlockNumber: decision.toBlockNumber })
        .where(eq(cycles.id, cycle.id)),
    ];
  }
  if (decision.kind === 'complete') {
    return [
      ...endCycleStatements(
        db,
        { id: cycle.id, status: 'completed', currentBlockNumber: remaining.blockCount },
        now,
      ),
      startCycleStatement(db, { programId, number: decision.newCycleNumber }, now),
    ];
  }
  return [];
}

export async function removeTrainingBlock(
  db: Database,
  profileId: string,
  blockId: string,
  now: Date,
): Promise<Result<Program, 'not-found' | 'program-needs-a-block'>> {
  const programId = await programIdOfBlock(db, profileId, blockId);
  if (programId === null) {
    return fail('not-found');
  }
  const [siblings, workoutRows] = await Promise.all([
    db
      .select({ id: trainingBlocks.id })
      .from(trainingBlocks)
      .where(eq(trainingBlocks.programId, programId))
      .orderBy(asc(trainingBlocks.position)),
    db.select({ id: workouts.id }).from(workouts).where(eq(workouts.programId, programId)),
  ]);
  if (siblings.length <= 1) {
    return fail('program-needs-a-block');
  }
  const remaining = siblings.map((sibling) => sibling.id).filter((id) => id !== blockId);
  await runBatch(db, [
    db.delete(trainingBlocks).where(eq(trainingBlocks.id, blockId)),
    ...reorderBlocks(db, programId, remaining),
    ...(await progressionAfterEdit(
      db,
      programId,
      { workoutIds: workoutRows.map((row) => row.id), blockCount: remaining.length },
      now,
    )),
  ]);
  return getProgram(db, profileId, programId);
}

export async function removeWorkout(
  db: Database,
  profileId: string,
  workoutId: string,
  now: Date,
): Promise<Result<Program, 'not-found'>> {
  const programId = await programIdOfWorkout(db, profileId, workoutId);
  if (programId === null) {
    return fail('not-found');
  }
  const [siblings, blockRows] = await Promise.all([
    db
      .select({ id: workouts.id })
      .from(workouts)
      .where(eq(workouts.programId, programId))
      .orderBy(asc(workouts.position)),
    db
      .select({ id: trainingBlocks.id })
      .from(trainingBlocks)
      .where(eq(trainingBlocks.programId, programId)),
  ]);
  const remaining = siblings.map((sibling) => sibling.id).filter((id) => id !== workoutId);
  await runBatch(db, [
    db.delete(workouts).where(eq(workouts.id, workoutId)),
    ...reorderWorkouts(db, programId, remaining),
    ...(await progressionAfterEdit(
      db,
      programId,
      { workoutIds: remaining, blockCount: blockRows.length },
      now,
    )),
  ]);
  return getProgram(db, profileId, programId);
}

export async function deleteProgram(
  db: Database,
  profileId: string,
  programId: string,
  now: Date,
): Promise<Result<void, 'not-found'>> {
  const [program] = await db
    .select({ id: programs.id })
    .from(programs)
    .where(and(eq(programs.id, programId), eq(programs.profileId, profileId)))
    .limit(1);
  if (!program) {
    return fail('not-found');
  }
  await runBatch(db, [
    db
      .update(profiles)
      .set({ activeProgramId: null })
      .where(and(eq(profiles.id, profileId), eq(profiles.activeProgramId, programId))),
    db
      .update(workoutSessions)
      .set({ status: 'finished', finishedAt: now })
      .where(
        and(eq(workoutSessions.programId, programId), eq(workoutSessions.status, 'in_progress')),
      ),
    db.delete(programs).where(eq(programs.id, programId)),
  ]);
  return succeed(undefined);
}
