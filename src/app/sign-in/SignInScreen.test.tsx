import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import type { SignInError } from '@/lib/sign-in-error';
import { authStrings } from '@/lib/strings/auth';
import { SignInScreen } from './SignInScreen';

test('offers Google sign-in that returns to the requested page', () => {
  render(<SignInScreen returnTo="/fitness-tracker" error={undefined} />);

  expect(screen.getByRole('heading', { level: 1, name: authStrings.signInTitle })).toBeDefined();
  expect(
    screen.getByRole('link', { name: authStrings.signInWithGoogle }).getAttribute('href'),
  ).toBe('/api/auth/google?returnTo=%2Ffitness-tracker');
});

test('shows no message when there is no error', () => {
  render(<SignInScreen returnTo="/" error={undefined} />);

  expect(screen.queryByRole('alert')).toBeNull();
});

test.each([
  ['cancelled', authStrings.errors.cancelled],
  ['not-allowed', authStrings.errors.notAllowed],
  ['expired', authStrings.errors.expired],
  ['unavailable', authStrings.errors.unavailable],
] satisfies [SignInError, string][])('explains the %s error', (error, message) => {
  render(<SignInScreen returnTo="/" error={error} />);

  expect(screen.getByRole('alert').textContent).toBe(message);
});
