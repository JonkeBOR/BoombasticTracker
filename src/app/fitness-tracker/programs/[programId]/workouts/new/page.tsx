import { notFound } from 'next/navigation';
import { requireFitnessContext } from '@/features/fitness-tracker/server/page-context';
import { getProgram } from '@/features/fitness-tracker/server/programs';
import { WorkoutEditScreen } from '../[workoutId]/WorkoutEditScreen';

type NewWorkoutPageProps = { params: Promise<{ programId: string }> };

export default async function NewWorkoutPage({ params }: NewWorkoutPageProps) {
  const { programId } = await params;
  const { db, profileId } = await requireFitnessContext(
    `/fitness-tracker/programs/${programId}/workouts/new`,
  );
  const program = await getProgram(db, profileId, programId);
  if (!program.ok) {
    notFound();
  }
  return <WorkoutEditScreen programId={programId} workout={null} />;
}
