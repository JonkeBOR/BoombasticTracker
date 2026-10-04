import { redirect } from 'next/navigation';
import { parseCompletedBlock } from '@/features/fitness-tracker/domain/values';
import { requireFitnessContext } from '@/features/fitness-tracker/server/page-context';
import { readTimeZone } from '@/features/fitness-tracker/server/time-zone';
import { getTrainingOverview } from '@/features/fitness-tracker/server/training';
import { CurrentBlockScreen } from './CurrentBlockScreen';

type CurrentBlockPageProps = { searchParams: Promise<{ completed?: string }> };

export default async function CurrentBlockPage({ searchParams }: CurrentBlockPageProps) {
  const { completed } = await searchParams;
  const { db, profileId } = await requireFitnessContext('/fitness-tracker/active/block');
  const overview = await getTrainingOverview(db, profileId);
  if (overview === null) {
    redirect('/fitness-tracker');
  }
  const completedBlock = parseCompletedBlock(completed);
  return (
    <CurrentBlockScreen
      overview={overview}
      completedBlock={completedBlock}
      startedAgain={completedBlock !== null && overview.currentBlock.number === 1}
      timeZone={await readTimeZone()}
    />
  );
}
