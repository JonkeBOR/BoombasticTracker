'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { fitnessStrings } from '@/lib/strings/fitness';
import { summarize } from '../domain/prescription-edit';
import type { SlotView } from '../domain/types';
import { ConfirmDialog } from './ConfirmDialog';
import { InlineError } from './InlineError';
import styles from './SlotRow.module.css';
import { useFitnessAction } from './useFitnessAction';

type SlotRowProps = {
  programId: string;
  workoutId: string;
  slot: SlotView;
  dragHandle: ReactNode;
};

export function SlotRow({ programId, workoutId, slot, dragHandle }: SlotRowProps) {
  const removal = useFitnessAction();

  return (
    <div className={styles.row}>
      <div className={slot.isOptional ? styles.optionalCard : styles.card}>
        <Link
          className={styles.link}
          href={`/fitness-tracker/programs/${programId}/workouts/${workoutId}/slots/${slot.id}`}
        >
          <span className={styles.name}>{slot.exercise.name}</span>
          {slot.isOptional ? (
            <span className={styles.tag}>{fitnessStrings.common.optional}</span>
          ) : null}
          <span className={styles.summary}>{summarize(slot.prescriptions)}</span>
        </Link>
        <ConfirmDialog
          triggerVariant="deleteIcon"
          triggerLabel={fitnessStrings.workoutEdit.removeSlotFor(slot.exercise.name)}
          message={fitnessStrings.workoutEdit.removeSlotConfirm(slot.exercise.name)}
          confirmLabel={fitnessStrings.workoutEdit.removeSlotConfirmLabel}
          disabled={removal.pending}
          onConfirm={() => void removal.run('DELETE', `/api/fitness/slots/${slot.id}`)}
        />
        {dragHandle}
      </div>
      <InlineError message={removal.errorMessage} />
    </div>
  );
}
