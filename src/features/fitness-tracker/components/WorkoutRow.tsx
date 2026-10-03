'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { fitnessStrings } from '@/lib/strings/fitness';
import { ConfirmDialog } from './ConfirmDialog';
import { InlineError } from './InlineError';
import styles from './WorkoutRow.module.css';
import { useFitnessAction } from './useFitnessAction';

type WorkoutRowProps = {
  programId: string;
  workout: { id: string; name: string };
  removeMessage: string;
  dragHandle: ReactNode;
};

export function WorkoutRow({ programId, workout, removeMessage, dragHandle }: WorkoutRowProps) {
  const removal = useFitnessAction();

  return (
    <div className={styles.row}>
      <div className={styles.line}>
        <Link
          className={styles.name}
          href={`/fitness-tracker/programs/${programId}/workouts/${workout.id}`}
        >
          {workout.name}
        </Link>
        <ConfirmDialog
          triggerVariant="deleteIcon"
          triggerLabel={fitnessStrings.programEdit.removeWorkoutFor(workout.name)}
          message={removeMessage}
          confirmLabel={fitnessStrings.programEdit.removeWorkoutConfirmLabel}
          disabled={removal.pending}
          onConfirm={() => void removal.run('DELETE', `/api/fitness/workouts/${workout.id}`)}
        />
        {dragHandle}
      </div>
      <InlineError message={removal.errorMessage} />
    </div>
  );
}
