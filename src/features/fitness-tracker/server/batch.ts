import 'server-only';
import type { BatchItem } from 'drizzle-orm/batch';
import type { Database } from '@/lib/server/database';

const maxBoundParameters = 100;

export type Statement = BatchItem<'sqlite'>;

export async function runBatch(db: Database, statements: Statement[]): Promise<void> {
  const [first, ...rest] = statements;
  if (first === undefined) {
    return;
  }
  await db.batch([first, ...rest]);
}

export function chunkRows<T>(rows: readonly T[], columnCount: number): T[][] {
  const rowsPerStatement = Math.max(1, Math.floor(maxBoundParameters / columnCount));
  const chunks: T[][] = [];
  for (let start = 0; start < rows.length; start += rowsPerStatement) {
    chunks.push(rows.slice(start, start + rowsPerStatement));
  }
  return chunks;
}

export function chunkIds(ids: readonly string[]): string[][] {
  return chunkRows(ids, 1);
}

export function isUniqueConstraintViolation(error: unknown): boolean {
  let current: unknown = error;
  while (current instanceof Error) {
    if (current.message.includes('UNIQUE constraint failed')) {
      return true;
    }
    current = current.cause;
  }
  return false;
}
