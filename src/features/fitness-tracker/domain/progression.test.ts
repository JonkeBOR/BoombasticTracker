import { describe, expect, it } from 'vitest';
import {
  blockStatuses,
  decideAfterFinish,
  decideSkip,
  isBlockComplete,
  reevaluateAfterEdit,
} from './progression';

const blockIds = ['b1', 'b2', 'b3'];
const workoutIds = ['w1', 'w2'];

describe('isBlockComplete', () => {
  it('rule 6: is complete when every workout has a finished session', () => {
    expect(isBlockComplete(['w1', 'w2'], ['w2', 'w1'])).toBe(true);
    expect(isBlockComplete(['w1', 'w2'], ['w1'])).toBe(false);
  });

  it('never completes a program with no workouts', () => {
    expect(isBlockComplete([], [])).toBe(false);
  });

  it('ignores finished workouts that are no longer part of the program', () => {
    expect(isBlockComplete(['w1'], ['w1', 'removed'])).toBe(true);
    expect(isBlockComplete(['w1', 'w2'], ['w1', 'removed'])).toBe(false);
  });
});

describe('decideAfterFinish', () => {
  it('rule 7: does nothing while the block is incomplete', () => {
    expect(
      decideAfterFinish({
        blockIds,
        currentBlockId: 'b2',
        workoutIds,
        finishedWorkoutIdsInBlock: ['w1'],
      }),
    ).toEqual({ kind: 'none' });
  });

  it('rule 7, FR-045: advances to the next block by order when the current block completes', () => {
    expect(
      decideAfterFinish({
        blockIds,
        currentBlockId: 'b2',
        workoutIds,
        finishedWorkoutIdsInBlock: ['w1', 'w2'],
      }),
    ).toEqual({ kind: 'advance', toBlockId: 'b3' });
  });

  it('rule 7, FR-045: starts a new pass when the last block completes', () => {
    expect(
      decideAfterFinish({
        blockIds,
        currentBlockId: 'b3',
        workoutIds,
        finishedWorkoutIdsInBlock: ['w1', 'w2'],
      }),
    ).toEqual({ kind: 'new-pass' });
  });

  it('does nothing for a program with no workouts', () => {
    expect(
      decideAfterFinish({
        blockIds,
        currentBlockId: 'b1',
        workoutIds: [],
        finishedWorkoutIdsInBlock: [],
      }),
    ).toEqual({ kind: 'none' });
  });

  it('does nothing when the current block is not one of the blocks', () => {
    expect(
      decideAfterFinish({
        blockIds,
        currentBlockId: 'gone',
        workoutIds,
        finishedWorkoutIdsInBlock: ['w1', 'w2'],
      }),
    ).toEqual({ kind: 'none' });
  });
});

describe('decideSkip', () => {
  it('FR-040: moves to a later block', () => {
    expect(decideSkip({ blockIds, currentBlockId: 'b1', targetBlockId: 'b3' })).toEqual({
      ok: true,
      value: { kind: 'move', toBlockId: 'b3' },
    });
    expect(decideSkip({ blockIds, currentBlockId: 'b1', targetBlockId: 'b2' })).toEqual({
      ok: true,
      value: { kind: 'move', toBlockId: 'b2' },
    });
  });

  it('rule 8, FR-040: skipping to the first block starts a new pass', () => {
    expect(decideSkip({ blockIds, currentBlockId: 'b3', targetBlockId: 'b1' })).toEqual({
      ok: true,
      value: { kind: 'new-pass' },
    });
  });

  it('FR-040: skipping to the first block while on it also starts a new pass', () => {
    expect(decideSkip({ blockIds, currentBlockId: 'b1', targetBlockId: 'b1' })).toEqual({
      ok: true,
      value: { kind: 'new-pass' },
    });
  });

  it('FR-040: refuses the current block unless it is the first', () => {
    expect(decideSkip({ blockIds, currentBlockId: 'b2', targetBlockId: 'b2' })).toEqual({
      ok: false,
      error: 'invalid-block',
    });
  });

  it('FR-040: refuses an earlier block other than the first', () => {
    expect(decideSkip({ blockIds, currentBlockId: 'b3', targetBlockId: 'b2' })).toEqual({
      ok: false,
      error: 'invalid-block',
    });
  });

  it('FR-040: refuses a block that is not in the program', () => {
    expect(decideSkip({ blockIds, currentBlockId: 'b1', targetBlockId: 'other' })).toEqual({
      ok: false,
      error: 'invalid-block',
    });
  });
});

