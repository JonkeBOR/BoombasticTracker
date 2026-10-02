import { describe, expect, it } from 'vitest';
import { decideRecordBodyweight, weighInStatus } from './bodyweight';

describe('weighInStatus', () => {
  it('rule 22: is available only when nothing is recorded today', () => {
    expect(weighInStatus({ todayEntryExists: false, today: '2026-10-02' })).toEqual({
      isAvailable: true,
      today: '2026-10-02',
    });
    expect(weighInStatus({ todayEntryExists: true, today: '2026-10-02' })).toEqual({
      isAvailable: false,
      today: '2026-10-02',
    });
  });
});

describe('decideRecordBodyweight', () => {
  it('rule 21: records the weight in grams for today', () => {
    expect(
      decideRecordBodyweight({ weightKg: 82.5, today: '2026-10-02', todayEntryExists: false }),
    ).toEqual({ ok: true, value: { entryDate: '2026-10-02', weightGrams: 82500 } });
  });

  it('rule 21: refuses a second entry for the same day', () => {
    expect(
      decideRecordBodyweight({ weightKg: 82.5, today: '2026-10-02', todayEntryExists: true }),
    ).toEqual({ ok: false, error: 'already-weighed-in-today' });
  });

  it.each([0, -80, Number.NaN, 1000.5])('refuses the weight %s', (weightKg) => {
    expect(
      decideRecordBodyweight({ weightKg, today: '2026-10-02', todayEntryExists: false }),
    ).toEqual({ ok: false, error: 'invalid-weight' });
  });
});
