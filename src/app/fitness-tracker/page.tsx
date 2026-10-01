import { requireSession } from '@/lib/server/session-cookie';
import { FitnessTrackerScreen } from './FitnessTrackerScreen';

export default async function FitnessTrackerPage() {
  await requireSession('/fitness-tracker');
  return <FitnessTrackerScreen />;
}
