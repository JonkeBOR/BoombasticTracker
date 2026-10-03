'use client';

import Link from 'next/link';
import { fitnessStrings } from '@/lib/strings/fitness';
import { ConfirmActionButton } from './ConfirmActionButton';
import { InlineError } from './InlineError';
import { MoveButtons } from './MoveButtons';
import { RenameForm } from './RenameForm';
import styles from './WorkoutRow.module.css';
import { useFitnessAction } from './useFitnessAction';

type WorkoutRowProps = {
  programId: string;
  workout: { id: string; name: string };
  index: number;
  count: number;
  removeMessage: string;
};

export function WorkoutRow({ programId, workout, index, count, removeMessage }: WorkoutRowProps) {
  const action = useFitnessAction();
  const url = `/api/fitness/workouts/${workout.id}`;

  return (
    <div className={styles.row}>
      <Link
        className={styles.name}
        href={`/fitness-tracker/programs/${programId}/workouts/${workout.id}`}
      >
        {workout.name}
      </Link>
      <div className={styles.actions}>
        <MoveButtons
          itemName={workout.name}
          index={index}
          count={count}
          disabled={action.pending}
          onMove={(toPosition) => void action.run('PATCH', url, { toPosition })}
        />
        <RenameForm
          label={fitnessStrings.programEdit.workoutNameLabel}
          currentName={workout.name}
          url={url}
          isCollapsible
        />
        <ConfirmActionButton
          triggerLabel={fitnessStrings.programEdit.removeWorkoutFor(workout.name)}
          message={removeMessage}
          confirmLabel={fitnessStrings.programEdit.removeWorkoutConfirmLabel}
          method="DELETE"
          url={url}
        />
      </div>
      <InlineError message={action.errorMessage} />
    </div>
  );
}
