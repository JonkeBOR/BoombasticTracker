import 'server-only';
import { activateProgram, pauseActiveProgram, skipToBlock } from '../activation';
import type { FitnessRequestContext } from '../fitness-route';
import { readJson, readString, respond, respondEmpty } from '../http';

export async function handleActivateProgram({
  db,
  profileId,
  now,
  params,
}: FitnessRequestContext): Promise<Response> {
  return respondEmpty(await activateProgram(db, profileId, params.id ?? '', now));
}

export async function handlePause({
  db,
  profileId,
  now,
}: FitnessRequestContext): Promise<Response> {
  return respondEmpty(await pauseActiveProgram(db, profileId, now));
}

export async function handleSkip({
  db,
  profileId,
  now,
  request,
}: FitnessRequestContext): Promise<Response> {
  const body = await readJson(request);
  if (!body.ok) {
    return respond(body);
  }
  const blockId = readString(body.value, 'blockId');
  if (!blockId.ok) {
    return respond(blockId);
  }
  return respond(await skipToBlock(db, profileId, { blockId: blockId.value }, now));
}
