import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ensureProfile } from './profile';
import { openTestDatabase, type TestDatabase } from './storage-test-database';

describe('ensureProfile', () => {
  let testDatabase: TestDatabase;

  beforeAll(async () => {
    testDatabase = await openTestDatabase();
  });

  afterAll(async () => {
    await testDatabase.dispose();
  });

  it('creates a profile the first time an account needs one', async () => {
    const profile = await ensureProfile(testDatabase.db, crypto.randomUUID(), new Date());
    expect(profile.id).not.toBe('');
  });

  it('returns the same profile when called again for the same account', async () => {
    const subject = crypto.randomUUID();
    const first = await ensureProfile(testDatabase.db, subject, new Date());
    const second = await ensureProfile(testDatabase.db, subject, new Date());
    expect(second.id).toBe(first.id);
  });

  it('gives different accounts different profiles', async () => {
    const first = await ensureProfile(testDatabase.db, crypto.randomUUID(), new Date());
    const second = await ensureProfile(testDatabase.db, crypto.randomUUID(), new Date());
    expect(second.id).not.toBe(first.id);
  });
});
