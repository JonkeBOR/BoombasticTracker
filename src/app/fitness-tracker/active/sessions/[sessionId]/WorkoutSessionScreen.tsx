import { FinishWorkoutButton } from '@/features/fitness-tracker/components/FinishWorkoutButton';
import { Screen } from '@/features/fitness-tracker/components/Screen';
import { SessionBody } from '@/features/fitness-tracker/components/SessionBody';
import type { SessionView } from '@/features/fitness-tracker/domain/types';
import { fitnessStrings } from '@/lib/strings/fitness';

type WorkoutSessionScreenProps = { session: SessionView };

export function WorkoutSessionScreen({ session }: WorkoutSessionScreenProps) {
  const hasLoggedSets = session.slots.some((slot) => slot.loggedSets.length > 0);

  return (
    <Screen
      title={fitnessStrings.session.heading(session.workout.name, session.block.number)}
      back={{ href: '/fitness-tracker/active/block', label: fitnessStrings.navigation.toBlock }}
      action={<FinishWorkoutButton sessionId={session.id} hasLoggedSets={hasLoggedSets} />}
    >
      <SessionBody session={session} />
    </Screen>
  );
}
