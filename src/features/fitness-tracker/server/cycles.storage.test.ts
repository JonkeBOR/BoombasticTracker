import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Program } from '../domain/types';
import { activateProgram, pauseActiveProgram, skipToBlock } from './activation';
import { ensureProfile } from './profile';
import { getProgram, listPrograms, setSlotOptional } from './programs';
import { cycles, setLogs, workoutSessions } from './schema';
import { openTestDatabase, type TestDatabase } from './storage-test-database';
import {
  activeOverview,
  createProgramFromSpec,
  expectOk,
  finishBlock,
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

  async function create(spec: ProgramSpec): Promise<Program> {
    return createProgramFromSpec(testDatabase.db, profileId, spec, tick());
  }

  async function activate(spec: ProgramSpec): Promise<Program> {
    const program = await create(spec);
    expectOk(await activateProgram(testDatabase.db, profileId, program.id, tick()));
    return program;
  }

  async function finishWorkoutById(workoutId: string, at: Date = tick()) {
    const { db } = testDatabase;
    const session = expectOk(await startWorkout(db, profileId, workoutId, tick()));
    return expectOk(await finishWorkout(db, profileId, session.id, at));
  }

  async function currentBlockNumber(): Promise<number | undefined> {
    return (await getTrainingOverview(testDatabase.db, profileId))?.currentBlock.number;
  }

  async function passOf(program: Program): Promise<number> {
    return expectOk(await getProgram(testDatabase.db, profileId, program.id)).cycle.pass;
  }

  const fourWorkoutsThreeBlocks: ProgramSpec = {
    blockCount: 3,
    workouts: ['Upper A', 'Lower A', 'Upper B', 'Lower B'].map((name) => ({
      name,
      slots: [{ exercise: `${name} lift`, targetReps: [10] }],
    })),
  };

  it('US3 scenario 1, rules 6 and 7, FR-045: finishing the fourth workout of block 2 moves the program to block 3', async () => {
    const { db } = testDatabase;
    const program = await activate(fourWorkoutsThreeBlocks);
    expect(await finishBlock(db, profileId, tick)).toBe('block-advanced');
    expect(await currentBlockNumber()).toBe(2);

    for (const workout of program.workouts.slice(0, 3)) {
      expect((await finishWorkoutById(workout.id)).progression).toBe('none');
    }
    expect(await currentBlockNumber()).toBe(2);

    const last = await finishWorkoutById(program.workouts[3]?.id ?? '');

    expect(last).toEqual({ progression: 'block-advanced', completedBlockNumber: 2 });
    expect(await currentBlockNumber()).toBe(3);
  });

  it('rule 6: a workout that is only in progress does not complete the block', async () => {
    const { db } = testDatabase;
    const program = await activate({ ...fourWorkoutsThreeBlocks, blockCount: 2 });
    for (const workout of program.workouts.slice(0, 3)) {
      await finishWorkoutById(workout.id);
    }
    expectOk(await startWorkout(db, profileId, program.workouts[3]?.id ?? '', tick()));

    expect(await currentBlockNumber()).toBe(1);
  });

  it('US3 scenario 2, rule 7, FR-045: finishing the last block starts a new pass at block 1 that no earlier session counts towards', async () => {
    const { db } = testDatabase;
    const program = await activate({ ...fourWorkoutsThreeBlocks, blockCount: 2 });
    await finishBlock(db, profileId, tick);
    expect(await passOf(program)).toBe(1);

    expect(await finishBlock(db, profileId, tick)).toBe('new-pass');

    const overview = await activeOverview(db, profileId);
    expect(await passOf(program)).toBe(2);
    expect(overview.currentBlock).toMatchObject({ number: 1, isLast: false });
    expect(overview.workouts.map((workout) => workout.status)).toEqual([
      'not-started',
      'not-started',
      'not-started',
      'not-started',
    ]);
    expect(overview.suggestedWorkoutId).toBe(program.workouts[0]?.id);
    expect(overview.blocks.map((block) => [block.status, block.finishedCount])).toEqual([
      ['current', 0],
      ['upcoming', 0],
    ]);
    expect(
      await db.select().from(workoutSessions).where(eq(workoutSessions.profileId, profileId)),
    ).toHaveLength(8);
  });

  it('FR-045: a new pass can be played through again and the last weights carry over', async () => {
    const { db } = testDatabase;
    const program = await activate({
      blockCount: 1,
      workouts: [{ name: 'Only', slots: [{ exercise: 'Squat', targetReps: [5] }] }],
    });
    const first = expectOk(
      await startWorkout(db, profileId, program.workouts[0]?.id ?? '', tick()),
    );
    expectOk(
      await logSet(
        db,
        profileId,
        first.id,
        first.slots[0]?.plannedSets[0]?.id ?? '',
        { reps: 5, weightKg: 100 },
        tick(),
      ),
    );
    expect(expectOk(await finishWorkout(db, profileId, first.id, tick())).progression).toBe(
      'new-pass',
    );

    const second = expectOk(
      await startWorkout(db, profileId, program.workouts[0]?.id ?? '', tick()),
    );

    expect(second.id).not.toBe(first.id);
    expect(second.status).toBe('in_progress');
    expect(second.slots[0]?.plannedSets[0]?.suggestedWeightKg).toBe(100);
  });

  it('US3 scenario 4, rule 2, FR-045: activating another program keeps the first one in place and closes its open session', async () => {
    const { db } = testDatabase;
    const first = await activate({ ...fourWorkoutsThreeBlocks, name: 'First' });
    await finishBlock(db, profileId, tick);
    const open = expectOk(await startWorkout(db, profileId, first.workouts[0]?.id ?? '', tick()));
    const second = await create({ ...fourWorkoutsThreeBlocks, name: 'Second' });
    const switchedAt = tick();

    const cycle = expectOk(await activateProgram(db, profileId, second.id, switchedAt));

    expect(cycle).toMatchObject({ pass: 1 });
    expect(expectOk(await getProgram(db, profileId, first.id)).isActive).toBe(false);
    expect(expectOk(await getProgram(db, profileId, second.id)).isActive).toBe(true);
    const closed = expectOk(await getSession(db, profileId, open.id));
    expect(closed.status).toBe('finished');
    expect(closed.finishedAt).toEqual(switchedAt);

    expectOk(await activateProgram(db, profileId, first.id, tick()));
    expect(await currentBlockNumber()).toBe(2);
  });

  it('US3 scenario 5, rule 2, FR-045: pausing leaves no active program, and reactivating continues from the same block with its finished workouts', async () => {
    const { db } = testDatabase;
    const program = await activate(fourWorkoutsThreeBlocks);
    await finishBlock(db, profileId, tick);
    await finishWorkoutById(program.workouts[0]?.id ?? '');
    await finishWorkoutById(program.workouts[1]?.id ?? '');
    expectOk(await pauseActiveProgram(db, profileId, tick()));

    expect(expectOk(await getProgram(db, profileId, program.id)).isActive).toBe(false);
    expect(await getTrainingOverview(db, profileId)).toBeNull();
    expect(await pauseActiveProgram(db, profileId, tick())).toEqual({
      ok: false,
      error: 'no-active-program',
    });

    expectOk(await activateProgram(db, profileId, program.id, tick()));

    const overview = await activeOverview(db, profileId);
    expect(overview.currentBlock.number).toBe(2);
    expect(overview.workouts.map((workout) => workout.status)).toEqual([
      'finished',
      'finished',
      'not-started',
      'not-started',
    ]);
    expect(overview.suggestedWorkoutId).toBe(program.workouts[2]?.id);
  });

  it('rules 3 and 4, FR-045: a program has exactly one cycle from the start, and activating changes no cycle row', async () => {
    const { db } = testDatabase;
    const program = await create(fourWorkoutsThreeBlocks);
    const before = await db.select().from(cycles).where(eq(cycles.programId, program.id));
    expect(before).toHaveLength(1);
    expect(before[0]).toMatchObject({ pass: 1, currentBlockId: program.blocks[0]?.id });

    expectOk(await activateProgram(db, profileId, program.id, tick()));
    expectOk(await activateProgram(db, profileId, program.id, tick()));

    expect(await db.select().from(cycles).where(eq(cycles.programId, program.id))).toEqual(before);
  });

  it.each([
    ['pausing', 'pause'],
    ['switching programs', 'switch'],
  ])(
    'US3 scenario 6, rule 13, FR-045: %s closes a session that is still in progress as finished',
    async (_label, how) => {
      const { db } = testDatabase;
      const program = await activate(fourWorkoutsThreeBlocks);
      const open = expectOk(
        await startWorkout(db, profileId, program.workouts[0]?.id ?? '', tick()),
      );
      const closedAt = tick();

      if (how === 'pause') {
        expectOk(await pauseActiveProgram(db, profileId, closedAt));
      } else {
        const other = await create({ ...fourWorkoutsThreeBlocks, name: 'Other' });
        expectOk(await activateProgram(db, profileId, other.id, closedAt));
      }

      const session = expectOk(await getSession(db, profileId, open.id));
      expect(session.status).toBe('finished');
      expect(session.finishedAt).toEqual(closedAt);
    },
  );

  it('rule 9, FR-033: pausing and starting a new pass change no set log and no earlier session', async () => {
    const { db } = testDatabase;
    const program = await activate({
      blockCount: 1,
      workouts: [{ name: 'Only', slots: [{ exercise: 'Squat', targetReps: [5] }] }],
    });
    const session = expectOk(
      await startWorkout(db, profileId, program.workouts[0]?.id ?? '', tick()),
    );
    expectOk(
      await logSet(
        db,
        profileId,
        session.id,
        session.slots[0]?.plannedSets[0]?.id ?? '',
        { reps: 5, weightKg: 100 },
        tick(),
      ),
    );
    const logsBefore = await db.select().from(setLogs).where(eq(setLogs.profileId, profileId));

    expectOk(await finishWorkout(db, profileId, session.id, tick()));
    expectOk(await pauseActiveProgram(db, profileId, tick()));

    expect(await db.select().from(setLogs).where(eq(setLogs.profileId, profileId))).toEqual(
      logsBefore,
    );
    expect(expectOk(await getSession(db, profileId, session.id)).status).toBe('finished');
  });

  it('domain scenario "Prefill from the previous cycle", rule 14, FR-045: pass 2 block 1 suggests the weights logged in pass 1', async () => {
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
    expect((await finishWorkoutById(program.workouts[1]?.id ?? '')).progression).toBe('new-pass');

    const next = expectOk(await startWorkout(db, profileId, program.workouts[0]?.id ?? '', tick()));

    expect(await passOf(program)).toBe(2);
    expect(next.block).toMatchObject({ number: 1 });
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
    expectOk(await setSlotOptional(db, profileId, slotId, { isOptional: true }));

    expect((await finishWorkoutById(program.workouts[0]?.id ?? '')).progression).toBe(
      'block-advanced',
    );
  });

  it('rule 1: a profile has at most one active program, however many are activated in turn', async () => {
    const { db } = testDatabase;
    const first = await activate({ ...fourWorkoutsThreeBlocks, name: 'First' });
    const second = await create({ ...fourWorkoutsThreeBlocks, name: 'Second' });
    const third = await create({ ...fourWorkoutsThreeBlocks, name: 'Third' });

    expectOk(await activateProgram(db, profileId, second.id, tick()));
    expectOk(await activateProgram(db, profileId, third.id, tick()));

    const summaries = await listPrograms(db, profileId);
    expect(summaries.filter((summary) => summary.isActive).map((summary) => summary.id)).toEqual([
      third.id,
    ]);
    expect(summaries.map((summary) => summary.id)).toContain(first.id);
  });

  describe('skipping to a block', () => {
    const fourBlocks: ProgramSpec = {
      blockCount: 4,
      workouts: ['Upper', 'Lower'].map((name) => ({
        name,
        slots: [{ exercise: `${name} lift`, targetReps: [10] }],
      })),
    };

    async function logAndFinish(workoutId: string, weightKg: number) {
      const { db } = testDatabase;
      const session = expectOk(await startWorkout(db, profileId, workoutId, tick()));
      expectOk(
        await logSet(
          db,
          profileId,
          session.id,
          session.slots[0]?.plannedSets[0]?.id ?? '',
          { reps: 10, weightKg },
          tick(),
        ),
      );
      expectOk(await finishWorkout(db, profileId, session.id, tick()));
    }

    it('US4 scenario 4, FR-040: moves to a later block, marks the blocks passed over as skipped and suggests its first workout', async () => {
      const { db } = testDatabase;
      const program = await activate(fourBlocks);
      await logAndFinish(program.workouts[0]?.id ?? '', 60);
      await finishBlock(db, profileId, tick);
      expect(await currentBlockNumber()).toBe(2);

      const result = await skipToBlock(
        db,
        profileId,
        { blockId: program.blocks[3]?.id ?? '' },
        tick(),
      );

      expect(result).toEqual({ ok: true, value: { newPass: false } });
      const overview = await activeOverview(db, profileId);
      expect(overview.currentBlock).toMatchObject({ number: 4, isLast: true });
      expect(overview.blocks.map((block) => block.status)).toEqual([
        'complete',
        'skipped',
        'skipped',
        'current',
      ]);
      expect(overview.blocks.map((block) => block.finishedCount)).toEqual([2, 0, 0, 0]);
      expect(overview.suggestedWorkoutId).toBe(program.workouts[0]?.id);
      expect(await passOf(program)).toBe(1);
    });

    it('US4 scenario 5, FR-040: the chosen block is prefilled with the last weights as usual', async () => {
      const { db } = testDatabase;
      const program = await activate(fourBlocks);
      await logAndFinish(program.workouts[0]?.id ?? '', 62.5);
      await skipToBlock(db, profileId, { blockId: program.blocks[2]?.id ?? '' }, tick());

      const session = expectOk(
        await startWorkout(db, profileId, program.workouts[0]?.id ?? '', tick()),
      );

      expect(session.block).toMatchObject({ number: 3 });
      expect(session.slots[0]?.plannedSets[0]?.suggestedWeightKg).toBeNull();
      expect(
        expectOk(await getProgram(db, profileId, program.id)).workouts[0]?.slots[0]
          ?.prescriptions[0]?.plannedSets[0]?.lastWeightKg,
      ).toBe(62.5);
    });

    it('US4 scenario 6, rule 8, FR-040: skipping to the first block starts a new pass with nothing finished', async () => {
      const { db } = testDatabase;
      const program = await activate(fourBlocks);
      await finishBlock(db, profileId, tick);
      await finishBlock(db, profileId, tick);
      expect(await currentBlockNumber()).toBe(3);

      const result = await skipToBlock(
        db,
        profileId,
        { blockId: program.blocks[0]?.id ?? '' },
        tick(),
      );

      expect(result).toEqual({ ok: true, value: { newPass: true } });
      const overview = await activeOverview(db, profileId);
      expect(overview.currentBlock).toMatchObject({ number: 1 });
      expect(overview.workouts.map((workout) => workout.status)).toEqual([
        'not-started',
        'not-started',
      ]);
      expect(await passOf(program)).toBe(2);
    });

    it('FR-040: skipping to the first block while on it also starts a new pass', async () => {
      const { db } = testDatabase;
      const program = await activate(fourBlocks);
      await finishWorkoutById(program.workouts[0]?.id ?? '');

      const result = await skipToBlock(
        db,
        profileId,
        { blockId: program.blocks[0]?.id ?? '' },
        tick(),
      );

      expect(result).toEqual({ ok: true, value: { newPass: true } });
      expect((await activeOverview(db, profileId)).workouts[0]?.status).toBe('not-started');
    });

    it.each(['later block', 'first block'])(
      'US4 scenario 8, rule 13, FR-040: skipping to a %s closes the open workout as finished',
      async (target) => {
        const { db } = testDatabase;
        const program = await activate(fourBlocks);
        const open = expectOk(
          await startWorkout(db, profileId, program.workouts[0]?.id ?? '', tick()),
        );
        const skippedAt = tick();
        const blockId = target === 'first block' ? program.blocks[0] : program.blocks[2];

        expectOk(await skipToBlock(db, profileId, { blockId: blockId?.id ?? '' }, skippedAt));

        const closed = expectOk(await getSession(db, profileId, open.id));
        expect(closed.status).toBe('finished');
        expect(closed.finishedAt).toEqual(skippedAt);
      },
    );

    it('rule 9, FR-033, FR-040: skipping creates, changes and removes no session and no set log', async () => {
      const { db } = testDatabase;
      const program = await activate(fourBlocks);
      await logAndFinish(program.workouts[0]?.id ?? '', 60);
      const logsBefore = await db.select().from(setLogs).where(eq(setLogs.profileId, profileId));
      const sessionsBefore = await db
        .select()
        .from(workoutSessions)
        .where(eq(workoutSessions.profileId, profileId));

      expectOk(await skipToBlock(db, profileId, { blockId: program.blocks[3]?.id ?? '' }, tick()));
      expectOk(await skipToBlock(db, profileId, { blockId: program.blocks[0]?.id ?? '' }, tick()));

      expect(await db.select().from(setLogs).where(eq(setLogs.profileId, profileId))).toEqual(
        logsBefore,
      );
      expect(
        await db.select().from(workoutSessions).where(eq(workoutSessions.profileId, profileId)),
      ).toEqual(sessionsBefore);
    });

    it('rule 7, FR-040: finishing the last block after skipping to it starts a new pass', async () => {
      const { db } = testDatabase;
      const program = await activate(fourBlocks);
      expectOk(await skipToBlock(db, profileId, { blockId: program.blocks[3]?.id ?? '' }, tick()));

      expect(await finishBlock(db, profileId, tick)).toBe('new-pass');

      expect(await passOf(program)).toBe(2);
      expect(await currentBlockNumber()).toBe(1);
    });

    it('FR-040: refuses the current block unless it is the first, and any earlier block but the first', async () => {
      const { db } = testDatabase;
      const program = await activate(fourBlocks);
      await finishBlock(db, profileId, tick);
      await finishBlock(db, profileId, tick);
      expect(await currentBlockNumber()).toBe(3);

      for (const refused of [program.blocks[2], program.blocks[1]]) {
        expect(await skipToBlock(db, profileId, { blockId: refused?.id ?? '' }, tick())).toEqual({
          ok: false,
          error: 'invalid-block',
        });
      }
      expect(await currentBlockNumber()).toBe(3);
    });

    it('FR-040: refuses a block that is not in the active program', async () => {
      const { db } = testDatabase;
      await activate(fourBlocks);
      const other = await create({ ...fourBlocks, name: 'Other' });
      const otherProfileId = (await ensureProfile(db, crypto.randomUUID(), tick())).id;
      const foreign = await createProgramFromSpec(db, otherProfileId, fourBlocks, tick());

      for (const blockId of [other.blocks[3]?.id, foreign.blocks[3]?.id, crypto.randomUUID()]) {
        expect(await skipToBlock(db, profileId, { blockId: blockId ?? '' }, tick())).toEqual({
          ok: false,
          error: 'invalid-block',
        });
      }
    });

    it('answers no-active-program when nothing is active', async () => {
      const program = await create(fourBlocks);

      expect(
        await skipToBlock(
          testDatabase.db,
          profileId,
          { blockId: program.blocks[1]?.id ?? '' },
          tick(),
        ),
      ).toEqual({ ok: false, error: 'no-active-program' });
    });

    it('FR-040: skipping from a paused-and-reactivated program still starts from its saved block', async () => {
      const { db } = testDatabase;
      const program = await activate(fourBlocks);
      await finishBlock(db, profileId, tick);
      expectOk(await pauseActiveProgram(db, profileId, tick()));
      expectOk(await activateProgram(db, profileId, program.id, tick()));

      expectOk(await skipToBlock(db, profileId, { blockId: program.blocks[3]?.id ?? '' }, tick()));

      expect(await currentBlockNumber()).toBe(4);
    });
  });

  it('FR-045: a program has at most one cycle, even if a second one is inserted directly', async () => {
    const { db } = testDatabase;
    const program = await activate(fourWorkoutsThreeBlocks);

    const failure = await rejectionOf(async () => {
      await db.insert(cycles).values({
        id: crypto.randomUUID(),
        programId: program.id,
        currentBlockId: program.blocks[0]?.id ?? '',
        pass: 99,
      });
    });

    expect(messagesOf(failure)).toContain('UNIQUE constraint failed');
    expect(await db.select().from(cycles).where(eq(cycles.programId, program.id))).toHaveLength(1);
  });
});
