import 'server-only';
import { quickFill } from '../../domain/prescription-edit';
import { fail, succeed } from '../../domain/result';
import type { FitnessRequestContext } from '../fitness-route';
import {
  type JsonBody,
  hasKey,
  readBoolean,
  readJson,
  readNumber,
  readNumberArray,
  readString,
  respond,
  respondEmpty,
  respondWith,
} from '../http';
import {
  addExerciseSlot,
  moveExerciseSlot,
  removeExerciseSlot,
  replaceSlotExercise,
  setPrescription,
  setSlotOptional,
  setSlotPeriodization,
  setUniformPrescription,
} from '../programs';

function idParam(context: FitnessRequestContext): string {
  return context.params.id ?? '';
}

function readScheme(body: JsonBody) {
  const sets = readNumber(body, 'sets');
  if (!sets.ok) {
    return sets;
  }
  const reps = readNumber(body, 'reps');
  if (!reps.ok) {
    return reps;
  }
  return quickFill(sets.value, reps.value);
}

function readOptionalBoolean(body: JsonBody, key: string, fallback: boolean) {
  return hasKey(body, key) ? readBoolean(body, key) : succeed(fallback);
}

async function updatePeriodization(
  context: FitnessRequestContext,
  body: JsonBody,
): Promise<Response> {
  const isPeriodized = readBoolean(body, 'isPeriodized');
  if (!isPeriodized.ok) {
    return respond(isPeriodized);
  }
  const { db, profileId } = context;
  const slotId = idParam(context);
  if (isPeriodized.value) {
    return respondEmpty(await setSlotPeriodization(db, profileId, slotId, { isPeriodized: true }));
  }
  const targetReps = readScheme(body);
  return targetReps.ok
    ? respondEmpty(
        await setSlotPeriodization(db, profileId, slotId, {
          isPeriodized: false,
          targetReps: targetReps.value,
        }),
      )
    : respond(targetReps);
}

export async function handleAddSlot(context: FitnessRequestContext): Promise<Response> {
  const body = await readJson(context.request);
  if (!body.ok) {
    return respond(body);
  }
  const exerciseId = readString(body.value, 'exerciseId');
  if (!exerciseId.ok) {
    return respond(exerciseId);
  }
  const isPeriodized = readOptionalBoolean(body.value, 'isPeriodized', false);
  if (!isPeriodized.ok) {
    return respond(isPeriodized);
  }
  const targetReps = readScheme(body.value);
  if (!targetReps.ok) {
    return respond(targetReps);
  }
  const workoutId = idParam(context);
  return respondWith(
    await addExerciseSlot(context.db, context.profileId, workoutId, {
      exerciseId: exerciseId.value,
      targetReps: targetReps.value,
      isPeriodized: isPeriodized.value,
    }),
    (program) => {
      const workout = program.workouts.find((candidate) => candidate.id === workoutId);
      return { id: workout?.slots[workout.slots.length - 1]?.id ?? '' };
    },
  );
}

export async function handleUpdateSlot(context: FitnessRequestContext): Promise<Response> {
  const body = await readJson(context.request);
  if (!body.ok) {
    return respond(body);
  }
  const { db, profileId } = context;
  const slotId = idParam(context);
  if (hasKey(body.value, 'exerciseId')) {
    const exerciseId = readString(body.value, 'exerciseId');
    return exerciseId.ok
      ? respondEmpty(
          await replaceSlotExercise(db, profileId, slotId, { exerciseId: exerciseId.value }),
        )
      : respond(exerciseId);
  }
  if (hasKey(body.value, 'isOptional')) {
    const isOptional = readBoolean(body.value, 'isOptional');
    return isOptional.ok
      ? respondEmpty(await setSlotOptional(db, profileId, slotId, { isOptional: isOptional.value }))
      : respond(isOptional);
  }
  if (hasKey(body.value, 'isPeriodized')) {
    return updatePeriodization(context, body.value);
  }
  if (hasKey(body.value, 'sets')) {
    const targetReps = readScheme(body.value);
    return targetReps.ok
      ? respondEmpty(
          await setUniformPrescription(db, profileId, slotId, { targetReps: targetReps.value }),
        )
      : respond(targetReps);
  }
  if (hasKey(body.value, 'toPosition')) {
    const toPosition = readNumber(body.value, 'toPosition');
    return toPosition.ok
      ? respondEmpty(
          await moveExerciseSlot(db, profileId, slotId, { toPosition: toPosition.value }),
        )
      : respond(toPosition);
  }
  return respond(fail('invalid-body'));
}

export async function handleRemoveSlot(context: FitnessRequestContext): Promise<Response> {
  return respondEmpty(await removeExerciseSlot(context.db, context.profileId, idParam(context)));
}

export async function handleSetPrescription(context: FitnessRequestContext): Promise<Response> {
  const body = await readJson(context.request);
  if (!body.ok) {
    return respond(body);
  }
  const targetReps = readNumberArray(body.value, 'targetReps');
  if (!targetReps.ok) {
    return respond(targetReps);
  }
  return respondEmpty(
    await setPrescription(
      context.db,
      context.profileId,
      idParam(context),
      context.params.blockId ?? '',
      { targetReps: targetReps.value },
    ),
  );
}
