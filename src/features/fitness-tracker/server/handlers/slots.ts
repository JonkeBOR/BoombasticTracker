import 'server-only';
import { quickFill } from '../../domain/prescription-edit';
import { fail } from '../../domain/result';
import type { FitnessRequestContext } from '../fitness-route';
import {
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
} from '../programs';

function idParam(context: FitnessRequestContext): string {
  return context.params.id ?? '';
}

export async function handleAddSlot(context: FitnessRequestContext): Promise<Response> {
  const body = await readJson(context.request);
  if (!body.ok) {
    return respond(body);
  }
  const exerciseId = readString(body.value, 'exerciseId');
  const sets = readNumber(body.value, 'sets');
  const reps = readNumber(body.value, 'reps');
  if (!exerciseId.ok) {
    return respond(exerciseId);
  }
  if (!sets.ok) {
    return respond(sets);
  }
  if (!reps.ok) {
    return respond(reps);
  }
  const targetReps = quickFill(sets.value, reps.value);
  if (!targetReps.ok) {
    return respond(targetReps);
  }
  const workoutId = idParam(context);
  return respondWith(
    await addExerciseSlot(context.db, context.profileId, workoutId, {
      exerciseId: exerciseId.value,
      targetReps: targetReps.value,
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
