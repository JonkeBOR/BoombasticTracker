import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Program, SessionView } from '../domain/types';
import { activateProgram } from './activation';
import { ensureProfile } from './profile';
import { getProgram } from './programs';
import { cycles, plannedSets, setLogs } from './schema';
import { openTestDatabase, type TestDatabase } from './storage-test-database';
import { createProgramFromSpec, expectOk, type ProgramSpec } from './storage-test-support';
import { finishWorkout, getSession, getTrainingOverview, logSet, startWorkout } from './training';

describe('training', () => {
  let testDatabase: TestDatabase;
  let profileId: string;
  const now = new Date('2026-10-02T10:00:00Z');

  beforeAll(async () => {
    testDatabase = await openTestDatabase();
  });

  afterAll(async () => {
    await testDatabase.dispose();
  });

  beforeEach(async () => {
    profileId = (await ensureProfile(testDatabase.db, crypto.randomUUID(), now)).id;
  });

  async function activeProgram(spec: ProgramSpec): Promise<Program> {
    const { db } = testDatabase;
    const program = await createProgramFromSpec(db, profileId, spec, now);
    expectOk(await activateProgram(db, profileId, program.id, now));
    return program;
  }

  async function open(workoutId: string): Promise<SessionView> {
    return expectOk(await startWorkout(testDatabase.db, profileId, workoutId, now));
  }

  async function lastWeights(programId: string): Promise<(number | null)[][]> {
    const program = expectOk(await getProgram(testDatabase.db, profileId, programId));
    return program.workouts.flatMap((workout) =>
      workout.slots.flatMap((slot) =>
        slot.prescriptions.map((prescription) =>
          prescription.plannedSets.map((plannedSet) => plannedSet.lastWeightKg),
        ),
      ),
    );
  }

  const fourWorkouts: ProgramSpec = {
    blockCount: 2,
    workouts: ['Upper A', 'Lower A', 'Upper B', 'Lower B'].map((name) => ({
      name,
      slots: [{ exercise: `${name} lift`, targetReps: [10, 10] }],
    })),
  };

  it('US2 scenario 2, rule 14: a slot that was never logged shows targets and no suggested weight', async () => {
    const program = await activeProgram({
      blockCount: 2,
      workouts: [
        { name: 'Upper A', slots: [{ exercise: 'Row', targetReps: [12, 10, 8] }] },
        { name: 'Lower A', slots: [] },
      ],
    });

    const session = await open(program.workouts[0]?.id ?? '');

    expect(session.status).toBe('in_progress');
    expect(session.cycleNumber).toBe(1);
    expect(session.blockNumber).toBe(1);
    expect(
      session.slots[0]?.plannedSets.map((set) => [
        set.setNumber,
        set.targetReps,
        set.suggestedWeightKg,
      ]),
    ).toEqual([
      [1, 12, null],
      [2, 10, null],
      [3, 8, null],
    ]);
  });

  it('US2 scenario 3, rule 11: finishing without logging creates no set log and keeps last weight', async () => {
    const { db } = testDatabase;
    const program = await activeProgram(fourWorkouts);
    const slot = program.workouts[0]?.slots[0];
    await db
      .update(plannedSets)
      .set({ lastWeightGrams: 20000 })
      .where(eq(plannedSets.exerciseSlotId, slot?.id ?? ''));
    const session = await open(program.workouts[0]?.id ?? '');
    expect(session.slots[0]?.plannedSets.map((set) => set.suggestedWeightKg)).toEqual([20, 20]);

    expectOk(await finishWorkout(db, profileId, session.id, now));

    expect(await db.select().from(setLogs).where(eq(setLogs.profileId, profileId))).toEqual([]);
    const weights = await lastWeights(program.id);
    expect(weights[0]).toEqual([20, 20]);
    expect(weights[1]).toEqual([20, 20]);
  });

  it('US2 scenario 4, rules 15 and 16: logging records the set with its context and updates only that planned set', async () => {
    const { db } = testDatabase;
    const program = await activeProgram({
      blockCount: 2,
      workouts: [
        { name: 'Upper A', slots: [{ exercise: 'Incline bench press', targetReps: [12, 12, 12] }] },
        { name: 'Upper B', slots: [{ exercise: 'Incline bench press', targetReps: [12, 12, 12] }] },
      ],
    });
    const upperA = program.workouts[0];
    const activeCycle = expectOk(await getProgram(db, profileId, program.id)).activeCycle;
    const session = await open(upperA?.id ?? '');
    const targetSet = session.slots[0]?.plannedSets[1];

    const logged = expectOk(
      await logSet(db, profileId, session.id, targetSet?.id ?? '', { reps: 10, weightKg: 40 }, now),
    );

    expect(logged).toMatchObject({
      exerciseId: upperA?.slots[0]?.exercise.id,
      performedAt: now,
      setNumber: 2,
      reps: 10,
      weightKg: 40,
    });
    expect(logged.context).toEqual({
      programId: program.id,
      cycleId: activeCycle?.id,
      cycleNumber: 1,
      trainingBlockId: program.blocks[0]?.id,
      blockNumber: 1,
      workoutId: upperA?.id,
      exerciseSlotId: upperA?.slots[0]?.id,
      workoutSessionId: session.id,
    });
    expect(await lastWeights(program.id)).toEqual([
      [null, 40, null],
      [null, null, null],
      [null, null, null],
      [null, null, null],
    ]);
    expect(
      await db.select().from(setLogs).where(eq(setLogs.workoutSessionId, session.id)),
    ).toHaveLength(1);
  });

  it('US2 scenario 5: a bodyweight set is logged without weight and clears the last weight', async () => {
    const { db } = testDatabase;
    const program = await activeProgram({
      blockCount: 1,
      workouts: [
        { name: 'Pull', slots: [{ exercise: 'Chin-up', targetReps: [8, 8] }] },
        { name: 'Push', slots: [] },
      ],
    });
    await db
      .update(plannedSets)
      .set({ lastWeightGrams: 10000 })
      .where(eq(plannedSets.exerciseSlotId, program.workouts[0]?.slots[0]?.id ?? ''));
    const session = await open(program.workouts[0]?.id ?? '');

    const logged = expectOk(
      await logSet(
        db,
        profileId,
        session.id,
        session.slots[0]?.plannedSets[0]?.id ?? '',
        { reps: 8 },
        now,
      ),
    );

    expect(logged.weightKg).toBeNull();
    expect((await lastWeights(program.id))[0]).toEqual([null, 10]);
  });

  it('US2 scenario 6, rule 10: suggests the first unfinished workout and lets any unfinished one start', async () => {
    const { db } = testDatabase;
    const program = await activeProgram(fourWorkouts);
    const [upperA, lowerA, upperB, lowerB] = program.workouts;

    for (const workout of [upperA, lowerA]) {
      const session = await open(workout?.id ?? '');
      expectOk(await finishWorkout(db, profileId, session.id, now));
    }

    const overview = await getTrainingOverview(db, profileId);
    expect(overview?.suggestedWorkoutId).toBe(upperB?.id);
    expect(overview?.workouts.map((workout) => workout.status)).toEqual([
      'finished',
      'finished',
      'not-started',
      'not-started',
    ]);
    expect(overview?.block).toEqual({ number: 1, label: null, count: 2 });
    expect((await open(lowerB?.id ?? '')).status).toBe('in_progress');
    expect((await getTrainingOverview(db, profileId))?.workouts[3]?.status).toBe('in-progress');
  });

  it('US2 scenario 7, rule 12: a workout can be finished with no sets logged', async () => {
    const { db } = testDatabase;
    const program = await activeProgram(fourWorkouts);
    const session = await open(program.workouts[0]?.id ?? '');

    expect(expectOk(await finishWorkout(db, profileId, session.id, now))).toEqual({
      progression: 'none',
    });

    const finished = expectOk(await getSession(db, profileId, session.id));
    expect(finished.status).toBe('finished');
    expect(finished.finishedAt).toEqual(now);
  });

  it('starting a workout that is already in progress resumes the same session', async () => {
    const program = await activeProgram(fourWorkouts);
    const first = await open(program.workouts[0]?.id ?? '');
    const second = await open(program.workouts[0]?.id ?? '');
    expect(second.id).toBe(first.id);
  });

  it('refuses to start a workout that is already finished in this block', async () => {
    const { db } = testDatabase;
    const program = await activeProgram(fourWorkouts);
    const workoutId = program.workouts[0]?.id ?? '';
    expectOk(await finishWorkout(db, profileId, (await open(workoutId)).id, now));

    expect(await startWorkout(db, profileId, workoutId, now)).toEqual({
      ok: false,
      error: 'workout-already-finished',
    });
  });

  it('refuses to log into a finished session', async () => {
    const { db } = testDatabase;
    const program = await activeProgram(fourWorkouts);
    const session = await open(program.workouts[0]?.id ?? '');
    expectOk(await finishWorkout(db, profileId, session.id, now));

    expect(
      await logSet(
        db,
        profileId,
        session.id,
        session.slots[0]?.plannedSets[0]?.id ?? '',
        { reps: 5 },
        now,
      ),
    ).toEqual({ ok: false, error: 'session-not-in-progress' });
    expect(await finishWorkout(db, profileId, session.id, now)).toEqual({
      ok: false,
      error: 'session-not-in-progress',
    });
  });

  it('refuses to log a planned set that belongs to another workout or another block', async () => {
    const { db } = testDatabase;
    const program = await activeProgram(fourWorkouts);
    const session = await open(program.workouts[0]?.id ?? '');
    const otherWorkoutSet =
      (await open(program.workouts[1]?.id ?? '')).slots[0]?.plannedSets[0]?.id ?? '';
    const otherBlockSet =
      (
        await db
          .select({ id: plannedSets.id })
          .from(plannedSets)
          .where(
            and(
              eq(plannedSets.exerciseSlotId, program.workouts[0]?.slots[0]?.id ?? ''),
              eq(plannedSets.trainingBlockId, program.blocks[1]?.id ?? ''),
              eq(plannedSets.setNumber, 1),
            ),
          )
      )[0]?.id ?? '';

    for (const plannedSetId of [otherWorkoutSet, otherBlockSet]) {
      expect(await logSet(db, profileId, session.id, plannedSetId, { reps: 5 }, now)).toEqual({
        ok: false,
        error: 'planned-set-not-in-session',
      });
    }
    expect(await db.select().from(setLogs).where(eq(setLogs.profileId, profileId))).toEqual([]);
  });

  it('refuses invalid reps and weights without saving anything', async () => {
    const { db } = testDatabase;
    const program = await activeProgram(fourWorkouts);
    const session = await open(program.workouts[0]?.id ?? '');
    const plannedSetId = session.slots[0]?.plannedSets[0]?.id ?? '';

    expect(await logSet(db, profileId, session.id, plannedSetId, { reps: 0 }, now)).toEqual({
      ok: false,
      error: 'invalid-reps',
    });
    expect(
      await logSet(db, profileId, session.id, plannedSetId, { reps: 5, weightKg: -2 }, now),
    ).toEqual({
      ok: false,
      error: 'invalid-weight',
    });
    expect(await db.select().from(setLogs).where(eq(setLogs.profileId, profileId))).toEqual([]);
  });

  it('logging the same planned set twice makes two set logs and the later weight wins', async () => {
    const { db } = testDatabase;
    const program = await activeProgram(fourWorkouts);
    const session = await open(program.workouts[0]?.id ?? '');
    const plannedSetId = session.slots[0]?.plannedSets[0]?.id ?? '';

    expectOk(
      await logSet(db, profileId, session.id, plannedSetId, { reps: 10, weightKg: 50 }, now),
    );
    expectOk(
      await logSet(db, profileId, session.id, plannedSetId, { reps: 9, weightKg: 52.5 }, now),
    );

    const viewed = expectOk(await getSession(db, profileId, session.id));
    expect(viewed.slots[0]?.loggedSets.map((log) => log.weightKg)).toEqual([50, 52.5]);
    expect((await lastWeights(program.id))[0]).toEqual([52.5, null]);
  });

  it('a workout with no exercise slots can be started and finished', async () => {
    const { db } = testDatabase;
    const program = await activeProgram({
      blockCount: 1,
      workouts: [
        { name: 'Rest day', slots: [] },
        { name: 'Pull', slots: [{ exercise: 'Row', targetReps: [10] }] },
      ],
    });
    const session = await open(program.workouts[0]?.id ?? '');
    expect(session.slots).toEqual([]);
    expect(expectOk(await finishWorkout(db, profileId, session.id, now))).toEqual({
      progression: 'none',
    });
  });

  it('rule 3: activating a program with no active cycle starts cycle 1 at block 1', async () => {
    const { db } = testDatabase;
    const program = await createProgramFromSpec(db, profileId, fourWorkouts, now);

    const cycle = expectOk(await activateProgram(db, profileId, program.id, now));

    expect(cycle).toMatchObject({
      number: 1,
      status: 'active',
      currentBlockNumber: 1,
      startedAt: now,
      endedAt: null,
    });
    expect(expectOk(await getProgram(db, profileId, program.id)).isActive).toBe(true);
  });

  it('activating the program that is already active changes nothing and starts no new cycle', async () => {
    const { db } = testDatabase;
    const program = await createProgramFromSpec(db, profileId, fourWorkouts, now);
    const first = expectOk(await activateProgram(db, profileId, program.id, now));
    const again = expectOk(
      await activateProgram(db, profileId, program.id, new Date('2026-10-09T10:00:00Z')),
    );

    expect(again).toEqual(first);
    expect(await db.select().from(cycles).where(eq(cycles.programId, program.id))).toHaveLength(1);
  });

  it('refuses to activate a program that has no workouts or a slot without planned sets', async () => {
    const { db } = testDatabase;
    const empty = await createProgramFromSpec(db, profileId, { blockCount: 2, workouts: [] }, now);
    expect(await activateProgram(db, profileId, empty.id, now)).toEqual({
      ok: false,
      error: 'program-incomplete',
    });
    expect(expectOk(await getProgram(db, profileId, empty.id)).isActive).toBe(false);
    expect(await activateProgram(db, profileId, 'missing', now)).toEqual({
      ok: false,
      error: 'not-found',
    });
  });

  it('refuses to start a workout when no program is active or the workout is not in the active program', async () => {
    const { db } = testDatabase;
    const other = await createProgramFromSpec(db, profileId, fourWorkouts, now);
    expect(await startWorkout(db, profileId, other.workouts[0]?.id ?? '', now)).toEqual({
      ok: false,
      error: 'no-active-program',
    });

    await activeProgram({ ...fourWorkouts, name: 'Active one' });
    expect(await startWorkout(db, profileId, other.workouts[0]?.id ?? '', now)).toEqual({
      ok: false,
      error: 'workout-not-in-active-program',
    });
    expect(await getTrainingOverview(db, crypto.randomUUID())).toBeNull();
  });
});
