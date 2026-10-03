import { notFound, redirect } from 'next/navigation';
import { requireFitnessContext } from '@/features/fitness-tracker/server/page-context';
import { getSession } from '@/features/fitness-tracker/server/training';
import { WorkoutSessionScreen } from './WorkoutSessionScreen';

type WorkoutSessionPageProps = { params: Promise<{ sessionId: string }> };

export default async function WorkoutSessionPage({ params }: WorkoutSessionPageProps) {
  const { sessionId } = await params;
  const { db, profileId } = await requireFitnessContext(
    `/fitness-tracker/active/sessions/${sessionId}`,
  );
  const session = await getSession(db, profileId, sessionId);
  if (!session.ok) {
    notFound();
  }
  if (session.value.status === 'finished') {
    redirect('/fitness-tracker/active/block');
  }
  return <WorkoutSessionScreen session={session.value} />;
}
