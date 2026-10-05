import { OptionalToggle } from '@/features/fitness-tracker/components/OptionalToggle';
import { PeriodizationToggle } from '@/features/fitness-tracker/components/PeriodizationToggle';
import { PrescriptionSection } from '@/features/fitness-tracker/components/PrescriptionSection';
import { ReplaceExercise } from '@/features/fitness-tracker/components/ReplaceExercise';
import { Screen } from '@/features/fitness-tracker/components/Screen';
import { UniformPrescriptionSection } from '@/features/fitness-tracker/components/UniformPrescriptionSection';
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

function hasLastWeights(slot: SlotView): boolean {
  return slot.prescriptions.some((prescription) =>
    prescription.plannedSets.some((set) => set.lastWeightKg !== null),
  );
}

export function SlotEditScreen({
  programId,
  workoutId,
  slot,
  blocks,
  exercises,
}: SlotEditScreenProps) {
  const firstBlockSets = slot.prescriptions[0]?.plannedSets ?? [];
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
      <PeriodizationToggle
        key={String(slot.isPeriodized)}
        slotId={slot.id}
        isPeriodized={slot.isPeriodized}
        firstBlockSets={firstBlockSets}
        hasLastWeights={hasLastWeights(slot)}
      />
      {slot.isPeriodized ? null : (
        <UniformPrescriptionSection slotId={slot.id} plannedSets={firstBlockSets} />
      )}
      {slot.isPeriodized ? (
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
      ) : null}
    </Screen>
  );
}
