export type ActivationDecision = {
  setActiveProgram: boolean;
  endCycleId: string | null;
  startCycleNumber: number | null;
};

export function decideActivation(input: {
  isAlreadyActive: boolean;
  previousActiveCycleId: string | null;
  targetActiveCycleId: string | null;
  targetLastCycleNumber: number;
}): ActivationDecision {
  return {
    setActiveProgram: !input.isAlreadyActive,
    endCycleId: input.isAlreadyActive ? null : input.previousActiveCycleId,
    startCycleNumber: input.targetActiveCycleId === null ? input.targetLastCycleNumber + 1 : null,
  };
}

type CycleProgress = { number: number; currentBlockNumber: number };

export type FinishDecision =
  | { kind: 'none' }
  | { kind: 'advance'; toBlockNumber: number }
  | { kind: 'complete'; newCycleNumber: number };

export type EditDecision =
  | { kind: 'none' }
  | { kind: 'move'; toBlockNumber: number }
  | { kind: 'complete'; newCycleNumber: number };

export function isBlockComplete(
  workoutIds: readonly string[],
  finishedWorkoutIdsInBlock: readonly string[],
): boolean {
  return (
    workoutIds.length > 0 &&
    workoutIds.every((workoutId) => finishedWorkoutIdsInBlock.includes(workoutId))
  );
}

export function decideAfterFinish(input: {
  cycle: CycleProgress;
  blockCount: number;
  workoutIds: readonly string[];
  finishedWorkoutIdsInBlock: readonly string[];
}): FinishDecision {
  if (!isBlockComplete(input.workoutIds, input.finishedWorkoutIdsInBlock)) {
    return { kind: 'none' };
  }
  if (input.cycle.currentBlockNumber < input.blockCount) {
    return { kind: 'advance', toBlockNumber: input.cycle.currentBlockNumber + 1 };
  }
  return { kind: 'complete', newCycleNumber: input.cycle.number + 1 };
}

export function decideStartOver(cycle: CycleProgress): { newCycleNumber: number } {
  return { newCycleNumber: cycle.number + 1 };
}

export function reevaluateAfterEdit(input: {
  cycle: CycleProgress;
  blockCount: number;
  workoutIds: readonly string[];
  finishedWorkoutIdsInBlock: readonly string[];
}): EditDecision {
  const block = Math.min(input.cycle.currentBlockNumber, input.blockCount);
  if (isBlockComplete(input.workoutIds, input.finishedWorkoutIdsInBlock)) {
    return block < input.blockCount
      ? { kind: 'move', toBlockNumber: block + 1 }
      : { kind: 'complete', newCycleNumber: input.cycle.number + 1 };
  }
  return block === input.cycle.currentBlockNumber
    ? { kind: 'none' }
    : { kind: 'move', toBlockNumber: block };
}
