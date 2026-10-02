import { fail, type Result, succeed } from './result';
import { parseWeightKg } from './values';

export function weighInStatus(input: { todayEntryExists: boolean; today: string }): {
  isAvailable: boolean;
  today: string;
} {
  return { isAvailable: !input.todayEntryExists, today: input.today };
}

export function decideRecordBodyweight(input: {
  weightKg: number;
  today: string;
  todayEntryExists: boolean;
}): Result<
  { entryDate: string; weightGrams: number },
  'invalid-weight' | 'already-weighed-in-today'
> {
  const weightGrams = parseWeightKg(input.weightKg);
  if (!weightGrams.ok) {
    return fail(weightGrams.error);
  }
  if (input.todayEntryExists) {
    return fail('already-weighed-in-today');
  }
  return succeed({ entryDate: input.today, weightGrams: weightGrams.value });
}
