import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Program } from '../../domain/types';
import { activateProgram } from '../activation';
import { addExercise, archiveExercise } from '../exercises';
import { ensureProfile } from '../profile';
import { addWorkout, createProgram, getProgram } from '../programs';
import { openTestDatabase, type TestDatabase } from '../storage-test-database';
import { createProgramFromSpec, expectOk } from '../storage-test-support';
import { logSet, startWorkout } from '../training';
import { handlerContext, jsonOf } from './handler-test-support';
import { handleAddSlot, handleRemoveSlot, handleSetPrescription, handleUpdateSlot } from './slots';

describe('exercise slot handlers', () => {
  let testDatabase: TestDatabase;
  let profileId: string;
  const now = new Date('2026-10-03T08:00:00Z');

  beforeAll(async () => {
    testDatabase = await openTestDatabase();
  });

  afterAll(async () => {
    await testDatabase.dispose();
  });

  beforeEach(async () => {
    profileId = (await ensureProfile(testDatabase.db, crypto.randomUUID(), now)).id;
  });

  function context(input: { body?: unknown; params?: Record<string, string> }) {
    return handlerContext({ db: testDatabase.db, profileId, now, ...input });
  }

  async function reload(program: Program): Promise<Program> {
    return expectOk(await getProgram(testDatabase.db, profileId, program.id));
  }

  async function exerciseId(name: string): Promise<string> {
    return expectOk(await addExercise(testDatabase.db, profileId, { name }, now)).id;
  }

  async function emptyWorkout(
    blockCount: number,
  ): Promise<{ program: Program; workoutId: string }> {
    const { db } = testDatabase;
    const created = expectOk(await createProgram(db, profileId, { name: 'P', blockCount }, now));
    const program = expectOk(await addWorkout(db, profileId, created.id, { name: 'Day 1' }));
    return { program, workoutId: program.workouts[0]?.id ?? '' };
  }

  async function withOneSlot(): Promise<Program> {
    return createProgramFromSpec(
      testDatabase.db,
      profileId,
      {
        blockCount: 2,
        workouts: [{ name: 'Day 1', slots: [{ exercise: 'Press', targetReps: [10, 10, 10] }] }],
      },
      now,
    );
  }

  describe('adding a slot', () => {
    it('US3 scenario 3, FR-028: creates the planned sets in every block from sets × reps', async () => {
      const { program, workoutId } = await emptyWorkout(3);
      const id = await exerciseId('Incline bench press');

      const response = await handleAddSlot(
        context({ body: { exerciseId: id, sets: 3, reps: 10 }, params: { id: workoutId } }),
      );

      expect(response.status).toBe(200);
      const edited = await reload(program);
      const slot = edited.workouts[0]?.slots[0];
      expect(slot?.prescriptions).toHaveLength(3);
      for (const prescription of slot?.prescriptions ?? []) {
        expect(prescription.plannedSets.map((set) => set.targetReps)).toEqual([10, 10, 10]);
      }
      expect(await jsonOf(response)).toEqual({ id: slot?.id });
    });

    it('FR-015: answers 400 prescription-needs-a-set for no sets', async () => {
      const { workoutId } = await emptyWorkout(2);

      const response = await handleAddSlot(
        context({
          body: { exerciseId: await exerciseId('Row'), sets: 0, reps: 10 },
          params: { id: workoutId },
        }),
      );

      expect(response.status).toBe(400);
      expect(await jsonOf(response)).toEqual({ error: 'prescription-needs-a-set' });
    });

    it('answers 400 invalid-target for reps above 999', async () => {
      const { workoutId } = await emptyWorkout(2);

      const response = await handleAddSlot(
        context({
          body: { exerciseId: await exerciseId('Row'), sets: 3, reps: 1000 },
          params: { id: workoutId },
        }),
      );

      expect(response.status).toBe(400);
      expect(await jsonOf(response)).toEqual({ error: 'invalid-target' });
    });

    it('FR-037: answers 409 exercise-archived for an archived exercise', async () => {
      const { workoutId } = await emptyWorkout(2);
      const id = await exerciseId('Old');
      expectOk(await archiveExercise(testDatabase.db, profileId, id, now));

      const response = await handleAddSlot(
        context({ body: { exerciseId: id, sets: 3, reps: 10 }, params: { id: workoutId } }),
      );

      expect(response.status).toBe(409);
      expect(await jsonOf(response)).toEqual({ error: 'exercise-archived' });
    });

    it('answers 409 exercise-already-in-workout for an exercise the workout has', async () => {
      const program = await withOneSlot();
      const workout = program.workouts[0];

      const response = await handleAddSlot(
        context({
          body: { exerciseId: workout?.slots[0]?.exercise.id, sets: 3, reps: 10 },
          params: { id: workout?.id ?? '' },
        }),
      );

      expect(response.status).toBe(409);
      expect(await jsonOf(response)).toEqual({ error: 'exercise-already-in-workout' });
      expect((await reload(program)).workouts[0]?.slots).toHaveLength(1);
    });

    it('answers 404 for an exercise that does not exist', async () => {
      const { workoutId } = await emptyWorkout(2);

      const response = await handleAddSlot(
        context({
          body: { exerciseId: crypto.randomUUID(), sets: 3, reps: 10 },
          params: { id: workoutId },
        }),
      );

      expect(response.status).toBe(404);
    });

    it('answers 400 invalid-body when sets is not a number', async () => {
      const { workoutId } = await emptyWorkout(2);

      const response = await handleAddSlot(
        context({
          body: { exerciseId: await exerciseId('Row'), sets: '3', reps: 10 },
          params: { id: workoutId },
        }),
      );

      expect(response.status).toBe(400);
      expect(await jsonOf(response)).toEqual({ error: 'invalid-body' });
    });
  });

  describe('updating and removing a slot', () => {
    async function loggedProgram() {
      const { db } = testDatabase;
      const program = await withOneSlot();
      expectOk(await activateProgram(db, profileId, program.id, now));
      const session = expectOk(
        await startWorkout(db, profileId, program.workouts[0]?.id ?? '', now),
      );
      expectOk(
        await logSet(
          db,
          profileId,
          session.id,
          session.slots[0]?.plannedSets[0]?.id ?? '',
          { reps: 10, weightKg: 40 },
          now,
        ),
      );
      return program;
    }

    it('FR-031: replacing the exercise clears the slot last weights', async () => {
      const program = await loggedProgram();
      const slotId = program.workouts[0]?.slots[0]?.id ?? '';
      const replacement = await exerciseId('Machine press');

      const response = await handleUpdateSlot(
        context({ body: { exerciseId: replacement }, params: { id: slotId } }),
      );

      expect(response.status).toBe(200);
      const slot = (await reload(program)).workouts[0]?.slots[0];
      expect(slot?.exercise.name).toBe('Machine press');
      expect(
        slot?.prescriptions.flatMap((prescription) =>
          prescription.plannedSets.map((set) => set.lastWeightKg),
        ),
      ).toEqual([null, null, null, null, null, null]);
    });

    it('US3 scenario 6: marks a slot optional', async () => {
      const program = await withOneSlot();

      await handleUpdateSlot(
        context({
          body: { isOptional: true },
          params: { id: program.workouts[0]?.slots[0]?.id ?? '' },
        }),
      );

      expect((await reload(program)).workouts[0]?.slots[0]?.isOptional).toBe(true);
    });

    it('moves a slot to a position and refuses one that does not exist', async () => {
      const { db } = testDatabase;
      const program = await createProgramFromSpec(
        db,
        profileId,
        {
          blockCount: 1,
          workouts: [
            {
              name: 'Day 1',
              slots: [
                { exercise: 'First', targetReps: [5] },
                { exercise: 'Second', targetReps: [5] },
              ],
            },
          ],
        },
        now,
      );
      const first = program.workouts[0]?.slots[0]?.id ?? '';

      const moved = await handleUpdateSlot(
        context({ body: { toPosition: 2 }, params: { id: first } }),
      );
      const refused = await handleUpdateSlot(
        context({ body: { toPosition: 7 }, params: { id: first } }),
      );

      expect(moved.status).toBe(200);
      expect((await reload(program)).workouts[0]?.slots.map((slot) => slot.exercise.name)).toEqual([
        'Second',
        'First',
      ]);
      expect(refused.status).toBe(400);
      expect(await jsonOf(refused)).toEqual({ error: 'invalid-position' });
    });

    it('answers 400 invalid-body when nothing to change is given', async () => {
      const program = await withOneSlot();

      const response = await handleUpdateSlot(
        context({ body: {}, params: { id: program.workouts[0]?.slots[0]?.id ?? '' } }),
      );

      expect(response.status).toBe(400);
    });

    it('removes a slot', async () => {
      const program = await withOneSlot();

      const response = await handleRemoveSlot(
        context({ params: { id: program.workouts[0]?.slots[0]?.id ?? '' } }),
      );

      expect(response.status).toBe(200);
      expect((await reload(program)).workouts[0]?.slots).toEqual([]);
    });

    it('answers 404 for a slot of another profile', async () => {
      const program = await withOneSlot();
      const otherProfileId = (await ensureProfile(testDatabase.db, crypto.randomUUID(), now)).id;

      const response = await handleRemoveSlot(
        handlerContext({
          db: testDatabase.db,
          profileId: otherProfileId,
          now,
          params: { id: program.workouts[0]?.slots[0]?.id ?? '' },
        }),
      );

      expect(response.status).toBe(404);
    });
  });

  describe('setting a prescription', () => {
    it('FR-029, spec R1: changes the targets and keeps the last weights of the sets that remain', async () => {
      const { db } = testDatabase;
      const program = await withOneSlot();
      expectOk(await activateProgram(db, profileId, program.id, now));
      const session = expectOk(
        await startWorkout(db, profileId, program.workouts[0]?.id ?? '', now),
      );
      expectOk(
        await logSet(
          db,
          profileId,
          session.id,
          session.slots[0]?.plannedSets[0]?.id ?? '',
          { reps: 10, weightKg: 40 },
          now,
        ),
      );
      const slotId = program.workouts[0]?.slots[0]?.id ?? '';
      const blockId = program.blocks[0]?.id ?? '';

      const response = await handleSetPrescription(
        context({ body: { targetReps: [12, 12] }, params: { id: slotId, blockId } }),
      );

      expect(response.status).toBe(200);
      const sets = (await reload(program)).workouts[0]?.slots[0]?.prescriptions[0]?.plannedSets;
      expect(sets?.map((set) => [set.targetReps, set.lastWeightKg])).toEqual([
        [12, 40],
        [12, null],
      ]);
    });

    it('FR-015: answers 400 prescription-needs-a-set for an empty list', async () => {
      const program = await withOneSlot();

      const response = await handleSetPrescription(
        context({
          body: { targetReps: [] },
          params: {
            id: program.workouts[0]?.slots[0]?.id ?? '',
            blockId: program.blocks[0]?.id ?? '',
          },
        }),
      );

      expect(response.status).toBe(400);
      expect(await jsonOf(response)).toEqual({ error: 'prescription-needs-a-set' });
    });

    it('answers 400 invalid-target for reps of zero', async () => {
      const program = await withOneSlot();

      const response = await handleSetPrescription(
        context({
          body: { targetReps: [10, 0] },
          params: {
            id: program.workouts[0]?.slots[0]?.id ?? '',
            blockId: program.blocks[0]?.id ?? '',
          },
        }),
      );

      expect(await jsonOf(response)).toEqual({ error: 'invalid-target' });
    });

    it('answers 404 for a block of another program', async () => {
      const program = await withOneSlot();
      const other = await withOneSlot();

      const response = await handleSetPrescription(
        context({
          body: { targetReps: [10] },
          params: {
            id: program.workouts[0]?.slots[0]?.id ?? '',
            blockId: other.blocks[0]?.id ?? '',
          },
        }),
      );

      expect(response.status).toBe(404);
    });
  });

  describe('periodization', () => {
    async function withSlot(isPeriodized: boolean): Promise<{ program: Program; slotId: string }> {
      const program = await createProgramFromSpec(
        testDatabase.db,
        profileId,
        {
          blockCount: 2,
          workouts: [
            { name: 'Day 1', slots: [{ exercise: 'Curl', targetReps: [12, 12], isPeriodized }] },
          ],
        },
        now,
      );
      return { program, slotId: program.workouts[0]?.slots[0]?.id ?? '' };
    }

    function targetsOf(program: Program): number[][] {
      return (
        program.workouts[0]?.slots[0]?.prescriptions.map((prescription) =>
          prescription.plannedSets.map((set) => set.targetReps),
        ) ?? []
      );
    }

    it('adds a slot as non-periodized unless asked otherwise', async () => {
      const { program, workoutId } = await emptyWorkout(2);

      await handleAddSlot(
        context({
          body: { exerciseId: await exerciseId('Curl'), sets: 3, reps: 12 },
          params: { id: workoutId },
        }),
      );
      await handleAddSlot(
        context({
          body: { exerciseId: await exerciseId('Squat'), sets: 5, reps: 5, isPeriodized: true },
          params: { id: workoutId },
        }),
      );

      expect((await reload(program)).workouts[0]?.slots.map((slot) => slot.isPeriodized)).toEqual([
        false,
        true,
      ]);
    });

    it('turns periodization off with one sets × reps for every block', async () => {
      const { program, slotId } = await withSlot(true);

      const response = await handleUpdateSlot(
        context({ body: { isPeriodized: false, sets: 3, reps: 8 }, params: { id: slotId } }),
      );

      expect(response.status).toBe(200);
      const edited = await reload(program);
      expect(edited.workouts[0]?.slots[0]?.isPeriodized).toBe(false);
      expect(targetsOf(edited)).toEqual([
        [8, 8, 8],
        [8, 8, 8],
      ]);
    });

    it('turns periodization on', async () => {
      const { program, slotId } = await withSlot(false);

      const response = await handleUpdateSlot(
        context({ body: { isPeriodized: true }, params: { id: slotId } }),
      );

      expect(response.status).toBe(200);
      expect((await reload(program)).workouts[0]?.slots[0]?.isPeriodized).toBe(true);
    });

    it('answers 400 invalid-body when turning periodization off without sets and reps', async () => {
      const { slotId } = await withSlot(true);

      const response = await handleUpdateSlot(
        context({ body: { isPeriodized: false }, params: { id: slotId } }),
      );

      expect(response.status).toBe(400);
      expect(await jsonOf(response)).toEqual({ error: 'invalid-body' });
    });

    it('sets the one scheme of a non-periodized slot in every block', async () => {
      const { program, slotId } = await withSlot(false);

      const response = await handleUpdateSlot(
        context({ body: { sets: 4, reps: 10 }, params: { id: slotId } }),
      );

      expect(response.status).toBe(200);
      expect(targetsOf(await reload(program))).toEqual([
        [10, 10, 10, 10],
        [10, 10, 10, 10],
      ]);
    });

    it('answers 409 slot-periodized for one scheme on a periodized slot', async () => {
      const { slotId } = await withSlot(true);

      const response = await handleUpdateSlot(
        context({ body: { sets: 4, reps: 10 }, params: { id: slotId } }),
      );

      expect(response.status).toBe(409);
      expect(await jsonOf(response)).toEqual({ error: 'slot-periodized' });
    });

    it('answers 409 slot-not-periodized for a block prescription on a non-periodized slot', async () => {
      const { program, slotId } = await withSlot(false);

      const response = await handleSetPrescription(
        context({
          body: { targetReps: [10] },
          params: { id: slotId, blockId: program.blocks[1]?.id ?? '' },
        }),
      );

      expect(response.status).toBe(409);
      expect(await jsonOf(response)).toEqual({ error: 'slot-not-periodized' });
    });
  });
});