describe('reevaluateAfterEdit', () => {
  const without = (id: string) => blockIds.filter((blockId) => blockId !== id);

  it('FR-043: removing a block before the current one keeps the current block', () => {
    expect(
      reevaluateAfterEdit({
        blockIdsBefore: blockIds,
        blockIdsAfter: without('b1'),
        currentBlockId: 'b2',
        removedBlockId: 'b1',
        workoutIds,
        finishedWorkoutIdsInCurrentBlock: [],
      }),
    ).toEqual({ kind: 'none' });
  });

  it('FR-043: removing the current block moves to the block that followed it', () => {
    expect(
      reevaluateAfterEdit({
        blockIdsBefore: blockIds,
        blockIdsAfter: without('b2'),
        currentBlockId: 'b2',
        removedBlockId: 'b2',
        workoutIds,
        finishedWorkoutIdsInCurrentBlock: ['w1', 'w2'],
      }),
    ).toEqual({ kind: 'move', toBlockId: 'b3' });
  });

  it('FR-043: removing the current block when it is the last starts a new pass', () => {
    expect(
      reevaluateAfterEdit({
        blockIdsBefore: blockIds,
        blockIdsAfter: without('b3'),
        currentBlockId: 'b3',
        removedBlockId: 'b3',
        workoutIds,
        finishedWorkoutIdsInCurrentBlock: [],
      }),
    ).toEqual({ kind: 'new-pass' });
  });

  it('FR-043: removing a block after the current one changes nothing', () => {
    expect(
      reevaluateAfterEdit({
        blockIdsBefore: blockIds,
        blockIdsAfter: without('b3'),
        currentBlockId: 'b1',
        removedBlockId: 'b3',
        workoutIds,
        finishedWorkoutIdsInCurrentBlock: ['w1', 'w2'],
      }),
    ).toEqual({ kind: 'none' });
  });

  it('FR-042: removing a workout that leaves only finished ones moves to the next block', () => {
    expect(
      reevaluateAfterEdit({
        blockIdsBefore: blockIds,
        blockIdsAfter: blockIds,
        currentBlockId: 'b1',
        removedBlockId: null,
        workoutIds: ['w1'],
        finishedWorkoutIdsInCurrentBlock: ['w1'],
      }),
    ).toEqual({ kind: 'move', toBlockId: 'b2' });
  });

  it('FR-042: removing a workout that completes the last block starts a new pass', () => {
    expect(
      reevaluateAfterEdit({
        blockIdsBefore: blockIds,
        blockIdsAfter: blockIds,
        currentBlockId: 'b3',
        removedBlockId: null,
        workoutIds: ['w1'],
        finishedWorkoutIdsInCurrentBlock: ['w1'],
      }),
    ).toEqual({ kind: 'new-pass' });
  });

  it('FR-042: removing a workout that leaves unfinished ones changes nothing', () => {
    expect(
      reevaluateAfterEdit({
        blockIdsBefore: blockIds,
        blockIdsAfter: blockIds,
        currentBlockId: 'b2',
        removedBlockId: null,
        workoutIds: ['w1', 'w2'],
        finishedWorkoutIdsInCurrentBlock: ['w1'],
      }),
    ).toEqual({ kind: 'none' });
  });

  it('never completes a block when the program has no workouts left', () => {
    expect(
      reevaluateAfterEdit({
        blockIdsBefore: blockIds,
        blockIdsAfter: blockIds,
        currentBlockId: 'b1',
        removedBlockId: null,
        workoutIds: [],
        finishedWorkoutIdsInCurrentBlock: [],
      }),
    ).toEqual({ kind: 'none' });
  });
});

describe('blockStatuses', () => {
  it('FR-011: marks the current block, upcoming blocks and complete or skipped earlier blocks', () => {
    expect(
      blockStatuses({
        blockIds: ['b1', 'b2', 'b3', 'b4'],
        currentBlockId: 'b3',
        workoutIds,
        finishedWorkoutIdsByBlock: { b1: ['w1', 'w2'], b2: ['w1'], b3: ['w1'] },
      }),
    ).toEqual([
      { blockId: 'b1', status: 'complete', finishedCount: 2 },
      { blockId: 'b2', status: 'skipped', finishedCount: 1 },
      { blockId: 'b3', status: 'current', finishedCount: 1 },
      { blockId: 'b4', status: 'upcoming', finishedCount: 0 },
    ]);
  });

  it('counts only workouts the program still has', () => {
    expect(
      blockStatuses({
        blockIds: ['b1', 'b2'],
        currentBlockId: 'b2',
        workoutIds: ['w1'],
        finishedWorkoutIdsByBlock: { b1: ['w1', 'removed'] },
      }),
    ).toEqual([
      { blockId: 'b1', status: 'complete', finishedCount: 1 },
      { blockId: 'b2', status: 'current', finishedCount: 0 },
    ]);
  });

  it('marks an earlier block with no finished workouts as skipped', () => {
    expect(
      blockStatuses({
        blockIds: ['b1', 'b2'],
        currentBlockId: 'b2',
        workoutIds,
        finishedWorkoutIdsByBlock: {},
      }),
    ).toEqual([
      { blockId: 'b1', status: 'skipped', finishedCount: 0 },
      { blockId: 'b2', status: 'current', finishedCount: 0 },
    ]);
  });
});
