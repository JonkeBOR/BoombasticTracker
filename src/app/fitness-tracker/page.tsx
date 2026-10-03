import { getWeighInStatus, listBodyweight } from '@/features/fitness-tracker/server/bodyweight';
import { requireFitnessContext } from '@/features/fitness-tracker/server/page-context';
import { readTimeZone } from '@/features/fitness-tracker/server/time-zone';
import { getTrainingOverview } from '@/features/fitness-tracker/server/training';
import { FitnessHomeScreen } from './FitnessHomeScreen';

export default async function FitnessTrackerPage() {
  const { db, profileId, now } = await requireFitnessContext('/fitness-tracker');
  const timeZone = await readTimeZone();
  const [status, entries, overview] = await Promise.all([
    getWeighInStatus(db, profileId, now, timeZone),
    listBodyweight(db, profileId),
    getTrainingOverview(db, profileId),
  ]);
  return (
    <FitnessHomeScreen
      isWeighInAvailable={status.ok && status.value.isAvailable}
      lastEntryKg={entries[entries.length - 1]?.weightKg ?? null}
      overview={overview}
    />
  );
}
