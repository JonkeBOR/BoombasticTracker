import { requireFitnessContext } from '@/features/fitness-tracker/server/page-context';
import { listPrograms } from '@/features/fitness-tracker/server/programs';
import { ProgramsScreen } from './ProgramsScreen';

export default async function ProgramsPage() {
  const { db, profileId } = await requireFitnessContext('/fitness-tracker/programs');
  return <ProgramsScreen programs={await listPrograms(db, profileId)} />;
}
