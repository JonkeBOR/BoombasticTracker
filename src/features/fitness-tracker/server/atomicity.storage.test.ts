import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { activateProgram } from './activation';
import { ensureProfile } from './profile';
import { cycles, plannedSets, setLogs, workoutSessions } from './schema';
import { openTestDatabase, type TestDatabase } from './storage-test-database';
import { createProgramFromSpec, expectOk, messagesOf, rejectionOf } from './storage-test-support';
import { finishWorkout, logSet, startWorkout } from './training';

describe('atomic changes', () => {
  let testDatabase: TestDatabase;
  const now = new Date('2026-10-02T10:00:00Z');

  beforeAll(async () => {
    testDatabase = await openTestDatabase();
  });

  afterAll(async () => {
    await testDatabase.dispose();
  });

  async function failingWhile(
    triggerSql: string,
    triggerName: string,
    run: () => Promise<unknown>,
  ) {
    const { db } = testDatabase;
    await db.run(sql.raw(triggerSql));
    try {
      return await rejectionOf(run);
    } finally {
      await db.run(sql.raw(`DROP TRIGGER ${triggerName}`));
    }
  }

  it('SC-004, FR-029: when the last weight cannot be updated, no set log is stored either', async () => {
    const { db } = testDatabase;
    const profileId = (await ensureProfile(db, crypto.randomUUID(), now)).id;
    const program = await createProgramFromSpec(
      db,
      profileId,
      {
        blockCount: 1,
        workouts: [
          { name: 'Upper A', slots: [{ exercise: 'Row', targetReps: [10] }] },
          { name: 'Lower A', slots: [] },
        ],
      },
      now,
    );
    expectOk(await activateProgram(db, profileId, program.id, now));
    const session = expectOk(await startWorkout(db, profileId, program.workouts[0]?.id ?? '', now));
    const plannedSetId = session.slots[0]?.plannedSets[0]?.id ?? '';

    const failure = await failingWhile(
      "CREATE TRIGGER test_block_last_weight BEFORE UPDATE ON planned_sets BEGIN SELECT RAISE(ABORT, 'forced failure'); END",
      'test_block_last_weight',
      () => logSet(db, profileId, session.id, plannedSetId, { reps: 10, weightKg: 40 }, now),
    );

    expect(messagesOf(failure)).toContain('forced failure');
    expect(await db.select().from(setLogs).where(eq(setLogs.workoutSessionId, session.id))).toEqual(
      [],
    );
    const [plannedSet] = await db
      .select()
      .from(plannedSets)
      .where(eq(plannedSets.id, plannedSetId));
    expect(plannedSet?.lastWeightGrams).toBeNull();

    expectOk(
      await logSet(db, profileId, session.id, plannedSetId, { reps: 10, weightKg: 40 }, now),
    );
    expect(
      await db.select().from(setLogs).where(eq(setLogs.workoutSessionId, session.id)),
    ).toHaveLength(1);
  });

  it('SC-004: when the new pass cannot be started, finishing the workout is rolled back too', async () => {
    const { db } = testDatabase;
    const profileId = (await ensureProfile(db, crypto.randomUUID(), now)).id;
    const program = await createProgramFromSpec(
      db,
      profileId,
      {
        blockCount: 1,
        workouts: [{ name: 'Only', slots: [{ exercise: 'Squat', targetReps: [5] }] }],
      },
      now,
    );
    expectOk(await activateProgram(db, profileId, program.id, now));
    const session = expectOk(await startWorkout(db, profileId, program.workouts[0]?.id ?? '', now));

    const failure = await failingWhile(
      "CREATE TRIGGER test_block_new_pass BEFORE UPDATE ON cycles BEGIN SELECT RAISE(ABORT, 'forced failure'); END",
      'test_block_new_pass',
      () => finishWorkout(db, profileId, session.id, now),
    );

    expect(messagesOf(failure)).toContain('forced failure');
    const [stored] = await db
      .select()
      .from(workoutSessions)
      .where(eq(workoutSessions.id, session.id));
    expect(stored).toMatchObject({ status: 'in_progress', finishedAt: null });
    const programCycles = await db.select().from(cycles).where(eq(cycles.programId, program.id));
    expect(programCycles.map((cycle) => [cycle.pass, cycle.currentBlockId])).toEqual([
      [1, program.blocks[0]?.id],
    ]);

    expect(expectOk(await finishWorkout(db, profileId, session.id, now))).toEqual({
      progression: 'new-pass',
      completedBlockNumber: 1,
    });
  });
});
