import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openTestDatabase, type TestDatabase } from './storage-test-database';

const expectedTables = [
  'bodyweight_entries',
  'cycles',
  'exercise_slots',
  'exercises',
  'planned_sets',
  'profiles',
  'programs',
  'set_logs',
  'training_blocks',
  'workout_sessions',
  'workouts',
];

const expectedTriggers = ['set_logs_no_delete', 'set_logs_no_update'];

describe('storage harness', () => {
  let testDatabase: TestDatabase;

  beforeAll(async () => {
    testDatabase = await openTestDatabase();
  });

  afterAll(async () => {
    await testDatabase.dispose();
  });

  it('opens a local D1 with every migration applied', async () => {
    const rows = await testDatabase.db.all<{ type: string; name: string }>(
      sql`SELECT type, name FROM sqlite_master WHERE type IN ('table', 'trigger') ORDER BY name`,
    );
    const names = (type: string) => rows.filter((row) => row.type === type).map((row) => row.name);

    expect(names('table')).toEqual(expect.arrayContaining(expectedTables));
    expect(names('trigger')).toEqual(expectedTriggers);
  });
});
