import Link from 'next/link';
import { PauseButton } from '@/features/fitness-tracker/components/PauseButton';
import { Screen } from '@/features/fitness-tracker/components/Screen';
import { SkipToBlockCard } from '@/features/fitness-tracker/components/SkipToBlockCard';
import { decideSkip } from '@/features/fitness-tracker/domain/progression';
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

function skipMessage(
  target: BlockProgress,
  overview: TrainingOverview,
  hasOpenWorkout: boolean,
): string {
  const base =
    target.id === overview.blocks[0]?.id
      ? fitnessStrings.activeProgram.skipConfirmStartAgain
      : fitnessStrings.activeProgram.skipConfirmLater(
          target.number,
          overview.currentBlock.number,
          target.number - 1,
        );
  return hasOpenWorkout ? `${base} ${fitnessStrings.activeProgram.skipOpenWorkout}` : base;
}

function skipLabel(target: BlockProgress, overview: TrainingOverview): string {
  const title = fitnessStrings.block.title(target.number, target.label);
  return target.id === overview.blocks[0]?.id
    ? fitnessStrings.activeProgram.startAgainAtFor(title)
    : fitnessStrings.activeProgram.skipToFor(title);
}

export function ActiveProgramScreen({ overview }: ActiveProgramScreenProps) {
  const hasOpenWorkout = overview.workouts.some((workout) => workout.status === 'in-progress');
  const blockIds = overview.blocks.map((block) => block.id);
  const canSkipTo = (block: BlockProgress) =>
    decideSkip({ blockIds, currentBlockId: overview.currentBlock.id, targetBlockId: block.id }).ok;

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
            ) : canSkipTo(block) ? (
              <SkipToBlockCard
                blockId={block.id}
                label={skipLabel(block, overview)}
                message={skipMessage(block, overview, hasOpenWorkout)}
                className={styles.skippable}
              >
                <BlockSummary block={block} workoutCount={overview.workoutCount} />
              </SkipToBlockCard>
            ) : (
              <div className={styles.other}>
                <BlockSummary block={block} workoutCount={overview.workoutCount} />
              </div>
            )}
          </li>
        ))}
      </ul>
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
