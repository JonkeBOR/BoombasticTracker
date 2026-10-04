import { BlockWorkoutRow } from '@/features/fitness-tracker/components/BlockWorkoutRow';
import { Screen } from '@/features/fitness-tracker/components/Screen';
import type { TrainingOverview } from '@/features/fitness-tracker/domain/types';
import { fitnessStrings } from '@/lib/strings/fitness';
import styles from './CurrentBlockScreen.module.css';

type CurrentBlockScreenProps = {
  overview: TrainingOverview;
  completedBlock: number | null;
  startedAgain: boolean;
  timeZone: string;
};

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
              <BlockWorkoutRow
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
