import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Program } from '../domain/types';
import { addExercise, archiveExercise } from './exercises';
import { ensureProfile } from './profile';
import {
  addExerciseSlot,
  addTrainingBlock,
  addWorkout,
  createProgram,
  getProgram,
  labelTrainingBlock,
  moveExerciseSlot,
  moveTrainingBlock,
  moveWorkout,
  setPrescription,
  setSlotOptional,
} from './programs';
import { plannedSets } from './schema';
import { openTestDatabase, type TestDatabase } from './storage-test-database';
import { expectOk } from './storage-test-support';

function targetsByBlock(program: Program, workoutIndex: number, slotIndex: number): number[][] {
  const slot = program.workouts[workoutIndex]?.slots[slotIndex];
  return (slot?.prescriptions ?? []).map((prescription) =>
    prescription.plannedSets.map((plannedSet) => plannedSet.targetReps),
  );
}

describe('program structure', () => {
  let testDatabase: TestDatabase;
  let profileId: string;
  let inclineBenchId: string;
  const now = new Date('2026-10-02T10:00:00Z');

  beforeAll(async () => {
    testDatabase = await openTestDatabase();
  });

  afterAll(async () => {
    await testDatabase.dispose();
  });

  beforeEach(async () => {
    const { db } = testDatabase;
    profileId = (await ensureProfile(db, crypto.randomUUID(), now)).id;
    inclineBenchId = expectOk(
      await addExercise(db, profileId, { name: 'Incline bench press' }, now),
    ).id;
  });

  async function programWithOneSlot(blockCount: number, targetReps: number[]) {
    const { db } = testDatabase;
    const created = expectOk(
      await createProgram(db, profileId, { name: 'Upper/Lower', blockCount }, now),
    );
    const withWorkout = expectOk(await addWorkout(db, profileId, created.id, { name: 'Upper A' }));
    const workoutId = withWorkout.workouts[0]?.id ?? '';
    const program = expectOk(
      await addExerciseSlot(db, profileId, workoutId, { exerciseId: inclineBenchId, targetReps }),
    );
    return { program, workoutId };
  }

  it('US1 scenario 2: each block returns its own planned sets, numbered from 1, with no last weight', async () => {
    const { db } = testDatabase;
    const { program: initial } = await programWithOneSlot(4, [12, 12, 12]);
    const slot = initial.workouts[0]?.slots[0];
    const blockIds = initial.blocks.map((block) => block.id);
    expectOk(await labelTrainingBlock(db, profileId, blockIds[3] ?? '', { label: 'Deload' }));

    const slotId = slot?.id ?? '';
    expectOk(
      await setPrescription(db, profileId, slotId, blockIds[1] ?? '', { targetReps: [10, 10, 10] }),
    );
    expectOk(
      await setPrescription(db, profileId, slotId, blockIds[2] ?? '', { targetReps: [8, 8, 8] }),
    );
    expectOk(
      await setPrescription(db, profileId, slotId, blockIds[3] ?? '', { targetReps: [10, 10] }),
    );

    const program = expectOk(await getProgram(db, profileId, initial.id));
    expect(program.blocks.map((block) => [block.number, block.label])).toEqual([
      [1, null],
      [2, null],
      [3, null],
      [4, 'Deload'],
    ]);
    expect(targetsByBlock(program, 0, 0)).toEqual([
      [12, 12, 12],
      [10, 10, 10],
      [8, 8, 8],
      [10, 10],
    ]);
    for (const prescription of program.workouts[0]?.slots[0]?.prescriptions ?? []) {
      expect(prescription.plannedSets.map((plannedSet) => plannedSet.setNumber)).toEqual(
        prescription.plannedSets.map((_, index) => index + 1),
      );
      expect(prescription.plannedSets.every((plannedSet) => plannedSet.lastWeightKg === null)).toBe(
        true,
      );
    }
  });

  it('US1 scenario 3: a target that is not a whole number of reps from 1 to 999 is refused and nothing is saved', async () => {
    const { db } = testDatabase;
    const { program, workoutId } = await programWithOneSlot(2, [10]);
    const slotId = program.workouts[0]?.slots[0]?.id ?? '';
    const blockId = program.blocks[0]?.id ?? '';

    for (const invalid of [0, 12.5, 1000, -3]) {
      expect(
        await addExerciseSlot(db, profileId, workoutId, {
          exerciseId: inclineBenchId,
          targetReps: [10, invalid],
        }),
      ).toEqual({ ok: false, error: 'invalid-target' });
      expect(
        await setPrescription(db, profileId, slotId, blockId, { targetReps: [invalid] }),
      ).toEqual({
        ok: false,
        error: 'invalid-target',
      });
    }

    const unchanged = expectOk(await getProgram(db, profileId, program.id));
    expect(unchanged.workouts[0]?.slots).toHaveLength(1);
    expect(targetsByBlock(unchanged, 0, 0)).toEqual([[10], [10]]);
  });

  it('US1 scenario 4, rule 19: a new block copies the last block targets with empty last weight', async () => {
    const { db } = testDatabase;
    const { program: initial } = await programWithOneSlot(2, [12, 12, 12]);
    const slotId = initial.workouts[0]?.slots[0]?.id ?? '';
    expectOk(
      await setPrescription(db, profileId, slotId, initial.blocks[1]?.id ?? '', {
        targetReps: [8, 8],
      }),
    );
    await db
      .update(plannedSets)
      .set({ lastWeightGrams: 50000 })
      .where(eq(plannedSets.exerciseSlotId, slotId));

    const program = expectOk(await addTrainingBlock(db, profileId, initial.id, {}));

    expect(program.blocks.map((block) => block.number)).toEqual([1, 2, 3]);
    expect(targetsByBlock(program, 0, 0)).toEqual([
      [12, 12, 12],
      [8, 8],
      [8, 8],
    ]);
    const prescriptions = program.workouts[0]?.slots[0]?.prescriptions ?? [];
    expect(
      prescriptions[0]?.plannedSets.every((plannedSet) => plannedSet.lastWeightKg === 50),
    ).toBe(true);
    expect(
      prescriptions[2]?.plannedSets.every((plannedSet) => plannedSet.lastWeightKg === null),
    ).toBe(true);
  });

  it('US1 scenario 5, rule 20: marking a slot optional changes only the optional marker', async () => {
    const { db } = testDatabase;
    const { program: before } = await programWithOneSlot(3, [10, 10]);
    const slotId = before.workouts[0]?.slots[0]?.id ?? '';

    const after = expectOk(await setSlotOptional(db, profileId, slotId, { isOptional: true }));

    expect(before.workouts[0]?.slots[0]?.isOptional).toBe(false);
    expect(after.workouts[0]?.slots[0]?.isOptional).toBe(true);
    const slotBefore = before.workouts[0]?.slots[0];
    const slotAfter = after.workouts[0]?.slots[0];
    expect({ ...slotAfter, isOptional: false }).toEqual(slotBefore);
    expect(after.blocks).toEqual(before.blocks);
  });

  it('creates a program with the requested number of unlabeled blocks and no workouts', async () => {
    const { db } = testDatabase;
    const program = expectOk(
      await createProgram(db, profileId, { name: '  5/3/1 ', blockCount: 4 }, now),
    );
    expect(program).toMatchObject({
      name: '5/3/1',
      isActive: false,
      activeCycle: null,
      workouts: [],
    });
    expect(program.blocks.map((block) => [block.number, block.label])).toEqual([
      [1, null],
      [2, null],
      [3, null],
      [4, null],
    ]);
  });

  it('refuses a program with no blocks or no name', async () => {
    const { db } = testDatabase;
    expect(await createProgram(db, profileId, { name: 'Empty', blockCount: 0 }, now)).toEqual({
      ok: false,
      error: 'invalid-block-count',
    });
    expect(await createProgram(db, profileId, { name: ' ', blockCount: 2 }, now)).toEqual({
      ok: false,
      error: 'name-required',
    });
  });

  it('refuses an archived exercise and a slot with no planned sets', async () => {
    const { db } = testDatabase;
    const created = expectOk(await createProgram(db, profileId, { name: 'P', blockCount: 2 }, now));
    const workoutId =
      expectOk(await addWorkout(db, profileId, created.id, { name: 'A' })).workouts[0]?.id ?? '';
    const archived = expectOk(await addExercise(db, profileId, { name: 'Old lift' }, now));
    expectOk(await archiveExercise(db, profileId, archived.id, now));

    expect(
      await addExerciseSlot(db, profileId, workoutId, {
        exerciseId: archived.id,
        targetReps: [10],
      }),
    ).toEqual({
      ok: false,
      error: 'exercise-archived',
    });
    expect(
      await addExerciseSlot(db, profileId, workoutId, {
        exerciseId: inclineBenchId,
        targetReps: [],
      }),
    ).toEqual({
      ok: false,
      error: 'prescription-needs-a-set',
    });
    expect(expectOk(await getProgram(db, profileId, created.id)).workouts[0]?.slots).toEqual([]);
  });

  it('keeps the planned sets that still exist when a prescription changes', async () => {
    const { db } = testDatabase;
    const { program: initial } = await programWithOneSlot(2, [10, 10, 10]);
    const slot = initial.workouts[0]?.slots[0];
    const blockId = initial.blocks[0]?.id ?? '';
    await db
      .update(plannedSets)
      .set({ lastWeightGrams: 40000 })
      .where(eq(plannedSets.exerciseSlotId, slot?.id ?? ''));

    const program = expectOk(
      await setPrescription(db, profileId, slot?.id ?? '', blockId, { targetReps: [12, 12] }),
    );

    const sets = program.workouts[0]?.slots[0]?.prescriptions[0]?.plannedSets ?? [];
    expect(
      sets.map((plannedSet) => [
        plannedSet.setNumber,
        plannedSet.targetReps,
        plannedSet.lastWeightKg,
      ]),
    ).toEqual([
      [1, 12, 40],
      [2, 12, 40],
    ]);
  });

  it('moves workouts, slots and blocks, renumbering positions 1 to n without gaps', async () => {
    const { db } = testDatabase;
    const { program: first, workoutId: upperId } = await programWithOneSlot(3, [10]);
    const lowerId =
      expectOk(await addWorkout(db, profileId, first.id, { name: 'Lower A' })).workouts[1]?.id ??
      '';
    const pushId =
      expectOk(await addWorkout(db, profileId, first.id, { name: 'Push' })).workouts[2]?.id ?? '';

    const reordered = expectOk(await moveWorkout(db, profileId, pushId, { toPosition: 1 }));
    expect(reordered.workouts.map((workout) => workout.name)).toEqual([
      'Push',
      'Upper A',
      'Lower A',
    ]);

    expectOk(
      await addExerciseSlot(db, profileId, upperId, {
        exerciseId: inclineBenchId,
        targetReps: [8],
      }),
    );
    const withTwoSlots = expectOk(await getProgram(db, profileId, first.id));
    const secondSlotId = withTwoSlots.workouts[1]?.slots[1]?.id ?? '';
    const slotsMoved = expectOk(
      await moveExerciseSlot(db, profileId, secondSlotId, { toPosition: 1 }),
    );
    expect(slotsMoved.workouts[1]?.slots.map((slot) => slot.id)).toEqual([
      secondSlotId,
      withTwoSlots.workouts[1]?.slots[0]?.id,
    ]);

    const lastBlockId = first.blocks[2]?.id ?? '';
    expectOk(await labelTrainingBlock(db, profileId, lastBlockId, { label: 'Deload' }));
    const blocksMoved = expectOk(
      await moveTrainingBlock(db, profileId, lastBlockId, { toPosition: 1 }),
    );
    expect(blocksMoved.blocks.map((block) => [block.number, block.label])).toEqual([
      [1, 'Deload'],
      [2, null],
      [3, null],
    ]);
    expect(lowerId).not.toBe('');
  });

  it('refuses a move to a position that does not exist', async () => {
    const { db } = testDatabase;
    const { program, workoutId } = await programWithOneSlot(2, [10]);
    expect(await moveWorkout(db, profileId, workoutId, { toPosition: 0 })).toEqual({
      ok: false,
      error: 'invalid-position',
    });
    expect(await moveWorkout(db, profileId, workoutId, { toPosition: 2 })).toEqual({
      ok: false,
      error: 'invalid-position',
    });
    expect(
      await moveTrainingBlock(db, profileId, program.blocks[0]?.id ?? '', { toPosition: 3 }),
    ).toEqual({
      ok: false,
      error: 'invalid-position',
    });
  });
});
