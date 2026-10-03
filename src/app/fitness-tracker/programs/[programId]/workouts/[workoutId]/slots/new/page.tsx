import { notFound } from 'next/navigation';
import { exercisesAvailableFor } from '@/features/fitness-tracker/domain/exercise';
import { listExercises } from '@/features/fitness-tracker/server/exercises';
import { requireFitnessContext } from '@/features/fitness-tracker/server/page-context';
import { getProgram } from '@/features/fitness-tracker/server/programs';
import { AddSlotScreen } from './AddSlotScreen';

type AddSlotPageProps = { params: Promise<{ programId: string; workoutId: string }> };

export default async function AddSlotPage({ params }: AddSlotPageProps) {
  const { programId, workoutId } = await params;
  const { db, profileId } = await requireFitnessContext(
    `/fitness-tracker/programs/${programId}/workouts/${workoutId}/slots/new`,
  );
  const program = await getProgram(db, profileId, programId);
  const workout = program.ok
    ? program.value.workouts.find((candidate) => candidate.id === workoutId)
    : undefined;
  if (!workout) {
    notFound();
  }
  const exercises = await listExercises(db, profileId, { includeArchived: false });
  return (
    <AddSlotScreen
      programId={programId}
      workoutId={workoutId}
      exercises={exercisesAvailableFor(exercises, workout.slots)}
    />
  );
}
