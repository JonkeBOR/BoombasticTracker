import { notFound } from 'next/navigation';
import { listExercises } from '@/features/fitness-tracker/server/exercises';
import { requireFitnessContext } from '@/features/fitness-tracker/server/page-context';
import { getProgram } from '@/features/fitness-tracker/server/programs';
import { WorkoutEditScreen } from './WorkoutEditScreen';

type WorkoutEditPageProps = { params: Promise<{ programId: string; workoutId: string }> };

export default async function WorkoutEditPage({ params }: WorkoutEditPageProps) {
  const { programId, workoutId } = await params;
  const { db, profileId } = await requireFitnessContext(
    `/fitness-tracker/programs/${programId}/workouts/${workoutId}`,
  );
  const program = await getProgram(db, profileId, programId);
  const workout = program.ok
    ? program.value.workouts.find((candidate) => candidate.id === workoutId)
    : undefined;
  if (!workout) {
    notFound();
  }
  const exercises = await listExercises(db, profileId, { includeArchived: false });
  return <WorkoutEditScreen programId={programId} workout={workout} exercises={exercises} />;
}
