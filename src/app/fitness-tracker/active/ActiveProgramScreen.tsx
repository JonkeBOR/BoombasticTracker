import Link from 'next/link';
import { PauseButton } from '@/features/fitness-tracker/components/PauseButton';
import { Screen } from '@/features/fitness-tracker/components/Screen';
import { SkipToBlockButton } from '@/features/fitness-tracker/components/SkipToBlockButton';
import type { BlockProgress, TrainingOverview } from '@/features/fitness-tracker/domain/types';
import { fitnessStrings } from '@/lib/strings/fitness';
import styles from './ActiveProgramScreen.module.css';

type ActiveProgramScreenProps = { overview: TrainingOverview };

const blocksHeadingId = 'active-blocks-heading';

function BlockSummary({ block, workoutCount }: { block: BlockProgress; workoutCount: number }) {
  return (
    <>
      <span className={styles.name}>{fitnessStrings.block.title(block.number, block.label)}</span>
      <span className={styles.progress}>
        {fitnessStrings.activeProgram.progress(block.finishedCount, workoutCount)}
      </span>
      <span className={styles.status}>{fitnessStrings.activeProgram.status[block.status]}</span>
    </>
  );
}

export function ActiveProgramScreen({ overview }: ActiveProgramScreenProps) {
  const hasOpenWorkout = overview.workouts.some((workout) => workout.status === 'in-progress');

  return (
    <Screen
      title={overview.program.name}
      back={{ href: '/fitness-tracker', label: fitnessStrings.navigation.toHome }}
    >
      <h2 id={blocksHeadingId} className={styles.heading}>
        {fitnessStrings.activeProgram.blocksTitle}
      </h2>
      <ul className={styles.blocks} aria-labelledby={blocksHeadingId}>
        {overview.blocks.map((block) => (
          <li key={block.id}>
            {block.id === overview.currentBlock.id ? (
              <Link className={styles.current} href="/fitness-tracker/active/block">
                <BlockSummary block={block} workoutCount={overview.workoutCount} />
              </Link>
            ) : (
              <div className={styles.other}>
                <BlockSummary block={block} workoutCount={overview.workoutCount} />
              </div>
            )}
          </li>
        ))}
      </ul>
      <SkipToBlockButton
        blocks={overview.blocks}
        currentBlockId={overview.currentBlock.id}
        hasOpenWorkout={hasOpenWorkout}
      />
      <div className={styles.actions}>
        <PauseButton
          triggerLabel={fitnessStrings.activeProgram.pause}
          redirectTo="/fitness-tracker"
        />
        <Link className={styles.edit} href={`/fitness-tracker/programs/${overview.program.id}`}>
          {fitnessStrings.activeProgram.editProgram}
        </Link>
      </div>
    </Screen>
  );
}
