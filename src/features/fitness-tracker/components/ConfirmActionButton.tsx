'use client';

import { ConfirmDialog } from './ConfirmDialog';
import { InlineError } from './InlineError';
import styles from './ConfirmActionButton.module.css';
import { useFitnessAction } from './useFitnessAction';

type Method = 'POST' | 'PATCH' | 'PUT' | 'DELETE';

type ConfirmActionButtonProps = {
  triggerLabel: string;
  message: string;
  confirmLabel: string;
  method: Method;
  url: string;
  body?: unknown;
  onSuccess?: (value: unknown) => void;
  disabled?: boolean;
};

export function ConfirmActionButton({
  triggerLabel,
  message,
  confirmLabel,
  method,
  url,
  body,
  onSuccess,
  disabled = false,
}: ConfirmActionButtonProps) {
  const action = useFitnessAction();

  return (
    <span className={styles.wrapper}>
      <ConfirmDialog
        triggerLabel={triggerLabel}
        message={message}
        confirmLabel={confirmLabel}
        disabled={disabled || action.pending}
        onConfirm={() => void action.run(method, url, body, onSuccess)}
      />
      <InlineError message={action.errorMessage} />
    </span>
  );
}
