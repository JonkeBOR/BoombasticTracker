import { ActivateButton } from '@/features/fitness-tracker/components/ActivateButton';
import { ActionButton } from '@/features/fitness-tracker/components/ActionButton';
import { AddNameForm } from '@/features/fitness-tracker/components/AddNameForm';
import { BlockRow } from '@/features/fitness-tracker/components/BlockRow';
import { DeleteProgramButton } from '@/features/fitness-tracker/components/DeleteProgramButton';
import { PauseButton } from '@/features/fitness-tracker/components/PauseButton';
import { RenameForm } from '@/features/fitness-tracker/components/RenameForm';
import { Screen } from '@/features/fitness-tracker/components/Screen';
import { WorkoutRow } from '@/features/fitness-tracker/components/WorkoutRow';
import type { BlockView, Program } from '@/features/fitness-tracker/domain/types';
import Link from 'next/link';
import { fitnessStrings } from '@/lib/strings/fitness';
import styles from './ProgramEditScreen.module.css';

type ProgramEditScreenProps = {
  program: Program;
  otherActiveProgramName: string | null;
  inProgressWorkoutIds: readonly string[];
};

const blocksHeadingId = 'program-blocks-heading';
const workoutsHeadingId = 'program-workouts-heading';

function blockRemoveMessage(program: Program, block: BlockView, index: number): string {
  if (block.id !== program.cycle.currentBlockId) {
    return fitnessStrings.programEdit.removeBlockPlain(block.number);
  }
  const next = program.blocks[index + 1];
  return next === undefined
    ? fitnessStrings.programEdit.removeCurrentBlockStartsAgain(block.number)
    : fitnessStrings.programEdit.removeCurrentBlockMovesOn(block.number, next.number);
}

function workoutRemoveMessage(program: Program, name: string, isInProgress: boolean): string {
  return [
    fitnessStrings.programEdit.removeWorkoutPlain(name),
    isInProgress ? fitnessStrings.programEdit.removeWorkoutInProgress : null,
    program.isActive ? fitnessStrings.programEdit.removeWorkoutMovesOn : null,
  ]
    .filter((sentence) => sentence !== null)
    .join(' ');
}

export function ProgramEditScreen({
  program,
  otherActiveProgramName,
  inProgressWorkoutIds,
}: ProgramEditScreenProps) {
  return (
    <Screen
      title={program.name}
      back={{ href: '/fitness-tracker/programs', label: fitnessStrings.navigation.toPrograms }}
    >
      <RenameForm
        label={fitnessStrings.programEdit.nameLabel}
        currentName={program.name}
        url={`/api/fitness/programs/${program.id}`}
      />
      <div className={styles.status}>
        {program.isActive ? (
          <>
            <span className={styles.badge}>{fitnessStrings.programEdit.active}</span>
            <PauseButton triggerLabel={fitnessStrings.programEdit.pause} />
            <Link className={styles.link} href="/fitness-tracker/active">
              {fitnessStrings.programEdit.openActiveProgram}
            </Link>
          </>
        ) : (
          <ActivateButton programId={program.id} otherActiveProgramName={otherActiveProgramName} />
        )}
      </div>
      {program.isActive ? (
        <p className={styles.note}>{fitnessStrings.programEdit.futureOnlyNote}</p>
      ) : null}

      <section className={styles.section}>
        <h2 id={blocksHeadingId} className={styles.heading}>
          {fitnessStrings.programEdit.blocksTitle}
        </h2>
        <ul className={styles.list} aria-labelledby={blocksHeadingId}>
          {program.blocks.map((block, index) => (
            <li key={block.id}>
              <BlockRow
                block={block}
                canRemove={program.blocks.length > 1}
                removeMessage={blockRemoveMessage(program, block, index)}
              />
            </li>
          ))}
        </ul>
        <ActionButton
          label={fitnessStrings.programEdit.addBlock}
          method="POST"
          url={`/api/fitness/programs/${program.id}/blocks`}
          body={{}}
        />
      </section>

      <section className={styles.section}>
        <h2 id={workoutsHeadingId} className={styles.heading}>
          {fitnessStrings.programEdit.workoutsTitle}
        </h2>
        {program.workouts.length === 0 ? (
          <p className={styles.empty}>{fitnessStrings.programEdit.noWorkouts}</p>
        ) : (
          <ul className={styles.list} aria-labelledby={workoutsHeadingId}>
            {program.workouts.map((workout, index) => (
              <li key={workout.id}>
                <WorkoutRow
                  programId={program.id}
                  workout={workout}
                  index={index}
                  count={program.workouts.length}
                  removeMessage={workoutRemoveMessage(
                    program,
                    workout.name,
                    inProgressWorkoutIds.includes(workout.id),
                  )}
                />
              </li>
            ))}
          </ul>
        )}
        <AddNameForm
          label={fitnessStrings.programEdit.workoutNameLabel}
          submitLabel={fitnessStrings.programEdit.addWorkout}
          url={`/api/fitness/programs/${program.id}/workouts`}
        />
      </section>

      {program.isActive ? null : <DeleteProgramButton programId={program.id} />}
    </Screen>
  );
}
