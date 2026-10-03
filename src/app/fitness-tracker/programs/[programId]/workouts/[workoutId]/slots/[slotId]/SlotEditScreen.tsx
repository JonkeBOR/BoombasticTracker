import { OptionalToggle } from '@/features/fitness-tracker/components/OptionalToggle';
import { PrescriptionSection } from '@/features/fitness-tracker/components/PrescriptionSection';
import { ReplaceExercise } from '@/features/fitness-tracker/components/ReplaceExercise';
import { Screen } from '@/features/fitness-tracker/components/Screen';
import type { BlockView, Exercise, SlotView } from '@/features/fitness-tracker/domain/types';
import { fitnessStrings } from '@/lib/strings/fitness';
import styles from './SlotEditScreen.module.css';

type SlotEditScreenProps = {
  programId: string;
  workoutId: string;
  slot: SlotView;
  blocks: readonly BlockView[];
  exercises: readonly Exercise[];
};

function targetsOf(slot: SlotView, blockId: string): number[] {
  const prescription = slot.prescriptions.find((candidate) => candidate.blockId === blockId);
  return prescription?.plannedSets.map((set) => set.targetReps) ?? [];
}

export function SlotEditScreen({
  programId,
  workoutId,
  slot,
  blocks,
  exercises,
}: SlotEditScreenProps) {
  return (
    <Screen
      title={slot.exercise.name}
      back={{
        href: `/fitness-tracker/programs/${programId}/workouts/${workoutId}`,
        label: fitnessStrings.navigation.toWorkout,
      }}
    >
      <ReplaceExercise
        slotId={slot.id}
        currentExerciseId={slot.exercise.id}
        exercises={exercises}
      />
      <OptionalToggle slotId={slot.id} isOptional={slot.isOptional} />
      <div className={styles.blocks}>
        {blocks.map((block, index) => {
          const plannedSets =
            slot.prescriptions.find((candidate) => candidate.blockId === block.id)?.plannedSets ??
            [];
          const previousBlock = blocks[index - 1];
          return (
            <PrescriptionSection
              key={`${block.id}:${plannedSets.map((set) => `${set.id}-${set.targetReps}`).join(',')}`}
              slotId={slot.id}
              blockId={block.id}
              title={fitnessStrings.slotEdit.blockTitle(block.number, block.label)}
              plannedSets={plannedSets}
              previousTargets={previousBlock ? targetsOf(slot, previousBlock.id) : null}
            />
          );
        })}
      </div>
    </Screen>
  );
}
