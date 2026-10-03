'use client';

import { InlineError } from './InlineError';
import styles from './ActionButton.module.css';
import { useFitnessAction } from './useFitnessAction';

type Method = 'POST' | 'PATCH' | 'PUT' | 'DELETE';

type ActionButtonProps = {
  label: string;
  method: Method;
  url: string;
  body?: unknown;
  isPrimary?: boolean;
  disabled?: boolean;
  onSuccess?: (value: unknown) => void;
};

export function ActionButton({
  label,
  method,
  url,
  body,
  isPrimary = false,
  disabled = false,
  onSuccess,
}: ActionButtonProps) {
  const action = useFitnessAction();

  return (
    <span className={styles.wrapper}>
      <button
        type="button"
        className={isPrimary ? styles.primary : styles.button}
        disabled={disabled || action.pending}
        onClick={() => void action.run(method, url, body, onSuccess)}
      >
        {label}
      </button>
      <InlineError message={action.errorMessage} />
    </span>
  );
}
