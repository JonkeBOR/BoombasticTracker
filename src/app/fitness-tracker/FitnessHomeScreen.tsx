import Link from 'next/link';
import { Screen } from '@/features/fitness-tracker/components/Screen';
import { WeighInRow } from '@/features/fitness-tracker/components/WeighInRow';
import type { TrainingOverview } from '@/features/fitness-tracker/domain/types';
import { featureStrings } from '@/lib/strings/features';
import { fitnessStrings } from '@/lib/strings/fitness';
import styles from './FitnessHomeScreen.module.css';

type FitnessHomeScreenProps = {
  isWeighInAvailable: boolean;
  lastEntryKg: number | null;
  overview: TrainingOverview | null;
};

function suggestedWorkoutName(overview: TrainingOverview): string | null {
  return (
    overview.workouts.find((workout) => workout.id === overview.suggestedWorkoutId)?.name ?? null
  );
}

function ActiveProgramCard({ overview }: { overview: TrainingOverview }) {
  const upNext = suggestedWorkoutName(overview);
  return (
    <Link className={styles.card} href="/fitness-tracker/active">
      <span className={styles.programName}>
        {fitnessStrings.home.currentProgram(overview.program.name)}
      </span>
      <span>
        {fitnessStrings.block.title(overview.currentBlock.number, overview.currentBlock.label)}
      </span>
      {upNext === null ? null : (
        <span className={styles.upNext}>{fitnessStrings.block.upNext(upNext)}</span>
      )}
    </Link>
  );
}

export function FitnessHomeScreen({
  isWeighInAvailable,
  lastEntryKg,
  overview,
}: FitnessHomeScreenProps) {
  return (
    <Screen
      title={fitnessStrings.home.title}
      back={{ href: '/', label: featureStrings.backToFeatures }}
    >
      <WeighInRow isAvailable={isWeighInAvailable} lastEntryKg={lastEntryKg} />
      {overview === null ? (
        <div className={styles.emptyCard}>
          <p className={styles.emptyTitle}>{fitnessStrings.home.noActiveProgram}</p>
          <Link className={styles.emptyLink} href="/fitness-tracker/programs">
            {fitnessStrings.home.chooseProgram}
          </Link>
        </div>
      ) : (
        <ActiveProgramCard overview={overview} />
      )}
      <nav className={styles.links}>
        <Link className={styles.link} href="/fitness-tracker/programs">
          {fitnessStrings.home.programsLink}
        </Link>
        <Link className={styles.link} href="/fitness-tracker/exercises">
          {fitnessStrings.home.exercisesLink}
        </Link>
      </nav>
    </Screen>
  );
}
