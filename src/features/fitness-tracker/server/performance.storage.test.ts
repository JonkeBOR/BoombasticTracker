import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { groupByBlockAcrossCycles } from '../domain/history';
import { activateProgram } from './activation';
import { addExercise } from './exercises';
import { getExerciseHistory } from './history';
import { ensureProfile } from './profile';
import { plannedSets } from './schema';
import { openTestDatabase, type TestDatabase } from './storage-test-database';
import { createProgramFromSpec, expectOk } from './storage-test-support';
import { startWorkout } from './training';

describe('performance', () => {
  let testDatabase: TestDatabase;
  const now = new Date('2026-10-02T10:00:00Z');

  beforeAll(async () => {
    testDatabase = await openTestDatabase();
  });

  afterAll(async () => {
    await testDatabase.dispose();
  });

  it('SC-005: opening a session with prefilled weights takes under 1 second for 10 workouts x 10 slots x 10 blocks x 10 sets', async () => {
    const { db } = testDatabase;
    const profileId = (await ensureProfile(db, crypto.randomUUID(), now)).id;
    const program = await createProgramFromSpec(
      db,
      profileId,
      {
        blockCount: 10,
        workouts: Array.from({ length: 10 }, (_, workoutIndex) => ({
          name: `Workout ${workoutIndex + 1}`,
          slots: Array.from({ length: 10 }, (_, slotIndex) => ({
            exercise: `Lift ${workoutIndex + 1}.${slotIndex + 1}`,
            targetReps: Array.from({ length: 10 }, () => 10),
          })),
        })),
      },
      now,
    );
    expectOk(await activateProgram(db, profileId, program.id, now));
    await db.update(plannedSets).set({ lastWeightGrams: 50000 });

    const startedAt = performance.now();
    const session = expectOk(await startWorkout(db, profileId, program.workouts[0]?.id ?? '', now));
    const elapsedMs = performance.now() - startedAt;

    expect(session.slots).toHaveLength(10);
    expect(session.slots.every((slot) => slot.plannedSets.length === 10)).toBe(true);
    expect(session.slots[0]?.plannedSets[0]?.suggestedWeightKg).toBe(50);
    expect(elapsedMs).toBeLessThan(1000);
  }, 120_000);

  it('SC-006: one exercise history of 100,000 set logs, grouped by block across cycles, takes under 2 seconds', async () => {
    const { db } = testDatabase;
    const profileId = (await ensureProfile(db, crypto.randomUUID(), now)).id;
    const exerciseId = expectOk(await addExercise(db, profileId, { name: 'Squat' }, now)).id;
    await db.run(sql`
      WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 100000)
      INSERT INTO set_logs (
        id, profile_id, exercise_id, performed_at, set_number, reps, weight_grams,
        program_id, cycle_id, training_block_id, workout_id, exercise_slot_id,
        workout_session_id, cycle_number, block_number
      )
      SELECT
        'log-' || ${profileId} || '-' || i, ${profileId}, ${exerciseId},
        1700000000000 + i * 60000, (i % 3) + 1, 10, 50000 + (i % 40) * 500,
        'program', 'cycle-' || (i / 5000 + 1), 'block-' || ((i % 4) + 1), 'workout', 'slot',
        'session-' || i, i / 5000 + 1, (i % 4) + 1
      FROM n
    `);

    const startedAt = performance.now();
    const history = expectOk(await getExerciseHistory(db, profileId, exerciseId));
    const groups = groupByBlockAcrossCycles(history.setLogs);
    const elapsedMs = performance.now() - startedAt;

    expect(history.setLogs).toHaveLength(100_000);
    expect(groups.map((group) => group.blockNumber)).toEqual([1, 2, 3, 4]);
    expect(groups[0]?.cycles.length).toBeGreaterThan(1);
    expect(elapsedMs).toBeLessThan(2000);
  }, 120_000);
});
