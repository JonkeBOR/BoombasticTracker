import { listExercises } from '@/features/fitness-tracker/server/exercises';
import { requireFitnessContext } from '@/features/fitness-tracker/server/page-context';
import { ExercisesScreen } from './ExercisesScreen';

export default async function ExercisesPage() {
  const { db, profileId } = await requireFitnessContext('/fitness-tracker/exercises');
  return (
    <ExercisesScreen exercises={await listExercises(db, profileId, { includeArchived: true })} />
  );
}
