import { notFound } from 'next/navigation';
import { listExercises } from '@/features/fitness-tracker/server/exercises';
import { requireFitnessContext } from '@/features/fitness-tracker/server/page-context';
import { getProgram } from '@/features/fitness-tracker/server/programs';
import { SlotEditScreen } from './SlotEditScreen';

type SlotEditPageProps = {
  params: Promise<{ programId: string; workoutId: string; slotId: string }>;
};

export default async function SlotEditPage({ params }: SlotEditPageProps) {
  const { programId, workoutId, slotId } = await params;
  const { db, profileId } = await requireFitnessContext(
    `/fitness-tracker/programs/${programId}/workouts/${workoutId}/slots/${slotId}`,
  );
  const program = await getProgram(db, profileId, programId);
  const slot = program.ok
    ? program.value.workouts
        .find((candidate) => candidate.id === workoutId)
        ?.slots.find((candidate) => candidate.id === slotId)
    : undefined;
  if (!program.ok || !slot) {
    notFound();
  }
  const exercises = await listExercises(db, profileId, { includeArchived: false });
  return (
    <SlotEditScreen
      programId={programId}
      workoutId={workoutId}
      slot={slot}
      blocks={program.value.blocks}
      exercises={exercises}
    />
  );
}
