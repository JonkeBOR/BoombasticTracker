import { redirect } from 'next/navigation';
import { requireFitnessContext } from '@/features/fitness-tracker/server/page-context';
import { getTrainingOverview } from '@/features/fitness-tracker/server/training';
import { ActiveProgramScreen } from './ActiveProgramScreen';

export default async function ActiveProgramPage() {
  const { db, profileId } = await requireFitnessContext('/fitness-tracker/active');
  const overview = await getTrainingOverview(db, profileId);
  if (overview === null) {
    redirect('/fitness-tracker');
  }
  return <ActiveProgramScreen overview={overview} />;
}
