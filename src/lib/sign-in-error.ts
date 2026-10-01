const signInErrors = ['cancelled', 'not-allowed', 'expired', 'unavailable'] as const;

export type SignInError = (typeof signInErrors)[number];

function isSignInError(value: unknown): value is SignInError {
  return signInErrors.some((error) => error === value);
}

export function parseSignInError(value: string | string[] | undefined): SignInError | undefined {
  return isSignInError(value) ? value : undefined;
}
