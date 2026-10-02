import { fail, type Result, succeed } from './result';
import { parseTargetReps } from './values';

export type PlannedSetDraft = {
  exerciseSlotId: string;
  trainingBlockId: string;
  setNumber: number;
  targetReps: number;
};

export type PrescriptionChange = {
  update: { id: string; targetReps: number }[];
  insert: { setNumber: number; targetReps: number }[];
  deleteIds: string[];
};

type TargetsError = 'prescription-needs-a-set' | 'invalid-target';

export function validateBlockCount(count: number): Result<number, 'invalid-block-count'> {
  return Number.isInteger(count) && count >= 1 ? succeed(count) : fail('invalid-block-count');
}

function parseTargets(targetReps: readonly number[]): Result<number[], TargetsError> {
  if (targetReps.length === 0) {
    return fail('prescription-needs-a-set');
  }
  const parsed: number[] = [];
  for (const reps of targetReps) {
    const target = parseTargetReps(reps);
    if (!target.ok) {
      return fail(target.error);
    }
    parsed.push(target.value);
  }
  return succeed(parsed);
}

function draftsFor(
  exerciseSlotId: string,
  trainingBlockId: string,
  targets: readonly number[],
): PlannedSetDraft[] {
  return targets.map((targetReps, index) => ({
    exerciseSlotId,
    trainingBlockId,
    setNumber: index + 1,
    targetReps,
  }));
}

export function draftsForNewBlock(
  slotTargets: readonly { slotId: string; targetReps: readonly number[] }[],
  newBlockId: string,
): PlannedSetDraft[] {
  return slotTargets.flatMap((slot) => draftsFor(slot.slotId, newBlockId, slot.targetReps));
}

export function draftsForNewSlot(
  slotId: string,
  targetReps: readonly number[],
  blockIds: readonly string[],
): Result<PlannedSetDraft[], TargetsError> {
  const targets = parseTargets(targetReps);
  if (!targets.ok) {
    return fail(targets.error);
  }
  return succeed(blockIds.flatMap((blockId) => draftsFor(slotId, blockId, targets.value)));
}

export function planPrescriptionChange(
  existing: readonly { id: string; setNumber: number }[],
  targetReps: readonly number[],
): Result<PrescriptionChange, TargetsError> {
  const targets = parseTargets(targetReps);
  if (!targets.ok) {
    return fail(targets.error);
  }
  const idBySetNumber = new Map(
    existing.map((plannedSet) => [plannedSet.setNumber, plannedSet.id]),
  );
  const change: PrescriptionChange = { update: [], insert: [], deleteIds: [] };
  targets.value.forEach((target, index) => {
    const setNumber = index + 1;
    const id = idBySetNumber.get(setNumber);
    if (id === undefined) {
      change.insert.push({ setNumber, targetReps: target });
    } else {
      change.update.push({ id, targetReps: target });
    }
  });
  change.deleteIds = existing
    .filter((plannedSet) => plannedSet.setNumber > targets.value.length)
    .map((plannedSet) => plannedSet.id);
  return succeed(change);
}

export function reorder(
  ids: readonly string[],
  id: string,
  toPosition: number,
): Result<string[], 'not-found' | 'invalid-position'> {
  const fromIndex = ids.indexOf(id);
  if (fromIndex === -1) {
    return fail('not-found');
  }
  if (!Number.isInteger(toPosition) || toPosition < 1 || toPosition > ids.length) {
    return fail('invalid-position');
  }
  const remaining = ids.filter((candidate) => candidate !== id);
  remaining.splice(toPosition - 1, 0, id);
  return succeed(remaining);
}

export type ActivationShape = {
  blockIds: readonly string[];
  workouts: readonly {
    slots: readonly { plannedSets: readonly { trainingBlockId: string }[] }[];
  }[];
};

export function isActivatable(program: ActivationShape): boolean {
  if (program.workouts.length === 0) {
    return false;
  }
  return program.workouts.every((workout) =>
    workout.slots.every((slot) =>
      program.blockIds.every((blockId) =>
        slot.plannedSets.some((plannedSet) => plannedSet.trainingBlockId === blockId),
      ),
    ),
  );
}
