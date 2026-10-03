'use client';

import { useRouter } from 'next/navigation';
import { fitnessStrings } from '@/lib/strings/fitness';
import { InlineError } from './InlineError';
import { readStringField } from './read-id';
import styles from './StartWorkoutButton.module.css';
import { useFitnessAction } from './useFitnessAction';

type StartWorkoutButtonProps = {
  workoutId: string;
  workoutName: string;
  isSuggested: boolean;
};

export function StartWorkoutButton({
  workoutId,
  workoutName,
  isSuggested,
}: StartWorkoutButtonProps) {
  const router = useRouter();
  const action = useFitnessAction();

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={isSuggested ? styles.suggested : styles.button}
        disabled={action.pending}
        onClick={() =>
          void action.run('POST', `/api/fitness/workouts/${workoutId}/session`, {}, (body) => {
            const sessionId = readStringField(body, 'sessionId');
            if (sessionId !== null) {
              router.push(`/fitness-tracker/active/sessions/${sessionId}`);
            }
          })
        }
      >
        <span className={styles.name}>{workoutName}</span>
        <span className={styles.status}>{fitnessStrings.block.notStarted}</span>
        {isSuggested ? <span className={styles.tag}>{fitnessStrings.block.suggested}</span> : null}
      </button>
      <InlineError message={action.errorMessage} />
    </div>
  );
}
