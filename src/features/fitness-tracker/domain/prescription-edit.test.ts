import { describe, expect, it } from 'vitest';
import {
  addSet,
  copyFrom,
  quickFill,
  removeLastSet,
  removesWeightedSets,
  summarize,
} from './prescription-edit';

describe('quickFill', () => {
  it('FR-029: builds sets × reps', () => {
    expect(quickFill(3, 12)).toEqual({ ok: true, value: [12, 12, 12] });
    expect(quickFill(1, 999)).toEqual({ ok: true, value: [999] });
  });

  it('FR-015: refuses no sets, a fraction or a negative number of sets', () => {
    for (const sets of [0, -1, 2.5, Number.NaN]) {
      expect(quickFill(sets, 10)).toEqual({ ok: false, error: 'prescription-needs-a-set' });
    }
  });

  it('refuses reps outside 1 to 999', () => {
    for (const reps of [0, 1000, 1.5, -3]) {
      expect(quickFill(3, reps)).toEqual({ ok: false, error: 'invalid-target' });
    }
  });
});

describe('addSet', () => {
  it('repeats the last target', () => {
    expect(addSet([12, 10])).toEqual([12, 10, 10]);
  });

  it('starts from ten reps when there is nothing to repeat', () => {
    expect(addSet([])).toEqual([10]);
  });
});

describe('removeLastSet', () => {
  it('spec R2: drops the last set', () => {
    expect(removeLastSet([12, 10, 8])).toEqual({ ok: true, value: [12, 10] });
  });

  it('FR-015: refuses to drop the only set', () => {
    expect(removeLastSet([12])).toEqual({ ok: false, error: 'prescription-needs-a-set' });
  });
});

describe('copyFrom', () => {
  it('copies the previous block targets without sharing the list', () => {
    const previous = [12, 10];
    const copy = copyFrom(previous);

    expect(copy).toEqual([12, 10]);
    expect(copy).not.toBe(previous);
  });
});

describe('removesWeightedSets', () => {
  const sets = [
    { setNumber: 1, lastWeightKg: 60 },
    { setNumber: 2, lastWeightKg: null },
    { setNumber: 3, lastWeightKg: 55 },
  ];

  it('FR-030: is true when a set that would go away has a last weight', () => {
    expect(removesWeightedSets(sets, 2)).toBe(true);
    expect(removesWeightedSets(sets, 1)).toBe(true);
  });

  it('FR-030: is false when only sets without a last weight go away', () => {
    expect(
      removesWeightedSets(
        [sets[0], sets[1]].flatMap((set) => (set ? [set] : [])),
        1,
      ),
    ).toBe(false);
  });

  it('FR-030: is false when no set goes away', () => {
    expect(removesWeightedSets(sets, 3)).toBe(false);
    expect(removesWeightedSets(sets, 5)).toBe(false);
  });
});

describe('summarize', () => {
  it('FR-027: writes sets × reps per block', () => {
    expect(
      summarize([
        { plannedSets: [{ targetReps: 12 }, { targetReps: 12 }, { targetReps: 12 }] },
        { plannedSets: [{ targetReps: 10 }, { targetReps: 10 }, { targetReps: 10 }] },
        { plannedSets: [{ targetReps: 10 }, { targetReps: 10 }] },
      ]),
    ).toBe('3×12 · 3×10 · 2×10');
  });

  it('writes the reps of a block with mixed targets', () => {
    expect(
      summarize([
        { plannedSets: [{ targetReps: 12 }, { targetReps: 10 }, { targetReps: 8 }] },
        { plannedSets: [{ targetReps: 5 }] },
      ]),
    ).toBe('12/10/8 · 1×5');
  });

  it('shows a dash for a block with no sets', () => {
    expect(summarize([{ plannedSets: [] }])).toBe('—');
  });
});
