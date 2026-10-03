import { Screen } from '@/features/fitness-tracker/components/Screen';
import { fitnessStrings } from '@/lib/strings/fitness';

export default function FitnessTrackerNotFound() {
  return (
    <Screen
      title={fitnessStrings.notFound.title}
      back={{ href: '/fitness-tracker', label: fitnessStrings.navigation.toHome }}
    >
      <p>{fitnessStrings.notFound.body}</p>
    </Screen>
  );
}
