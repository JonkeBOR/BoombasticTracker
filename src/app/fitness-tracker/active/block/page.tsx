import { redirect } from 'next/navigation';
import { requireFitnessContext } from '@/features/fitness-tracker/server/page-context';
import { readTimeZone } from '@/features/fitness-tracker/server/time-zone';
import { getTrainingOverview } from '@/features/fitness-tracker/server/training';
import { CurrentBlockScreen } from './CurrentBlockScreen';

type CurrentBlockPageProps = { searchParams: Promise<{ completed?: string }> };

function parseCompletedBlock(value: string | undefined): number | null {
  const parsed = value === undefined ? Number.NaN : Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
}

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
