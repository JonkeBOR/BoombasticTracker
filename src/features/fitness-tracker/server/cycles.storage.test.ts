import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Program } from '../domain/types';
import { activateProgram, listCycles, pauseActiveProgram, startOver } from './activation';
import { ensureProfile } from './profile';
import { getProgram, listPrograms } from './programs';
import { cycles, setLogs, workoutSessions } from './schema';
import { openTestDatabase, type TestDatabase } from './storage-test-database';
import {
  createProgramFromSpec,
  expectOk,
  messagesOf,
  type ProgramSpec,
  rejectionOf,
} from './storage-test-support';
import { finishWorkout, getSession, getTrainingOverview, logSet, startWorkout } from './training';

describe('cycles and progression', () => {
  let testDatabase: TestDatabase;
  let profileId: string;
  let clock: number;

  beforeAll(async () => {
    testDatabase = await openTestDatabase();
  });

  afterAll(async () => {
    await testDatabase.dispose();
  });

  beforeEach(async () => {
    clock = Date.parse('2026-10-01T08:00:00Z');
    profileId = (await ensureProfile(testDatabase.db, crypto.randomUUID(), tick())).id;
  });

  function tick(): Date {
    clock += 60_000;
    return new Date(clock);
  }

  async function activate(spec: ProgramSpec): Promise<Program> {
    const { db } = testDatabase;
    const program = await createProgramFromSpec(db, profileId, spec, tick());
    expectOk(await activateProgram(db, profileId, program.id, tick()));
    return program;
  }

  async function finishWorkoutById(workoutId: string, at: Date = tick()) {
    const { db } = testDatabase;
    const session = expectOk(await startWorkout(db, profileId, workoutId, tick()));
    return expectOk(await finishWorkout(db, profileId, session.id, at));
  }

  async function finishBlock(program: Program, at?: Date) {
    let progression = 'none';
    for (const workout of program.workouts) {
      progression = (await finishWorkoutById(workout.id, at)).progression;
    }
    return progression;
  }

  async function currentBlock(): Promise<number | undefined> {
    return (await getTrainingOverview(testDatabase.db, profileId))?.block.number;
  }

  const fourWorkoutsThreeBlocks: ProgramSpec = {
    blockCount: 3,
    workouts: ['Upper A', 'Lower A', 'Upper B', 'Lower B'].map((name) => ({
      name,
      slots: [{ exercise: `${name} lift`, targetReps: [10] }],
    })),
  };

  it('US3 scenario 1, rules 6 and 7: finishing the fourth workout of block 2 moves the cycle to block 3', async () => {
    const program = await activate(fourWorkoutsThreeBlocks);
    expect(await finishBlock(program)).toBe('block-advanced');
    expect(await currentBlock()).toBe(2);

    for (const workout of program.workouts.slice(0, 3)) {
      expect((await finishWorkoutById(workout.id)).progression).toBe('none');
    }
    expect(await currentBlock()).toBe(2);

    expect((await finishWorkoutById(program.workouts[3]?.id ?? '')).progression).toBe(
      'block-advanced',
    );
    expect(await currentBlock()).toBe(3);
  });

  it('rule 6: a workout that is only in progress does not complete the block', async () => {
    const { db } = testDatabase;
    const program = await activate({ ...fourWorkoutsThreeBlocks, blockCount: 2 });
    for (const workout of program.workouts.slice(0, 3)) {
      await finishWorkoutById(workout.id);
    }
    expectOk(await startWorkout(db, profileId, program.workouts[3]?.id ?? '', tick()));
    expect(await currentBlock()).toBe(1);
  });

  it('US3 scenario 2, rule 7: finishing the last workout of the last block completes the cycle and starts the next at block 1', async () => {
    const { db } = testDatabase;
    const program = await activate({ ...fourWorkoutsThreeBlocks, blockCount: 2 });
    await finishBlock(program);
    const completedAt = tick();

    expect(await finishBlock(program, completedAt)).toBe('cycle-completed');

    const [first, second] = await listCycles(db, profileId, program.id);
    expect(first).toMatchObject({
      number: 1,
      status: 'completed',
      currentBlockNumber: 2,
      endedAt: completedAt,
    });
    expect(second).toMatchObject({
      number: 2,
      status: 'active',
      currentBlockNumber: 1,
      endedAt: null,
    });
    expect(second?.startedAt).toEqual(completedAt);
    expect(await currentBlock()).toBe(1);
    expect((await getTrainingOverview(db, profileId))?.cycle.number).toBe(2);
  });

  it('US3 scenario 3, rules 8 and 9: starting over ends the cycle early at the block it reached and keeps all history', async () => {
    const { db } = testDatabase;
    const program = await activate(fourWorkoutsThreeBlocks);
    const firstBlock = expectOk(
      await startWorkout(db, profileId, program.workouts[0]?.id ?? '', tick()),
    );
    expectOk(
      await logSet(
        db,
        profileId,
        firstBlock.id,
        firstBlock.slots[0]?.plannedSets[0]?.id ?? '',
        { reps: 10, weightKg: 30 },
        tick(),
      ),
    );
    expectOk(await finishWorkout(db, profileId, firstBlock.id, tick()));
    for (const workout of program.workouts.slice(1)) {
      await finishWorkoutById(workout.id);
    }
    await finishBlock(program);
    expect(await currentBlock()).toBe(3);
    const logsBefore = await db.select().from(setLogs).where(eq(setLogs.profileId, profileId));
    const sessionsBefore = await db
      .select()
      .from(workoutSessions)
      .where(eq(workoutSessions.profileId, profileId));
    const restartedAt = tick();

    const fresh = expectOk(await startOver(db, profileId, restartedAt));

    expect(fresh).toMatchObject({
      number: 2,
      status: 'active',
      currentBlockNumber: 1,
      startedAt: restartedAt,
    });
    const [ended] = await listCycles(db, profileId, program.id);
    expect(ended).toMatchObject({
      number: 1,
      status: 'ended_early',
      currentBlockNumber: 3,
      endedAt: restartedAt,
    });
    expect(await db.select().from(setLogs).where(eq(setLogs.profileId, profileId))).toEqual(
      logsBefore,
    );
    expect(
      await db.select().from(workoutSessions).where(eq(workoutSessions.profileId, profileId)),
    ).toEqual(sessionsBefore);
    expect(await currentBlock()).toBe(1);
  });

  it('US3 scenario 4, rule 2: activating another program ends the first cycle early and starts the new one at block 1', async () => {
    const { db } = testDatabase;
    const first = await activate({ ...fourWorkoutsThreeBlocks, name: 'First' });
    await finishWorkoutById(first.workouts[0]?.id ?? '');
    const second = await createProgramFromSpec(
      db,
      profileId,
      { ...fourWorkoutsThreeBlocks, name: 'Second' },
      tick(),
    );
    const switchedAt = tick();

    const cycle = expectOk(await activateProgram(db, profileId, second.id, switchedAt));

    expect(cycle).toMatchObject({ number: 1, status: 'active', currentBlockNumber: 1 });
    expect(expectOk(await getProgram(db, profileId, first.id)).isActive).toBe(false);
    expect(expectOk(await getProgram(db, profileId, second.id)).isActive).toBe(true);
    expect((await listCycles(db, profileId, first.id))[0]).toMatchObject({
      status: 'ended_early',
      endedAt: switchedAt,
    });

    expectOk(await activateProgram(db, profileId, first.id, tick()));
    expect(
      (await listCycles(db, profileId, first.id)).map((item) => [item.number, item.status]),
    ).toEqual([
      [1, 'ended_early'],
      [2, 'active'],
    ]);
  });

  it('US3 scenario 5, rule 2: pausing leaves no active program and ends the cycle early', async () => {
    const { db } = testDatabase;
    const program = await activate(fourWorkoutsThreeBlocks);
    const pausedAt = tick();

    expectOk(await pauseActiveProgram(db, profileId, pausedAt));

    expect(expectOk(await getProgram(db, profileId, program.id)).isActive).toBe(false);
    expect(await getTrainingOverview(db, profileId)).toBeNull();
    expect((await listCycles(db, profileId, program.id))[0]).toMatchObject({
      status: 'ended_early',
      endedAt: pausedAt,
    });
    expect(await pauseActiveProgram(db, profileId, tick())).toEqual({
      ok: false,
      error: 'no-active-program',
    });
    expect(await startOver(db, profileId, tick())).toEqual({
      ok: false,
      error: 'no-active-program',
    });
  });

  it.each([
    ['starting over', 'start-over'],
    ['pausing', 'pause'],
    ['switching programs', 'switch'],
  ])(
    'US3 scenario 6, rule 13: %s closes a session that is still in progress as finished',
    async (_label, how) => {
      const { db } = testDatabase;
      const program = await activate(fourWorkoutsThreeBlocks);
      const open = expectOk(
        await startWorkout(db, profileId, program.workouts[0]?.id ?? '', tick()),
      );
      const closedAt = tick();

      if (how === 'start-over') {
        expectOk(await startOver(db, profileId, closedAt));
      } else if (how === 'pause') {
        expectOk(await pauseActiveProgram(db, profileId, closedAt));
      } else {
        const other = await createProgramFromSpec(
          db,
          profileId,
          { ...fourWorkoutsThreeBlocks, name: 'Other' },
          tick(),
        );
        expectOk(await activateProgram(db, profileId, other.id, closedAt));
      }

      const session = expectOk(await getSession(db, profileId, open.id));
      expect(session.status).toBe('finished');
      expect(session.finishedAt).toEqual(closedAt);
    },
  );

  it('domain scenario "Prefill from the previous cycle", rule 14: cycle 2 block 1 suggests the weights logged in cycle 1', async () => {
    const { db } = testDatabase;
    const program = await activate({
      blockCount: 1,
      workouts: [
        { name: 'Upper A', slots: [{ exercise: 'Incline bench press', targetReps: [12, 12, 12] }] },
        { name: 'Lower A', slots: [] },
      ],
    });
    const session = expectOk(
      await startWorkout(db, profileId, program.workouts[0]?.id ?? '', tick()),
    );
    const weights = [65, 62, 60];
    for (const [index, plannedSet] of (session.slots[0]?.plannedSets ?? []).entries()) {
      expectOk(
        await logSet(
          db,
          profileId,
          session.id,
          plannedSet.id,
          { reps: 12, weightKg: weights[index] },
          tick(),
        ),
      );
    }
    expectOk(await finishWorkout(db, profileId, session.id, tick()));
    expect((await finishWorkoutById(program.workouts[1]?.id ?? '')).progression).toBe(
      'cycle-completed',
    );

    const next = expectOk(await startWorkout(db, profileId, program.workouts[0]?.id ?? '', tick()));

    expect(next.cycleNumber).toBe(2);
    expect(next.blockNumber).toBe(1);
    expect(next.slots[0]?.plannedSets.map((set) => set.suggestedWeightKg)).toEqual([65, 62, 60]);
  });

  it('rule 20: an optional slot that is never logged does not stop the block from completing', async () => {
    const { db } = testDatabase;
    const program = await activate({
      blockCount: 2,
      workouts: [
        {
          name: 'Upper A',
          slots: [
            { exercise: 'Bench press', targetReps: [8] },
            { exercise: 'Curl', targetReps: [12] },
          ],
        },
      ],
    });
    const slotId = program.workouts[0]?.slots[1]?.id ?? '';
    const { setSlotOptional } = await import('./programs');
    expectOk(await setSlotOptional(db, profileId, slotId, { isOptional: true }));

    expect((await finishWorkoutById(program.workouts[0]?.id ?? '')).progression).toBe(
      'block-advanced',
    );
  });

  it('rule 5: cycles are numbered 1, 2, 3 across completion and starting over', async () => {
    const { db } = testDatabase;
    const program = await activate({
      blockCount: 1,
      workouts: [{ name: 'Only', slots: [{ exercise: 'Squat', targetReps: [5] }] }],
    });
    expect((await finishWorkoutById(program.workouts[0]?.id ?? '')).progression).toBe(
      'cycle-completed',
    );
    expectOk(await startOver(db, profileId, tick()));

    expect(
      (await listCycles(db, profileId, program.id)).map((cycle) => [cycle.number, cycle.status]),
    ).toEqual([
      [1, 'completed'],
      [2, 'ended_early'],
      [3, 'active'],
    ]);
  });

  it('lists no cycles for a program of another profile', async () => {
    const { db } = testDatabase;
    const program = await activate(fourWorkoutsThreeBlocks);
    const otherProfileId = (await ensureProfile(db, crypto.randomUUID(), tick())).id;
    expect(await listCycles(db, otherProfileId, program.id)).toEqual([]);
  });

  it('rule 1: a profile has at most one active program, however many are activated in turn', async () => {
    const { db } = testDatabase;
    const first = await activate({ ...fourWorkoutsThreeBlocks, name: 'First' });
    const second = await createProgramFromSpec(
      db,
      profileId,
      { ...fourWorkoutsThreeBlocks, name: 'Second' },
      tick(),
    );
    const third = await createProgramFromSpec(
      db,
      profileId,
      { ...fourWorkoutsThreeBlocks, name: 'Third' },
      tick(),
    );

    expectOk(await activateProgram(db, profileId, second.id, tick()));
    expectOk(await activateProgram(db, profileId, third.id, tick()));

    const summaries = await listPrograms(db, profileId);
    expect(summaries.filter((summary) => summary.isActive).map((summary) => summary.id)).toEqual([
      third.id,
    ]);
    expect(summaries.map((summary) => summary.id)).toContain(first.id);
  });

  it('rule 4: a program has at most one active cycle, even if a second one is inserted directly', async () => {
    const { db } = testDatabase;
    const program = await activate(fourWorkoutsThreeBlocks);

    const failure = await rejectionOf(async () => {
      await db.insert(cycles).values({
        id: crypto.randomUUID(),
        programId: program.id,
        number: 99,
        status: 'active',
        currentBlockNumber: 1,
        startedAt: tick(),
        endedAt: null,
      });
    });

    expect(messagesOf(failure)).toContain('UNIQUE constraint failed');
    expect(
      (await listCycles(db, profileId, program.id)).filter((cycle) => cycle.status === 'active'),
    ).toHaveLength(1);
  });
});
