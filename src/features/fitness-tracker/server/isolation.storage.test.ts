import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { activateProgram, skipToBlock } from './activation';
import { getWeighInStatus, listBodyweight, recordBodyweight } from './bodyweight';
import {
  addExercise,
  archiveExercise,
  deleteExercise,
  getExerciseUsage,
  listExercises,
  renameExercise,
  unarchiveExercise,
} from './exercises';
import { getExerciseHistory } from './history';
import { ensureProfile } from './profile';
import {
  addExerciseSlot,
  addTrainingBlock,
  addWorkout,
  deleteProgram,
  getProgram,
  labelTrainingBlock,
  listPrograms,
  moveExerciseSlot,
  moveTrainingBlock,
  moveWorkout,
  removeExerciseSlot,
  removeTrainingBlock,
  removeWorkout,
  renameProgram,
  renameWorkout,
  replaceSlotExercise,
  setPrescription,
  setSlotOptional,
} from './programs';
import { plannedSets, setLogs, workoutSessions } from './schema';
import { openTestDatabase, type TestDatabase } from './storage-test-database';
import { createProgramFromSpec, expectOk } from './storage-test-support';
import { finishWorkout, getSession, logSet, startWorkout } from './training';

const notFound = { ok: false, error: 'not-found' };

describe('profile isolation', () => {
  let testDatabase: TestDatabase;
  const now = new Date('2026-10-02T10:00:00Z');

  beforeAll(async () => {
    testDatabase = await openTestDatabase();
  });

  afterAll(async () => {
    await testDatabase.dispose();
  });

  it('SC-007, FR-001: another profile cannot read or change anything through the identifiers of this one', async () => {
    const { db } = testDatabase;
    const ownerId = (await ensureProfile(db, crypto.randomUUID(), now)).id;
    const intruderId = (await ensureProfile(db, crypto.randomUUID(), now)).id;

    const program = await createProgramFromSpec(
      db,
      ownerId,
      {
        blockCount: 2,
        workouts: [
          { name: 'Upper A', slots: [{ exercise: 'Row', targetReps: [10, 10] }] },
          { name: 'Lower A', slots: [] },
        ],
      },
      now,
    );
    expectOk(await activateProgram(db, ownerId, program.id, now));
    const workout = program.workouts[0];
    const slot = workout?.slots[0];
    const exerciseId = slot?.exercise.id ?? '';
    const blockId = program.blocks[0]?.id ?? '';
    const session = expectOk(await startWorkout(db, ownerId, workout?.id ?? '', now));
    const plannedSetId = session.slots[0]?.plannedSets[0]?.id ?? '';
    expectOk(await logSet(db, ownerId, session.id, plannedSetId, { reps: 10, weightKg: 40 }, now));
    expectOk(await recordBodyweight(db, ownerId, { weightKg: 80 }, now, 'UTC'));

    const intruderExerciseId = expectOk(
      await addExercise(db, intruderId, { name: 'Intruder lift' }, now),
    ).id;
    const intruderProgram = await createProgramFromSpec(
      db,
      intruderId,
      { blockCount: 1, workouts: [{ name: 'Own', slots: [] }] },
      now,
    );
    expectOk(await activateProgram(db, intruderId, intruderProgram.id, now));
    const intruderWorkoutId = intruderProgram.workouts[0]?.id ?? '';

    const snapshot = async () => ({
      program: await getProgram(db, ownerId, program.id),
      exercises: await listExercises(db, ownerId, { includeArchived: true }),
      history: await getExerciseHistory(db, ownerId, exerciseId),
      sessions: await db
        .select()
        .from(workoutSessions)
        .where(eq(workoutSessions.profileId, ownerId)),
      logs: await db.select().from(setLogs).where(eq(setLogs.profileId, ownerId)),
      plannedSets: await db
        .select()
        .from(plannedSets)
        .where(eq(plannedSets.exerciseSlotId, slot?.id ?? '')),
      bodyweight: await listBodyweight(db, ownerId),
      session: await getSession(db, ownerId, session.id),
    });
    const before = await snapshot();

    const refusals = await Promise.all([
      renameExercise(db, intruderId, exerciseId, { name: 'Stolen' }),
      archiveExercise(db, intruderId, exerciseId, now),
      unarchiveExercise(db, intruderId, exerciseId),
      deleteExercise(db, intruderId, exerciseId),
      getExerciseHistory(db, intruderId, exerciseId),
      getExerciseUsage(db, intruderId, exerciseId),
      getProgram(db, intruderId, program.id),
      renameProgram(db, intruderId, program.id, { name: 'Stolen' }),
      addTrainingBlock(db, intruderId, program.id, {}),
      labelTrainingBlock(db, intruderId, blockId, { label: 'Stolen' }),
      moveTrainingBlock(db, intruderId, blockId, { toPosition: 2 }),
      removeTrainingBlock(db, intruderId, blockId, now),
      addWorkout(db, intruderId, program.id, { name: 'Stolen' }),
      renameWorkout(db, intruderId, workout?.id ?? '', { name: 'Stolen' }),
      moveWorkout(db, intruderId, workout?.id ?? '', { toPosition: 2 }),
      removeWorkout(db, intruderId, workout?.id ?? '', now),
      addExerciseSlot(db, intruderId, workout?.id ?? '', {
        exerciseId: intruderExerciseId,
        targetReps: [5],
      }),
      addExerciseSlot(db, intruderId, intruderWorkoutId, { exerciseId, targetReps: [5] }),
      replaceSlotExercise(db, intruderId, slot?.id ?? '', { exerciseId: intruderExerciseId }),
      setSlotOptional(db, intruderId, slot?.id ?? '', { isOptional: true }),
      moveExerciseSlot(db, intruderId, slot?.id ?? '', { toPosition: 1 }),
      removeExerciseSlot(db, intruderId, slot?.id ?? ''),
      setPrescription(db, intruderId, slot?.id ?? '', blockId, { targetReps: [1] }),
      deleteProgram(db, intruderId, program.id, now),
      activateProgram(db, intruderId, program.id, now),
      getSession(db, intruderId, session.id),
      logSet(db, intruderId, session.id, plannedSetId, { reps: 1, weightKg: 1 }, now),
      finishWorkout(db, intruderId, session.id, now),
    ]);

    for (const refusal of refusals) {
      expect(refusal).toEqual(notFound);
    }
    expect(
      await skipToBlock(db, intruderId, { blockId: program.blocks[1]?.id ?? '' }, now),
    ).toEqual({ ok: false, error: 'invalid-block' });
    expect(await startWorkout(db, intruderId, workout?.id ?? '', now)).toEqual({
      ok: false,
      error: 'workout-not-in-active-program',
    });
    expect(await listExercises(db, intruderId, { includeArchived: true })).toHaveLength(1);
    expect(await listPrograms(db, intruderId)).toHaveLength(1);
    expect(await listBodyweight(db, intruderId)).toEqual([]);
    expect(expectOk(await getWeighInStatus(db, intruderId, now, 'UTC')).isAvailable).toBe(true);
    expect(await snapshot()).toEqual(before);
  });
});
