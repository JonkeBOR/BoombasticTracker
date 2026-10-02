import { describe, expect, it } from 'vitest';
import { canUseInSlot, exerciseNameKey } from './exercise';

describe('exerciseNameKey', () => {
  it('ignores letter case and surrounding spaces', () => {
    expect(exerciseNameKey('  Incline BENCH press ')).toBe('incline bench press');
    expect(exerciseNameKey('Squat')).toBe(exerciseNameKey(' squat'));
  });

  it('keeps inner spacing, so different words stay different', () => {
    expect(exerciseNameKey('bench press')).not.toBe(exerciseNameKey('benchpress'));
  });
});

describe('canUseInSlot', () => {
  it('accepts an active exercise', () => {
    expect(canUseInSlot({ isArchived: false })).toEqual({ ok: true, value: true });
  });

  it('refuses an archived exercise', () => {
    expect(canUseInSlot({ isArchived: true })).toEqual({ ok: false, error: 'exercise-archived' });
  });
});
