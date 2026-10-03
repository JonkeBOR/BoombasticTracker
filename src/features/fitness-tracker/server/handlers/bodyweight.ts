import 'server-only';
import type { FitnessRequestContext } from '../fitness-route';
import { readJson, readNumber, readString, respond } from '../http';
import { recordBodyweight } from '../bodyweight';

export async function handleRecordBodyweight({
  db,
  profileId,
  now,
  request,
}: FitnessRequestContext): Promise<Response> {
  const body = await readJson(request);
  if (!body.ok) {
    return respond(body);
  }
  const weightKg = readNumber(body.value, 'weightKg');
  if (!weightKg.ok) {
    return respond(weightKg);
  }
  const timeZone = readString(body.value, 'timeZone');
  if (!timeZone.ok) {
    return respond(timeZone);
  }
  return respond(
    await recordBodyweight(db, profileId, { weightKg: weightKg.value }, now, timeZone.value),
  );
}
