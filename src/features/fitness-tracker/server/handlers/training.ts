import 'server-only';
import { isPlannedSetLogged } from '../../domain/logging';
import { fail } from '../../domain/result';
import type { FitnessRequestContext } from '../fitness-route';
import {
  readJson,
  readNullableNumber,
  readNumber,
  readString,
  respond,
  respondWith,
} from '../http';
import { finishWorkout, getSession, logSet, startWorkout } from '../training';

export async function handleStartSession({
  db,
  profileId,
  now,
  params,
}: FitnessRequestContext): Promise<Response> {
  return respondWith(await startWorkout(db, profileId, params.id ?? '', now), (session) => ({
    sessionId: session.id,
  }));
}

export async function handleLogSet({
  db,
  profileId,
  now,
  request,
  params,
}: FitnessRequestContext): Promise<Response> {
  const body = await readJson(request);
  if (!body.ok) {
    return respond(body);
  }
  const plannedSetId = readString(body.value, 'plannedSetId');
  const reps = readNumber(body.value, 'reps');
  const weightKg = readNullableNumber(body.value, 'weightKg');
  if (!plannedSetId.ok) {
    return respond(plannedSetId);
  }
  if (!reps.ok) {
    return respond(reps);
  }
  if (!weightKg.ok) {
    return respond(weightKg);
  }
  const sessionId = params.id ?? '';
  const session = await getSession(db, profileId, sessionId);
  if (!session.ok) {
    return respond(session);
  }
  if (
    session.value.status === 'in_progress' &&
    isPlannedSetLogged(session.value, plannedSetId.value)
  ) {
    return respond(fail('set-already-logged'));
  }
  return respond(
    await logSet(
      db,
      profileId,
      sessionId,
      plannedSetId.value,
      { reps: reps.value, weightKg: weightKg.value },
      now,
    ),
  );
}

export async function handleFinishSession({
  db,
  profileId,
  now,
  params,
}: FitnessRequestContext): Promise<Response> {
  return respond(await finishWorkout(db, profileId, params.id ?? '', now));
}
