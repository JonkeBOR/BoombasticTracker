import type { SignInError } from '@/lib/sign-in-error';
import { authStrings } from '@/lib/strings/auth';
import styles from './SignInScreen.module.css';

const errorMessages = {
  cancelled: authStrings.errors.cancelled,
  'not-allowed': authStrings.errors.notAllowed,
  expired: authStrings.errors.expired,
  unavailable: authStrings.errors.unavailable,
} as const satisfies Record<SignInError, string>;

type SignInScreenProps = {
  returnTo: string;
  error: SignInError | undefined;
};

export function SignInScreen({ returnTo, error }: SignInScreenProps) {
  const signInHref = `/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{authStrings.signInTitle}</h1>
      <p className={styles.intro}>{authStrings.signInIntro}</p>
      {error && (
        <p className={styles.error} role="alert">
          {errorMessages[error]}
        </p>
      )}
      <a className={styles.signIn} href={signInHref}>
        {authStrings.signInWithGoogle}
      </a>
    </main>
  );
}
