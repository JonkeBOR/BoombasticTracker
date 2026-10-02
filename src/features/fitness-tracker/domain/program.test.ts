import { describe, expect, it } from 'vitest';
import {
  draftsForNewBlock,
  draftsForNewSlot,
  isActivatable,
  planPrescriptionChange,
  reorder,
  validateBlockCount,
} from './program';

describe('validateBlockCount', () => {
  it.each([1, 4, 52])('accepts %s', (count) => {
    expect(validateBlockCount(count)).toEqual({ ok: true, value: count });
  });

  it.each([0, -1, 2.5, Number.NaN])('rejects %s', (count) => {
    expect(validateBlockCount(count)).toEqual({ ok: false, error: 'invalid-block-count' });
  });
});

describe('draftsForNewBlock', () => {
  it('copies each slot targets from its last block, numbered from 1', () => {
    expect(
      draftsForNewBlock(
        [
          { slotId: 's1', targetReps: [12, 10] },
          { slotId: 's2', targetReps: [8] },
        ],
        'b3',
      ),
    ).toEqual([
      { exerciseSlotId: 's1', trainingBlockId: 'b3', setNumber: 1, targetReps: 12 },
      { exerciseSlotId: 's1', trainingBlockId: 'b3', setNumber: 2, targetReps: 10 },
      { exerciseSlotId: 's2', trainingBlockId: 'b3', setNumber: 1, targetReps: 8 },
    ]);
  });

  it('has nothing to copy when the program has no slots', () => {
    expect(draftsForNewBlock([], 'b2')).toEqual([]);
  });
});

describe('draftsForNewSlot', () => {
  it('gives the same targets to every block', () => {
    const result = draftsForNewSlot('s1', [12, 12], ['b1', 'b2']);
    expect(result).toEqual({
      ok: true,
      value: [
        { exerciseSlotId: 's1', trainingBlockId: 'b1', setNumber: 1, targetReps: 12 },
        { exerciseSlotId: 's1', trainingBlockId: 'b1', setNumber: 2, targetReps: 12 },
        { exerciseSlotId: 's1', trainingBlockId: 'b2', setNumber: 1, targetReps: 12 },
        { exerciseSlotId: 's1', trainingBlockId: 'b2', setNumber: 2, targetReps: 12 },
      ],
    });
  });

  it('needs at least one planned set', () => {
    expect(draftsForNewSlot('s1', [], ['b1'])).toEqual({
      ok: false,
      error: 'prescription-needs-a-set',
    });
  });

  it('refuses a target that is not a valid rep count', () => {
    expect(draftsForNewSlot('s1', [10, 0], ['b1'])).toEqual({ ok: false, error: 'invalid-target' });
  });
});

describe('planPrescriptionChange', () => {
  const existing = [
    { id: 'p1', setNumber: 1 },
    { id: 'p2', setNumber: 2 },
    { id: 'p3', setNumber: 3 },
  ];

  it('rule 19: updates sets that still exist, adds new numbers, keeps ids so last weight stays', () => {
    expect(planPrescriptionChange(existing, [10, 10, 10, 8])).toEqual({
      ok: true,
      value: {
        update: [
          { id: 'p1', targetReps: 10 },
          { id: 'p2', targetReps: 10 },
          { id: 'p3', targetReps: 10 },
        ],
        insert: [{ setNumber: 4, targetReps: 8 }],
        deleteIds: [],
      },
    });
  });

  it('drops the sets that no longer exist', () => {
    const result = planPrescriptionChange(existing, [12]);
    expect(result).toEqual({
      ok: true,
      value: { update: [{ id: 'p1', targetReps: 12 }], insert: [], deleteIds: ['p2', 'p3'] },
    });
  });

  it('needs at least one planned set', () => {
    expect(planPrescriptionChange(existing, [])).toEqual({
      ok: false,
      error: 'prescription-needs-a-set',
    });
  });

  it('refuses an invalid target without planning anything', () => {
    expect(planPrescriptionChange(existing, [10, 1000])).toEqual({
      ok: false,
      error: 'invalid-target',
    });
  });
});

describe('reorder', () => {
  const ids = ['a', 'b', 'c', 'd'];

  it('moves an item to a 1-based position', () => {
    expect(reorder(ids, 'd', 1)).toEqual({ ok: true, value: ['d', 'a', 'b', 'c'] });
    expect(reorder(ids, 'a', 3)).toEqual({ ok: true, value: ['b', 'c', 'a', 'd'] });
    expect(reorder(ids, 'b', 2)).toEqual({ ok: true, value: ids });
  });

  it.each([0, 5, -1, 1.5])('refuses position %s', (position) => {
    expect(reorder(ids, 'a', position)).toEqual({ ok: false, error: 'invalid-position' });
  });

  it('refuses an item that is not in the list', () => {
    expect(reorder(ids, 'z', 1)).toEqual({ ok: false, error: 'not-found' });
  });
});

describe('isActivatable', () => {
  const blockIds = ['b1', 'b2'];
  const slotWithSets = { plannedSets: [{ trainingBlockId: 'b1' }, { trainingBlockId: 'b2' }] };

  it('accepts a program whose every slot has planned sets in every block', () => {
    expect(isActivatable({ blockIds, workouts: [{ slots: [slotWithSets] }] })).toBe(true);
  });

  it('accepts a workout with no slots', () => {
    expect(isActivatable({ blockIds, workouts: [{ slots: [] }] })).toBe(true);
  });

  it('refuses a program with no workouts', () => {
    expect(isActivatable({ blockIds, workouts: [] })).toBe(false);
  });

  it('refuses a slot missing planned sets for a block', () => {
    const missingSecondBlock = { plannedSets: [{ trainingBlockId: 'b1' }] };
    expect(
      isActivatable({ blockIds, workouts: [{ slots: [slotWithSets, missingSecondBlock] }] }),
    ).toBe(false);
  });
});
