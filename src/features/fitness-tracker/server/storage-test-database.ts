import { getPlatformProxy } from 'wrangler';
import { createDatabase, type Database } from '@/lib/server/database';

export type TestDatabase = {
  db: Database;
  dispose: () => Promise<void>;
};

type SharedConnection = { db: Database; close: () => Promise<void> };

let shared: Promise<SharedConnection> | undefined;

async function openShared(): Promise<SharedConnection> {
  const proxy = await getPlatformProxy<{ DB: unknown }>({
    persist: { path: '.wrangler/test-state/v3' },
  });
  const close = async () => {
    shared = undefined;
    await proxy.dispose();
  };
  process.once('beforeExit', () => {
    void close();
  });
  return { db: createDatabase(proxy.env.DB), close };
}

export async function openTestDatabase(): Promise<TestDatabase> {
  shared ??= openShared();
  const connection = await shared;
  return { db: connection.db, dispose: () => Promise.resolve() };
}
