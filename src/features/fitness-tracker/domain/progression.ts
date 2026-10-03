import { fail, type Result, succeed } from './result';

export type BlockStatus = 'complete' | 'current' | 'upcoming' | 'skipped';

export type FinishDecision =
  { kind: 'none' } | { kind: 'advance'; toBlockId: string } | { kind: 'new-pass' };

export type SkipDecision = { kind: 'move'; toBlockId: string } | { kind: 'new-pass' };

export type EditDecision =
  { kind: 'none' } | { kind: 'move'; toBlockId: string } | { kind: 'new-pass' };

export function isBlockComplete(
  workoutIds: readonly string[],
  finishedWorkoutIdsInBlock: readonly string[],
): boolean {
  return (
    workoutIds.length > 0 &&
    workoutIds.every((workoutId) => finishedWorkoutIdsInBlock.includes(workoutId))
  );
}

function blockAfter(blockIds: readonly string[], blockId: string): string | null {
  const index = blockIds.indexOf(blockId);
  return index === -1 ? null : (blockIds[index + 1] ?? null);
}

export function decideAfterFinish(input: {
  blockIds: readonly string[];
  currentBlockId: string;
  workoutIds: readonly string[];
  finishedWorkoutIdsInBlock: readonly string[];
}): FinishDecision {
  if (
    !input.blockIds.includes(input.currentBlockId) ||
    !isBlockComplete(input.workoutIds, input.finishedWorkoutIdsInBlock)
  ) {
    return { kind: 'none' };
  }
  const nextBlockId = blockAfter(input.blockIds, input.currentBlockId);
  return nextBlockId === null ? { kind: 'new-pass' } : { kind: 'advance', toBlockId: nextBlockId };
}

export function decideSkip(input: {
  blockIds: readonly string[];
  currentBlockId: string;
  targetBlockId: string;
}): Result<SkipDecision, 'invalid-block'> {
  const targetIndex = input.blockIds.indexOf(input.targetBlockId);
  const currentIndex = input.blockIds.indexOf(input.currentBlockId);
  if (targetIndex === -1 || currentIndex === -1) {
    return fail('invalid-block');
  }
  if (targetIndex === 0) {
    return succeed({ kind: 'new-pass' });
  }
  if (targetIndex > currentIndex) {
    return succeed({ kind: 'move', toBlockId: input.targetBlockId });
  }
  return fail('invalid-block');
}

export function reevaluateAfterEdit(input: {
  blockIdsBefore: readonly string[];
  blockIdsAfter: readonly string[];
  currentBlockId: string;
  removedBlockId: string | null;
  workoutIds: readonly string[];
  finishedWorkoutIdsInCurrentBlock: readonly string[];
}): EditDecision {
  if (input.removedBlockId !== null) {
    if (input.removedBlockId !== input.currentBlockId) {
      return { kind: 'none' };
    }
    const followingBlockId = blockAfter(input.blockIdsBefore, input.currentBlockId);
    return followingBlockId === null
      ? { kind: 'new-pass' }
      : { kind: 'move', toBlockId: followingBlockId };
  }
  if (!isBlockComplete(input.workoutIds, input.finishedWorkoutIdsInCurrentBlock)) {
    return { kind: 'none' };
  }
  const nextBlockId = blockAfter(input.blockIdsAfter, input.currentBlockId);
  return nextBlockId === null ? { kind: 'new-pass' } : { kind: 'move', toBlockId: nextBlockId };
}

export function blockStatuses(input: {
  blockIds: readonly string[];
  currentBlockId: string;
  workoutIds: readonly string[];
  finishedWorkoutIdsByBlock: Readonly<Record<string, readonly string[]>>;
}): { blockId: string; status: BlockStatus; finishedCount: number }[] {
  const currentIndex = input.blockIds.indexOf(input.currentBlockId);
  return input.blockIds.map((blockId, index) => {
    const finished = input.finishedWorkoutIdsByBlock[blockId] ?? [];
    const finishedCount = input.workoutIds.filter((workoutId) =>
      finished.includes(workoutId),
    ).length;
    if (index === currentIndex) {
      return { blockId, status: 'current', finishedCount };
    }
    if (index > currentIndex) {
      return { blockId, status: 'upcoming', finishedCount };
    }
    return {
      blockId,
      status: isBlockComplete(input.workoutIds, finished) ? 'complete' : 'skipped',
      finishedCount,
    };
  });
}
