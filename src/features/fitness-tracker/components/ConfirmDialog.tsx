'use client';

import { useRef } from 'react';
import { fitnessStrings } from '@/lib/strings/fitness';
import styles from './ConfirmDialog.module.css';

type ConfirmDialogProps = {
  triggerLabel: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  triggerClassName?: string;
  disabled?: boolean;
};

export function ConfirmDialog({
  triggerLabel,
  message,
  confirmLabel,
  onConfirm,
  triggerClassName,
  disabled = false,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  function confirm() {
    dialogRef.current?.close();
    onConfirm();
  }

  return (
    <>
      <button
        type="button"
        className={triggerClassName ?? styles.trigger}
        disabled={disabled}
        onClick={() => dialogRef.current?.showModal()}
      >
        {triggerLabel}
      </button>
      <dialog ref={dialogRef} className={styles.dialog}>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancel}
            onClick={() => dialogRef.current?.close()}
          >
            {fitnessStrings.common.cancel}
          </button>
          <button type="button" className={styles.confirm} onClick={confirm}>
            {confirmLabel}
          </button>
        </div>
      </dialog>
    </>
  );
}
