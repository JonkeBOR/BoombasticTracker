import { describe, expect, it } from 'vitest';
import { decideLogSet, prefill } from './logging';

describe('prefill', () => {
  it('rule 14: suggests the last weight in kilograms and nothing when there is none', () => {
    expect(
      prefill([
        { id: 'p2', setNumber: 2, targetReps: 12, lastWeightGrams: 62000 },
        { id: 'p1', setNumber: 1, targetReps: 12, lastWeightGrams: 65000 },
        { id: 'p3', setNumber: 3, targetReps: 12, lastWeightGrams: null },
      ]),
    ).toEqual([
      { id: 'p1', setNumber: 1, targetReps: 12, suggestedWeightKg: 65 },
      { id: 'p2', setNumber: 2, targetReps: 12, suggestedWeightKg: 62 },
      { id: 'p3', setNumber: 3, targetReps: 12, suggestedWeightKg: null },
    ]);
  });
});

describe('decideLogSet', () => {
  const session = { status: 'in_progress' as const, workoutId: 'w1', blockNumber: 2 };
  const plannedSet = { slotWorkoutId: 'w1', blockNumber: 2 };

  it('rules 15 and 16: returns the reps and weight and the new last weight', () => {
    expect(decideLogSet({ session, plannedSet, input: { reps: 10, weightKg: 22.5 } })).toEqual({
      ok: true,
      value: { reps: 10, weightGrams: 22500, newLastWeightGrams: 22500 },
    });
  });

  it('accepts a set without weight, which clears the last weight', () => {
    const expected = { ok: true, value: { reps: 8, weightGrams: null, newLastWeightGrams: null } };
    expect(decideLogSet({ session, plannedSet, input: { reps: 8 } })).toEqual(expected);
    expect(decideLogSet({ session, plannedSet, input: { reps: 8, weightKg: null } })).toEqual(
      expected,
    );
  });

  it('refuses a session that is finished', () => {
    expect(
      decideLogSet({ session: { ...session, status: 'finished' }, plannedSet, input: { reps: 5 } }),
    ).toEqual({ ok: false, error: 'session-not-in-progress' });
  });

  it('refuses a planned set of another workout or another block', () => {
    expect(
      decideLogSet({
        session,
        plannedSet: { ...plannedSet, slotWorkoutId: 'w2' },
        input: { reps: 5 },
      }),
    ).toEqual({ ok: false, error: 'planned-set-not-in-session' });
    expect(
      decideLogSet({ session, plannedSet: { ...plannedSet, blockNumber: 1 }, input: { reps: 5 } }),
    ).toEqual({ ok: false, error: 'planned-set-not-in-session' });
  });

  it('refuses invalid reps and weights', () => {
    expect(decideLogSet({ session, plannedSet, input: { reps: 0 } })).toEqual({
      ok: false,
      error: 'invalid-reps',
    });
    expect(decideLogSet({ session, plannedSet, input: { reps: 5, weightKg: 0 } })).toEqual({
      ok: false,
      error: 'invalid-weight',
    });
  });
});
