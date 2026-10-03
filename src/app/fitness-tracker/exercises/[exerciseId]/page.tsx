import { notFound } from 'next/navigation';
import { getExerciseUsage } from '@/features/fitness-tracker/server/exercises';
import { requireFitnessContext } from '@/features/fitness-tracker/server/page-context';
import { ExerciseEditScreen } from './ExerciseEditScreen';

type ExerciseEditPageProps = { params: Promise<{ exerciseId: string }> };

export default async function ExerciseEditPage({ params }: ExerciseEditPageProps) {
  const { exerciseId } = await params;
  const { db, profileId } = await requireFitnessContext(`/fitness-tracker/exercises/${exerciseId}`);
  const usage = await getExerciseUsage(db, profileId, exerciseId);
  if (!usage.ok) {
    notFound();
  }
  return <ExerciseEditScreen usage={usage.value} />;
}
