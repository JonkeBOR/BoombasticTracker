import { describe, expect, it } from 'vitest';
import {
  decideActivation,
  decideAfterFinish,
  decideStartOver,
  isBlockComplete,
  reevaluateAfterEdit,
} from './progression';

describe('decideActivation', () => {
  it('rules 1 to 3: switching programs ends the previous active cycle and starts cycle 1', () => {
    expect(
      decideActivation({
        isAlreadyActive: false,
        previousActiveCycleId: 'c-old',
        targetActiveCycleId: null,
        targetLastCycleNumber: 0,
      }),
    ).toEqual({ setActiveProgram: true, endCycleId: 'c-old', startCycleNumber: 1 });
  });

  it('numbers a new cycle after the program last one', () => {
    expect(
      decideActivation({
        isAlreadyActive: false,
        previousActiveCycleId: null,
        targetActiveCycleId: null,
        targetLastCycleNumber: 4,
      }),
    ).toEqual({ setActiveProgram: true, endCycleId: null, startCycleNumber: 5 });
  });

  it('keeps the active cycle of the program being activated', () => {
    expect(
      decideActivation({
        isAlreadyActive: false,
        previousActiveCycleId: 'c-old',
        targetActiveCycleId: 'c-target',
        targetLastCycleNumber: 3,
      }),
    ).toEqual({ setActiveProgram: true, endCycleId: 'c-old', startCycleNumber: null });
  });

  it('changes nothing when the program is already active', () => {
    expect(
      decideActivation({
        isAlreadyActive: true,
        previousActiveCycleId: 'c1',
        targetActiveCycleId: 'c1',
        targetLastCycleNumber: 1,
      }),
    ).toEqual({ setActiveProgram: false, endCycleId: null, startCycleNumber: null });
  });
});

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
  const workoutIds = ['w1', 'w2'];

  it('rule 7: does nothing while the block is incomplete', () => {
    expect(
      decideAfterFinish({
        cycle: { number: 1, currentBlockNumber: 2 },
        blockCount: 3,
        workoutIds,
        finishedWorkoutIdsInBlock: ['w1'],
      }),
    ).toEqual({ kind: 'none' });
  });

  it('rule 7: advances to the next block when the current block completes', () => {
    expect(
      decideAfterFinish({
        cycle: { number: 1, currentBlockNumber: 2 },
        blockCount: 3,
        workoutIds,
        finishedWorkoutIdsInBlock: ['w1', 'w2'],
      }),
    ).toEqual({ kind: 'advance', toBlockNumber: 3 });
  });

  it('rule 7: completes the cycle and names the next one when the last block completes', () => {
    expect(
      decideAfterFinish({
        cycle: { number: 4, currentBlockNumber: 3 },
        blockCount: 3,
        workoutIds,
        finishedWorkoutIdsInBlock: ['w1', 'w2'],
      }),
    ).toEqual({ kind: 'complete', newCycleNumber: 5 });
  });
});

describe('decideStartOver', () => {
  it('rule 8: names the cycle that follows the one being ended', () => {
    expect(decideStartOver({ number: 2, currentBlockNumber: 3 })).toEqual({
      newCycleNumber: 3,
    });
  });
});

describe('reevaluateAfterEdit', () => {
  const workoutIds = ['w1', 'w2'];

  it('changes nothing when the block is still incomplete and still exists', () => {
    expect(
      reevaluateAfterEdit({
        cycle: { number: 1, currentBlockNumber: 2 },
        blockCount: 3,
        workoutIds,
        finishedWorkoutIdsInBlock: ['w1'],
      }),
    ).toEqual({ kind: 'none' });
  });

  it('advances when removing a workout leaves only finished ones', () => {
    expect(
      reevaluateAfterEdit({
        cycle: { number: 1, currentBlockNumber: 1 },
        blockCount: 3,
        workoutIds: ['w1'],
        finishedWorkoutIdsInBlock: ['w1'],
      }),
    ).toEqual({ kind: 'move', toBlockNumber: 2 });
  });

  it('completes the cycle when the last block becomes complete', () => {
    expect(
      reevaluateAfterEdit({
        cycle: { number: 1, currentBlockNumber: 3 },
        blockCount: 3,
        workoutIds: ['w1'],
        finishedWorkoutIdsInBlock: ['w1'],
      }),
    ).toEqual({ kind: 'complete', newCycleNumber: 2 });
  });

  it('moves to the new last block when the current block no longer exists', () => {
    expect(
      reevaluateAfterEdit({
        cycle: { number: 1, currentBlockNumber: 4 },
        blockCount: 2,
        workoutIds,
        finishedWorkoutIdsInBlock: [],
      }),
    ).toEqual({ kind: 'move', toBlockNumber: 2 });
  });

  it('stays incomplete when a workout is added after the others finished', () => {
    expect(
      reevaluateAfterEdit({
        cycle: { number: 1, currentBlockNumber: 2 },
        blockCount: 3,
        workoutIds: ['w1', 'w2', 'w3'],
        finishedWorkoutIdsInBlock: ['w1', 'w2'],
      }),
    ).toEqual({ kind: 'none' });
  });
});
