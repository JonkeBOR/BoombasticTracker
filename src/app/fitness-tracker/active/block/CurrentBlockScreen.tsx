import Link from 'next/link';
import { Screen } from '@/features/fitness-tracker/components/Screen';
import { StartWorkoutButton } from '@/features/fitness-tracker/components/StartWorkoutButton';
import type { TrainingOverview } from '@/features/fitness-tracker/domain/types';
import { formatShortDate } from '@/features/fitness-tracker/domain/values';
import { fitnessStrings } from '@/lib/strings/fitness';
import styles from './CurrentBlockScreen.module.css';

type CurrentBlockScreenProps = {
  overview: TrainingOverview;
  completedBlock: number | null;
  startedAgain: boolean;
  timeZone: string;
};

type WorkoutEntry = TrainingOverview['workouts'][number];

function WorkoutRow({
  workout,
  isSuggested,
  timeZone,
}: {
  workout: WorkoutEntry;
  isSuggested: boolean;
  timeZone: string;
}) {
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

export function CurrentBlockScreen({
  overview,
  completedBlock,
  startedAgain,
  timeZone,
}: CurrentBlockScreenProps) {
  return (
    <Screen
      title={fitnessStrings.block.title(overview.currentBlock.number, overview.currentBlock.label)}
      back={{ href: '/fitness-tracker/active', label: fitnessStrings.navigation.toActiveProgram }}
    >
      {completedBlock === null ? null : (
        <p role="status" className={styles.notice}>
          {startedAgain
            ? fitnessStrings.block.programComplete
            : fitnessStrings.block.blockComplete(completedBlock)}
        </p>
      )}
      {overview.workouts.length === 0 ? (
        <p className={styles.empty}>{fitnessStrings.block.noWorkouts}</p>
      ) : (
        <ul className={styles.list}>
          {overview.workouts.map((workout) => (
            <li key={workout.id}>
              <WorkoutRow
                workout={workout}
                isSuggested={workout.id === overview.suggestedWorkoutId}
                timeZone={timeZone}
              />
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}
