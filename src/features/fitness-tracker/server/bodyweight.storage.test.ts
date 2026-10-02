import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getWeighInStatus, listBodyweight, recordBodyweight } from './bodyweight';
import { ensureProfile } from './profile';
import { openTestDatabase, type TestDatabase } from './storage-test-database';
import { expectOk } from './storage-test-support';

describe('bodyweight', () => {
  let testDatabase: TestDatabase;
  let profileId: string;
  const stockholm = 'Europe/Stockholm';
  const morning = new Date('2026-10-02T06:00:00Z');

  beforeAll(async () => {
    testDatabase = await openTestDatabase();
  });

  afterAll(async () => {
    await testDatabase.dispose();
  });

  beforeEach(async () => {
    profileId = (await ensureProfile(testDatabase.db, crypto.randomUUID(), morning)).id;
  });

  it('US5 scenario 1, rule 22: a weigh-in is available when none is recorded today', async () => {
    const { db } = testDatabase;

    expect(expectOk(await getWeighInStatus(db, profileId, morning, stockholm))).toEqual({
      isAvailable: true,
      today: '2026-10-02',
    });
  });

  it('US5 scenario 2, rules 21 and 22: after recording, no further weigh-in is available today', async () => {
    const { db } = testDatabase;

    const entry = expectOk(
      await recordBodyweight(db, profileId, { weightKg: 82.5 }, morning, stockholm),
    );

    expect(entry).toMatchObject({ date: '2026-10-02', weightKg: 82.5 });
    expect(expectOk(await getWeighInStatus(db, profileId, morning, stockholm)).isAvailable).toBe(
      false,
    );
    expect(await recordBodyweight(db, profileId, { weightKg: 83 }, morning, stockholm)).toEqual({
      ok: false,
      error: 'already-weighed-in-today',
    });
    expect((await listBodyweight(db, profileId)).map((item) => item.weightKg)).toEqual([82.5]);
  });

  it('US5 scenario 3: a weigh-in at 23:30 local time does not block one at 00:10 the next day', async () => {
    const { db } = testDatabase;
    const lateEvening = new Date('2026-10-02T21:30:00Z');
    const justAfterMidnight = new Date('2026-10-02T22:10:00Z');
    expectOk(await recordBodyweight(db, profileId, { weightKg: 82 }, lateEvening, stockholm));

    expect(expectOk(await getWeighInStatus(db, profileId, justAfterMidnight, stockholm))).toEqual({
      isAvailable: true,
      today: '2026-10-03',
    });
    expect(
      expectOk(
        await recordBodyweight(db, profileId, { weightKg: 82.4 }, justAfterMidnight, stockholm),
      ),
    ).toMatchObject({
      date: '2026-10-03',
    });
  });

  it('decides the day by the time zone, so the same instant is a different day elsewhere', async () => {
    const { db } = testDatabase;
    const instant = new Date('2026-10-02T22:10:00Z');
    expectOk(await recordBodyweight(db, profileId, { weightKg: 80 }, instant, 'UTC'));

    expect(expectOk(await getWeighInStatus(db, profileId, instant, stockholm)).isAvailable).toBe(
      true,
    );
    expect(expectOk(await getWeighInStatus(db, profileId, instant, 'UTC')).isAvailable).toBe(false);
  });

  it('refuses an unknown time zone and a weight that is not positive, saving nothing', async () => {
    const { db } = testDatabase;

    expect(await getWeighInStatus(db, profileId, morning, 'Mars/Olympus')).toEqual({
      ok: false,
      error: 'invalid-time-zone',
    });
    expect(
      await recordBodyweight(db, profileId, { weightKg: 80 }, morning, 'Mars/Olympus'),
    ).toEqual({
      ok: false,
      error: 'invalid-time-zone',
    });
    expect(await recordBodyweight(db, profileId, { weightKg: 0 }, morning, stockholm)).toEqual({
      ok: false,
      error: 'invalid-weight',
    });
    expect(await listBodyweight(db, profileId)).toEqual([]);
  });

  it('lists entries by date and keeps profiles apart', async () => {
    const { db } = testDatabase;
    const otherProfileId = (await ensureProfile(db, crypto.randomUUID(), morning)).id;
    const days = ['2026-10-04T06:00:00Z', '2026-10-02T06:00:00Z', '2026-10-03T06:00:00Z'];
    for (const [index, day] of days.entries()) {
      expectOk(
        await recordBodyweight(db, profileId, { weightKg: 80 + index }, new Date(day), stockholm),
      );
    }
    expectOk(await recordBodyweight(db, otherProfileId, { weightKg: 99 }, morning, stockholm));

    expect((await listBodyweight(db, profileId)).map((item) => [item.date, item.weightKg])).toEqual(
      [
        ['2026-10-02', 81],
        ['2026-10-03', 82],
        ['2026-10-04', 80],
      ],
    );
    expect(await listBodyweight(db, otherProfileId)).toHaveLength(1);
  });
});
