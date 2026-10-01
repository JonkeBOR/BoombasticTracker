import { expect, test } from 'vitest';
import { parseSignInError } from './sign-in-error';

test.each(['cancelled', 'not-allowed', 'expired', 'unavailable'] as const)(
  '%s is a known sign-in error',
  (code) => {
    expect(parseSignInError(code)).toBe(code);
  },
);

test.each([undefined, '', 'Cancelled', 'something-else', ['cancelled']])(
  '%j is not a sign-in error',
  (value) => {
    expect(parseSignInError(value)).toBeUndefined();
  },
);
