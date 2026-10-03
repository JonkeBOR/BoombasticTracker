import { AddNameForm } from '@/features/fitness-tracker/components/AddNameForm';
import { ExerciseList } from '@/features/fitness-tracker/components/ExerciseList';
import { Screen } from '@/features/fitness-tracker/components/Screen';
import type { Exercise } from '@/features/fitness-tracker/domain/types';
import { fitnessStrings } from '@/lib/strings/fitness';

type ExercisesScreenProps = { exercises: readonly Exercise[] };

export function ExercisesScreen({ exercises }: ExercisesScreenProps) {
  return (
    <Screen
      title={fitnessStrings.exercises.title}
      back={{ href: '/fitness-tracker', label: fitnessStrings.navigation.toHome }}
    >
      <AddNameForm
        label={fitnessStrings.exercises.nameLabel}
        submitLabel={fitnessStrings.exercises.add}
        url="/api/fitness/exercises"
      />
      <ExerciseList exercises={exercises} />
    </Screen>
  );
}
