import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ensureProfile } from '../profile';
import { openTestDatabase, type TestDatabase } from '../storage-test-database';
import { handlerContext, jsonOf } from './handler-test-support';
import { handleRecordBodyweight } from './bodyweight';

describe('POST /api/fitness/bodyweight', () => {
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

  function post(body: unknown) {
    return handleRecordBodyweight(handlerContext({ db: testDatabase.db, profileId, now, body }));
  }

  it('US2 scenario 2: records the weight for today in the device time zone', async () => {
    const response = await post({ weightKg: 74.2, timeZone: 'Europe/Stockholm' });

    expect(response.status).toBe(200);
    expect(await jsonOf(response)).toMatchObject({ date: '2026-10-03', weightKg: 74.2 });
  });

  it('answers 409 already-weighed-in-today on the second weigh-in of the day', async () => {
    await post({ weightKg: 74.2, timeZone: 'UTC' });

    const response = await post({ weightKg: 74.0, timeZone: 'UTC' });

    expect(response.status).toBe(409);
    expect(await jsonOf(response)).toEqual({ error: 'already-weighed-in-today' });
  });

  it('answers 400 invalid-weight for a weight of zero', async () => {
    const response = await post({ weightKg: 0, timeZone: 'UTC' });

    expect(response.status).toBe(400);
    expect(await jsonOf(response)).toEqual({ error: 'invalid-weight' });
  });

  it('answers 400 invalid-time-zone for an unknown time zone', async () => {
    const response = await post({ weightKg: 74, timeZone: 'Mars/Olympus' });

    expect(response.status).toBe(400);
    expect(await jsonOf(response)).toEqual({ error: 'invalid-time-zone' });
  });

  it.each([
    ['no time zone', { weightKg: 74 }],
    ['no weight', { timeZone: 'UTC' }],
    ['a text weight', { weightKg: '74', timeZone: 'UTC' }],
  ])('answers 400 invalid-body with %s', async (_label, body) => {
    const response = await post(body);

    expect(response.status).toBe(400);
    expect(await jsonOf(response)).toEqual({ error: 'invalid-body' });
  });

  it('answers 400 invalid-body when the body is not JSON', async () => {
    const response = await handleRecordBodyweight(
      handlerContext({ db: testDatabase.db, profileId, now, rawBody: 'nope' }),
    );

    expect(response.status).toBe(400);
  });
});
