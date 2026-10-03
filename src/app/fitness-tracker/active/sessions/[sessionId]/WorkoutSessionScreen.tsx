import { Screen } from '@/features/fitness-tracker/components/Screen';
import { SessionBody } from '@/features/fitness-tracker/components/SessionBody';
import type { SessionView } from '@/features/fitness-tracker/domain/types';
import { fitnessStrings } from '@/lib/strings/fitness';

type WorkoutSessionScreenProps = { session: SessionView };

export function WorkoutSessionScreen({ session }: WorkoutSessionScreenProps) {
  return (
    <Screen
      title={fitnessStrings.session.heading(session.workout.name, session.block.number)}
      back={{ href: '/fitness-tracker/active/block', label: fitnessStrings.navigation.toBlock }}
    >
      <SessionBody session={session} />
    </Screen>
  );
}
