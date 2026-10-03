import 'server-only';
import type { Database } from '@/lib/server/database';
import { getDatabase } from '@/lib/server/database';
import { getSession } from '@/lib/server/session-cookie';
import { authorize, errorResponse } from './http';
import { ensureProfile } from './profile';

export type FitnessRequestContext = {
  db: Database;
  profileId: string;
  now: Date;
  request: Request;
  params: Record<string, string>;
};

export type FitnessHandler = (context: FitnessRequestContext) => Promise<Response>;

type RouteParams = { params: Promise<Record<string, string>> };

export function fitnessRoute(
  handle: FitnessHandler,
): (request: Request, routeParams: RouteParams) => Promise<Response> {
  return async (request, routeParams) => {
    try {
      const authorization = authorize(await getSession());
      if (!authorization.ok) {
        return authorization.response;
      }
      const db = getDatabase();
      const now = new Date();
      const profile = await ensureProfile(db, authorization.session.sub, now);
      return await handle({
        db,
        profileId: profile.id,
        now,
        request,
        params: await routeParams.params,
      });
    } catch (error) {
      console.error(error);
      return errorResponse('unexpected');
    }
  };
}
