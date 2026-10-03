'use client';

import { type LucideIcon, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { fitnessStrings } from '@/lib/strings/fitness';
import styles from './ConfirmDialog.module.css';

type ConfirmDialogProps = {
  triggerLabel: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  triggerClassName?: string;
  triggerIcon?: LucideIcon;
  triggerVariant?: TriggerVariant;
  disabled?: boolean;
};

export type TriggerVariant = 'labelled' | 'deleteIcon';

export function ConfirmDialog({
  triggerLabel,
  message,
  confirmLabel,
  onConfirm,
  triggerClassName,
  triggerIcon: TriggerIcon,
  triggerVariant = 'labelled',
  disabled = false,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  function confirm() {
    dialogRef.current?.close();
    onConfirm();
  }

  return (
    <>
      {triggerVariant === 'deleteIcon' ? (
        <button
          type="button"
          className={styles.deleteIcon}
          aria-label={triggerLabel}
          disabled={disabled}
          onClick={() => dialogRef.current?.showModal()}
        >
          <Trash2 className={styles.icon} aria-hidden="true" />
        </button>
      ) : (
        <button
          type="button"
          className={triggerClassName ?? styles.trigger}
          disabled={disabled}
          onClick={() => dialogRef.current?.showModal()}
        >
          {TriggerIcon ? <TriggerIcon className={styles.icon} aria-hidden="true" /> : null}
          {triggerLabel}
        </button>
      )}
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
