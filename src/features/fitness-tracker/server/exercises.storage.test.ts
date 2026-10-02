import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  addExercise,
  archiveExercise,
  listExercises,
  renameExercise,
  unarchiveExercise,
} from './exercises';
import { ensureProfile } from './profile';
import { expectOk } from './storage-test-support';
import { openTestDatabase, type TestDatabase } from './storage-test-database';

describe('exercise catalog', () => {
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

  it('US1 scenario 1: adds an exercise and refuses the same name in another case or spacing', async () => {
    const { db } = testDatabase;
    const added = expectOk(await addExercise(db, profileId, { name: 'Incline bench press' }, now));
    expect(added).toMatchObject({ name: 'Incline bench press', isArchived: false });

    expect(await listExercises(db, profileId, { includeArchived: false })).toEqual([added]);

    const duplicate = await addExercise(db, profileId, { name: '  incline BENCH press ' }, now);
    expect(duplicate).toEqual({ ok: false, error: 'name-taken' });
    expect(await listExercises(db, profileId, { includeArchived: false })).toHaveLength(1);
  });

  it('allows the same name in different profiles', async () => {
    const { db } = testDatabase;
    const otherProfileId = (await ensureProfile(db, crypto.randomUUID(), now)).id;
    expectOk(await addExercise(db, profileId, { name: 'Squat' }, now));
    expectOk(await addExercise(db, otherProfileId, { name: 'Squat' }, now));
  });

  it('refuses an empty name and a name that is too long', async () => {
    const { db } = testDatabase;
    expect(await addExercise(db, profileId, { name: '   ' }, now)).toEqual({
      ok: false,
      error: 'name-required',
    });
    expect(await addExercise(db, profileId, { name: 'a'.repeat(101) }, now)).toEqual({
      ok: false,
      error: 'name-too-long',
    });
    expect(await listExercises(db, profileId, { includeArchived: true })).toEqual([]);
  });

  it('renames an exercise, refuses a name already taken, and allows a change of case', async () => {
    const { db } = testDatabase;
    const squat = expectOk(await addExercise(db, profileId, { name: 'squat' }, now));
    expectOk(await addExercise(db, profileId, { name: 'Deadlift' }, now));

    expect(await renameExercise(db, profileId, squat.id, { name: 'DEADLIFT' })).toEqual({
      ok: false,
      error: 'name-taken',
    });
    expect(expectOk(await renameExercise(db, profileId, squat.id, { name: 'Squat' })).name).toBe(
      'Squat',
    );
    expect(await renameExercise(db, profileId, 'missing', { name: 'Anything' })).toEqual({
      ok: false,
      error: 'not-found',
    });
  });

  it('archives and unarchives, hiding archived exercises unless asked for', async () => {
    const { db } = testDatabase;
    const press = expectOk(await addExercise(db, profileId, { name: 'Press' }, now));
    expectOk(await addExercise(db, profileId, { name: 'Row' }, now));

    const archived = expectOk(await archiveExercise(db, profileId, press.id, now));
    expect(archived.isArchived).toBe(true);
    expect(
      (await listExercises(db, profileId, { includeArchived: false })).map((item) => item.name),
    ).toEqual(['Row']);
    expect(
      (await listExercises(db, profileId, { includeArchived: true })).map((item) => item.name),
    ).toEqual(['Press', 'Row']);

    expect(expectOk(await unarchiveExercise(db, profileId, press.id)).isArchived).toBe(false);
  });

  it('lists exercises by name regardless of case', async () => {
    const { db } = testDatabase;
    for (const name of ['squat', 'Bench', 'deadlift']) {
      expectOk(await addExercise(db, profileId, { name }, now));
    }
    expect(
      (await listExercises(db, profileId, { includeArchived: false })).map((item) => item.name),
    ).toEqual(['Bench', 'deadlift', 'squat']);
  });
});
