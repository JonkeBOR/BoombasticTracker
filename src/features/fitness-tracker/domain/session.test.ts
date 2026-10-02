import { describe, expect, it } from 'vitest';
import { decideStartWorkout, suggestedNextWorkout, workoutStatuses } from './session';

const workoutIds = ['w1', 'w2', 'w3', 'w4'];

describe('decideStartWorkout', () => {
  it('rule 10: creates a session for an unfinished workout with no session yet', () => {
    expect(
      decideStartWorkout({ workoutId: 'w2', programWorkoutIds: workoutIds, existingSession: null }),
    ).toEqual({ ok: true, value: { kind: 'create' } });
  });

  it('resumes a session that is in progress instead of creating a second one', () => {
    expect(
      decideStartWorkout({
        workoutId: 'w2',
        programWorkoutIds: workoutIds,
        existingSession: { id: 's1', status: 'in_progress' },
      }),
    ).toEqual({ ok: true, value: { kind: 'resume', sessionId: 's1' } });
  });

  it('refuses a workout that already has a finished session in this block', () => {
    expect(
      decideStartWorkout({
        workoutId: 'w2',
        programWorkoutIds: workoutIds,
        existingSession: { id: 's1', status: 'finished' },
      }),
    ).toEqual({ ok: false, error: 'workout-already-finished' });
  });

  it('refuses a workout that is not part of the active program', () => {
    expect(
      decideStartWorkout({ workoutId: 'x', programWorkoutIds: workoutIds, existingSession: null }),
    ).toEqual({ ok: false, error: 'workout-not-in-active-program' });
  });
});

describe('suggestedNextWorkout', () => {
  it('rule 10: is the first workout in order without a finished session', () => {
    expect(
      suggestedNextWorkout(workoutIds, [
        { workoutId: 'w1', status: 'finished' },
        { workoutId: 'w2', status: 'finished' },
      ]),
    ).toBe('w3');
  });

  it('skips over a finished workout later in the order', () => {
    expect(suggestedNextWorkout(workoutIds, [{ workoutId: 'w1', status: 'finished' }])).toBe('w2');
    expect(suggestedNextWorkout(workoutIds, [{ workoutId: 'w2', status: 'finished' }])).toBe('w1');
  });

  it('still suggests a workout that is in progress', () => {
    expect(suggestedNextWorkout(workoutIds, [{ workoutId: 'w1', status: 'in_progress' }])).toBe(
      'w1',
    );
  });

  it('is null when every workout is finished or there are none', () => {
    const finished = workoutIds.map((workoutId) => ({ workoutId, status: 'finished' as const }));
    expect(suggestedNextWorkout(workoutIds, finished)).toBeNull();
    expect(suggestedNextWorkout([], [])).toBeNull();
  });
});

describe('workoutStatuses', () => {
  it('reports each workout as not started, in progress or finished, in workout order', () => {
    expect(
      workoutStatuses(workoutIds, [
        { workoutId: 'w3', status: 'in_progress' },
        { workoutId: 'w1', status: 'finished' },
      ]),
    ).toEqual([
      { workoutId: 'w1', status: 'finished' },
      { workoutId: 'w2', status: 'not-started' },
      { workoutId: 'w3', status: 'in-progress' },
      { workoutId: 'w4', status: 'not-started' },
    ]);
  });
});
