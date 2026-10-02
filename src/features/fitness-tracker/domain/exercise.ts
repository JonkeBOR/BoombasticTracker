import { fail, type Result, succeed } from './result';

export function exerciseNameKey(name: string): string {
  return name.trim().toLocaleLowerCase();
}

export function canUseInSlot(exercise: { isArchived: boolean }): Result<true, 'exercise-archived'> {
  return exercise.isArchived ? fail('exercise-archived') : succeed(true);
}
