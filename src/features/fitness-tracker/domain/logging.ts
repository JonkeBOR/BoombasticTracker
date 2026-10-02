import { fail, type Result, succeed } from './result';
import type { SessionPlannedSet, SessionStatus } from './types';
import { gramsToKg, parseLoggedReps, parseWeightKg } from './values';

export type LogSetDecision = {
  reps: number;
  weightGrams: number | null;
  newLastWeightGrams: number | null;
};

type LogSetError =
  'session-not-in-progress' | 'planned-set-not-in-session' | 'invalid-reps' | 'invalid-weight';

export function prefill(
  plannedSets: readonly {
    id: string;
    setNumber: number;
    targetReps: number;
    lastWeightGrams: number | null;
  }[],
): SessionPlannedSet[] {
  return [...plannedSets]
    .sort((left, right) => left.setNumber - right.setNumber)
    .map((plannedSet) => ({
      id: plannedSet.id,
      setNumber: plannedSet.setNumber,
      targetReps: plannedSet.targetReps,
      suggestedWeightKg:
        plannedSet.lastWeightGrams === null ? null : gramsToKg(plannedSet.lastWeightGrams),
    }));
}

export function decideLogSet(input: {
  session: { status: SessionStatus; workoutId: string; blockNumber: number };
  plannedSet: { slotWorkoutId: string; blockNumber: number };
  input: { reps: number; weightKg?: number | null };
}): Result<LogSetDecision, LogSetError> {
  const { session, plannedSet } = input;
  if (session.status !== 'in_progress') {
    return fail('session-not-in-progress');
  }
  if (
    plannedSet.slotWorkoutId !== session.workoutId ||
    plannedSet.blockNumber !== session.blockNumber
  ) {
    return fail('planned-set-not-in-session');
  }
  const reps = parseLoggedReps(input.input.reps);
  if (!reps.ok) {
    return fail(reps.error);
  }
  const weightKg = input.input.weightKg ?? null;
  if (weightKg === null) {
    return succeed({ reps: reps.value, weightGrams: null, newLastWeightGrams: null });
  }
  const weightGrams = parseWeightKg(weightKg);
  if (!weightGrams.ok) {
    return fail(weightGrams.error);
  }
  return succeed({
    reps: reps.value,
    weightGrams: weightGrams.value,
    newLastWeightGrams: weightGrams.value,
  });
}
