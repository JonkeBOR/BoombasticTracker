import type { Database } from '@/lib/server/database';
import type { FitnessRequestContext } from '../fitness-route';

export function handlerContext(input: {
  db: Database;
  profileId: string;
  now: Date;
  body?: unknown;
  rawBody?: string;
  params?: Record<string, string>;
}): FitnessRequestContext {
  const rawBody =
    input.rawBody ?? (input.body === undefined ? undefined : JSON.stringify(input.body));
  return {
    db: input.db,
    profileId: input.profileId,
    now: input.now,
    request: new Request('https://app.example.com/api/fitness/test', {
      method: 'POST',
      body: rawBody,
    }),
    params: input.params ?? {},
  };
}

export async function jsonOf(response: Response): Promise<unknown> {
  const parsed: unknown = await response.json();
  return parsed;
}
