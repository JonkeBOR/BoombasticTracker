import { fail, type Result, succeed } from './result';
import type { SessionStatus, WorkoutProgress } from './types';

export type SessionRef = { id: string; status: SessionStatus };

export type StartDecision = { kind: 'create' } | { kind: 'resume'; sessionId: string };

type SessionOfWorkout = { workoutId: string; status: SessionStatus };

export function decideStartWorkout(input: {
  workoutId: string;
  programWorkoutIds: readonly string[];
  existingSession: SessionRef | null;
}): Result<StartDecision, 'workout-not-in-active-program' | 'workout-already-finished'> {
  if (!input.programWorkoutIds.includes(input.workoutId)) {
    return fail('workout-not-in-active-program');
  }
  if (input.existingSession === null) {
    return succeed({ kind: 'create' });
  }
  if (input.existingSession.status === 'finished') {
    return fail('workout-already-finished');
  }
  return succeed({ kind: 'resume', sessionId: input.existingSession.id });
}

function progressOf(workoutId: string, sessions: readonly SessionOfWorkout[]): WorkoutProgress {
  const session = sessions.find((candidate) => candidate.workoutId === workoutId);
  if (!session) {
    return 'not-started';
  }
  return session.status === 'finished' ? 'finished' : 'in-progress';
}

export function workoutStatuses(
  workoutIdsInOrder: readonly string[],
  sessions: readonly SessionOfWorkout[],
): { workoutId: string; status: WorkoutProgress }[] {
  return workoutIdsInOrder.map((workoutId) => ({
    workoutId,
    status: progressOf(workoutId, sessions),
  }));
}

export function suggestedNextWorkout(
  workoutIdsInOrder: readonly string[],
  sessions: readonly SessionOfWorkout[],
): string | null {
  return (
    workoutIdsInOrder.find((workoutId) => progressOf(workoutId, sessions) !== 'finished') ?? null
  );
}
