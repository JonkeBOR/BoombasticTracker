import { describe, expect, it } from 'vitest';
import {
  gramsToKg,
  localDate,
  parseLoggedReps,
  parseName,
  parseTargetReps,
  parseWeightKg,
} from './values';

describe('parseWeightKg', () => {
  it('converts kilograms to whole grams', () => {
    expect(parseWeightKg(22.5)).toEqual({ ok: true, value: 22500 });
    expect(parseWeightKg(0.001)).toEqual({ ok: true, value: 1 });
    expect(parseWeightKg(1000)).toEqual({ ok: true, value: 1000000 });
  });

  it('does not drift on values that are not exact in binary', () => {
    expect(parseWeightKg(0.1 + 0.2)).toEqual({ ok: true, value: 300 });
    expect(parseWeightKg(62.35)).toEqual({ ok: true, value: 62350 });
  });

  it.each([0, -5, 1000.001, 1000.0005, 22.5001, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects %s',
    (kilograms) => {
      expect(parseWeightKg(kilograms)).toEqual({ ok: false, error: 'invalid-weight' });
    },
  );
});

describe('gramsToKg', () => {
  it('converts whole grams back to kilograms', () => {
    expect(gramsToKg(22500)).toBe(22.5);
    expect(gramsToKg(1)).toBe(0.001);
  });
});

describe('parseTargetReps', () => {
  it.each([1, 12, 999])('accepts %s', (reps) => {
    expect(parseTargetReps(reps)).toEqual({ ok: true, value: reps });
  });

  it.each([0, -1, 12.5, 1000, Number.NaN])('rejects %s', (reps) => {
    expect(parseTargetReps(reps)).toEqual({ ok: false, error: 'invalid-target' });
  });
});

describe('parseLoggedReps', () => {
  it.each([1, 8, 999])('accepts %s', (reps) => {
    expect(parseLoggedReps(reps)).toEqual({ ok: true, value: reps });
  });

  it.each([0, -1, 8.5, 1000])('rejects %s', (reps) => {
    expect(parseLoggedReps(reps)).toEqual({ ok: false, error: 'invalid-reps' });
  });
});

describe('parseName', () => {
  it('trims surrounding spaces', () => {
    expect(parseName('  Incline bench press ')).toEqual({ ok: true, value: 'Incline bench press' });
  });

  it.each(['', '   ', '\t\n'])('requires a name for %j', (text) => {
    expect(parseName(text)).toEqual({ ok: false, error: 'name-required' });
  });

  it('accepts exactly 100 characters and rejects 101', () => {
    expect(parseName('a'.repeat(100)).ok).toBe(true);
    expect(parseName('a'.repeat(101))).toEqual({ ok: false, error: 'name-too-long' });
  });
});

describe('localDate', () => {
  const stockholm = 'Europe/Stockholm';

  it('gives the date in the given time zone, not in UTC', () => {
    const lateEvening = new Date('2026-10-02T21:30:00Z');
    expect(localDate(lateEvening, stockholm)).toEqual({ ok: true, value: '2026-10-02' });
    expect(localDate(lateEvening, 'UTC')).toEqual({ ok: true, value: '2026-10-02' });
  });

  it('rolls over at local midnight (23:30 then 00:10 in Stockholm)', () => {
    const beforeMidnight = new Date('2026-10-02T21:30:00Z');
    const afterMidnight = new Date('2026-10-02T22:10:00Z');
    expect(localDate(beforeMidnight, stockholm)).toEqual({ ok: true, value: '2026-10-02' });
    expect(localDate(afterMidnight, stockholm)).toEqual({ ok: true, value: '2026-10-03' });
  });

  it('rejects an unknown time zone', () => {
    expect(localDate(new Date(), 'Mars/Olympus')).toEqual({
      ok: false,
      error: 'invalid-time-zone',
    });
  });
});
