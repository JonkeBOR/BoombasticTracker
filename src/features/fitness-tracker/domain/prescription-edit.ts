import { fail, type Result, succeed } from './result';
import { parseTargetReps } from './values';

const defaultReps = 10;
const noSets = '—';

export function quickFill(
  sets: number,
  reps: number,
): Result<number[], 'prescription-needs-a-set' | 'invalid-target'> {
  if (!Number.isInteger(sets) || sets < 1) {
    return fail('prescription-needs-a-set');
  }
  const target = parseTargetReps(reps);
  if (!target.ok) {
    return fail(target.error);
  }
  return succeed(Array.from({ length: sets }, () => target.value));
}

export function addSet(targets: readonly number[]): number[] {
  return [...targets, targets[targets.length - 1] ?? defaultReps];
}

export function removeLastSet(
  targets: readonly number[],
): Result<number[], 'prescription-needs-a-set'> {
  return targets.length <= 1 ? fail('prescription-needs-a-set') : succeed(targets.slice(0, -1));
}

export function copyFrom(previousTargets: readonly number[]): number[] {
  return [...previousTargets];
}

export function removesWeightedSets(
  current: readonly { setNumber: number; lastWeightKg: number | null }[],
  nextLength: number,
): boolean {
  return current.some((set) => set.setNumber > nextLength && set.lastWeightKg !== null);
}

function summarizeBlock(targets: readonly number[]): string {
  const [first] = targets;
  if (first === undefined) {
    return noSets;
  }
  return targets.every((target) => target === first)
    ? `${targets.length}×${first}`
    : targets.join('/');
}

export function summarize(
  prescriptions: readonly { plannedSets: readonly { targetReps: number }[] }[],
  isPeriodized: boolean,
): string {
  return (isPeriodized ? prescriptions : prescriptions.slice(0, 1))
    .map((prescription) => summarizeBlock(prescription.plannedSets.map((set) => set.targetReps)))
    .join(' · ');
}
