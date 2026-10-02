import { fail, type Result, succeed } from './result';

const gramsPerKilogram = 1000;
const maxWeightGrams = 1000 * gramsPerKilogram;
const maxReps = 999;
const maxNameLength = 100;
const gramRoundingTolerance = 1e-6;

export function parseWeightKg(kilograms: number): Result<number, 'invalid-weight'> {
  if (!Number.isFinite(kilograms)) {
    return fail('invalid-weight');
  }
  const exactGrams = kilograms * gramsPerKilogram;
  const grams = Math.round(exactGrams);
  const hasSubGramPrecision = Math.abs(exactGrams - grams) > gramRoundingTolerance;
  if (hasSubGramPrecision || grams < 1 || grams > maxWeightGrams) {
    return fail('invalid-weight');
  }
  return succeed(grams);
}

export function gramsToKg(grams: number): number {
  return grams / gramsPerKilogram;
}

function isWholeRepCount(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= maxReps;
}

export function parseTargetReps(reps: number): Result<number, 'invalid-target'> {
  return isWholeRepCount(reps) ? succeed(reps) : fail('invalid-target');
}

export function parseLoggedReps(reps: number): Result<number, 'invalid-reps'> {
  return isWholeRepCount(reps) ? succeed(reps) : fail('invalid-reps');
}

export function parseName(text: string): Result<string, 'name-required' | 'name-too-long'> {
  const name = text.trim();
  if (name.length === 0) {
    return fail('name-required');
  }
  if (name.length > maxNameLength) {
    return fail('name-too-long');
  }
  return succeed(name);
}

export function localDate(now: Date, timeZone: string): Result<string, 'invalid-time-zone'> {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return succeed(formatter.format(now));
  } catch {
    return fail('invalid-time-zone');
  }
}
