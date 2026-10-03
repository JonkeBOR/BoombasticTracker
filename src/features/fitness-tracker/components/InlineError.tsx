import styles from './InlineError.module.css';

type InlineErrorProps = { message: string | null };

export function InlineError({ message }: InlineErrorProps) {
  if (message === null) {
    return null;
  }
  return (
    <p role="alert" className={styles.error}>
      {message}
    </p>
  );
}
