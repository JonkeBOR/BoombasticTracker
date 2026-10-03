import { describe, expect, it } from 'vitest';
import { fitnessErrorCodes, isFitnessErrorCode } from './errors';

describe('isFitnessErrorCode', () => {
  it('recognises every listed code', () => {
    for (const code of fitnessErrorCodes) {
      expect(isFitnessErrorCode(code)).toBe(true);
    }
  });

  it('rejects anything else', () => {
    expect(isFitnessErrorCode('nope')).toBe(false);
    expect(isFitnessErrorCode(undefined)).toBe(false);
    expect(isFitnessErrorCode(404)).toBe(false);
  });

  it('lists each code once', () => {
    expect(new Set(fitnessErrorCodes).size).toBe(fitnessErrorCodes.length);
  });
});
