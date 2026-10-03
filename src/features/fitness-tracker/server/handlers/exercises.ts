import 'server-only';
import {
  addExercise,
  archiveExercise,
  deleteExercise,
  renameExercise,
  unarchiveExercise,
} from '../exercises';
import type { FitnessRequestContext } from '../fitness-route';
import { hasKey, readBoolean, readJson, readString, respond, respondEmpty } from '../http';
import { fail } from '../../domain/result';

export async function handleAddExercise({
  db,
  profileId,
  now,
  request,
}: FitnessRequestContext): Promise<Response> {
  const body = await readJson(request);
  if (!body.ok) {
    return respond(body);
  }
  const name = readString(body.value, 'name');
  if (!name.ok) {
    return respond(name);
  }
  return respond(await addExercise(db, profileId, { name: name.value }, now));
}

export async function handleUpdateExercise({
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
  const exerciseId = params.id ?? '';
  if (hasKey(body.value, 'name')) {
    const name = readString(body.value, 'name');
    return name.ok
      ? respond(await renameExercise(db, profileId, exerciseId, { name: name.value }))
      : respond(name);
  }
  if (hasKey(body.value, 'isArchived')) {
    const isArchived = readBoolean(body.value, 'isArchived');
    if (!isArchived.ok) {
      return respond(isArchived);
    }
    return respond(
      isArchived.value
        ? await archiveExercise(db, profileId, exerciseId, now)
        : await unarchiveExercise(db, profileId, exerciseId),
    );
  }
  return respond(fail('invalid-body'));
}

export async function handleDeleteExercise({
  db,
  profileId,
  params,
}: FitnessRequestContext): Promise<Response> {
  return respondEmpty(await deleteExercise(db, profileId, params.id ?? ''));
}
