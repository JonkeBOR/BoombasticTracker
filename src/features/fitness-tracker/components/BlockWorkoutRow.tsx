import Link from 'next/link';
import type { TrainingOverview } from '../domain/types';
import { formatShortDate } from '../domain/values';
import { fitnessStrings } from '@/lib/strings/fitness';
import styles from './BlockWorkoutRow.module.css';
import { StartWorkoutButton } from './StartWorkoutButton';

type BlockWorkoutRowProps = {
  workout: TrainingOverview['workouts'][number];
  isSuggested: boolean;
  timeZone: string;
};

export function BlockWorkoutRow({ workout, isSuggested, timeZone }: BlockWorkoutRowProps) {
  if (workout.status === 'not-started') {
    return (
      <StartWorkoutButton
        workoutId={workout.id}
        workoutName={workout.name}
        isSuggested={isSuggested}
      />
    );
  }
  if (workout.status === 'in-progress' && workout.sessionId !== null) {
    return (
      <Link
        className={isSuggested ? styles.suggested : styles.row}
        href={`/fitness-tracker/active/sessions/${workout.sessionId}`}
      >
        <span className={styles.name}>{workout.name}</span>
        <span className={styles.status}>{fitnessStrings.block.inProgress}</span>
        {isSuggested ? <span className={styles.tag}>{fitnessStrings.block.suggested}</span> : null}
      </Link>
    );
  }
  return (
    <div className={styles.finished}>
      <span className={styles.name}>{workout.name}</span>
      {workout.finishedAt === null ? null : (
        <span className={styles.status}>
          {fitnessStrings.block.finishedOn(formatShortDate(workout.finishedAt, timeZone))}
        </span>
      )}
    </div>
  );
}
