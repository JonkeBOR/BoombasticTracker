import { AddSlotForm } from '@/features/fitness-tracker/components/AddSlotForm';
import { Screen } from '@/features/fitness-tracker/components/Screen';
import type { Exercise } from '@/features/fitness-tracker/domain/types';
import { fitnessStrings } from '@/lib/strings/fitness';

type AddSlotScreenProps = {
  programId: string;
  workoutId: string;
  exercises: readonly Exercise[];
};

export function AddSlotScreen({ programId, workoutId, exercises }: AddSlotScreenProps) {
  const workoutHref = `/fitness-tracker/programs/${programId}/workouts/${workoutId}`;

  return (
    <Screen
      title={fitnessStrings.workoutEdit.addExercise}
      back={{ href: workoutHref, label: fitnessStrings.navigation.toWorkout }}
    >
      <AddSlotForm workoutId={workoutId} exercises={exercises} doneHref={workoutHref} />
    </Screen>
  );
}
