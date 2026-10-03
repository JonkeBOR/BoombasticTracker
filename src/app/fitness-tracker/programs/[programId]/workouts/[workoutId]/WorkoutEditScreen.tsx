import { AddSlotForm } from '@/features/fitness-tracker/components/AddSlotForm';
import { RenameForm } from '@/features/fitness-tracker/components/RenameForm';
import { Screen } from '@/features/fitness-tracker/components/Screen';
import { SlotRow } from '@/features/fitness-tracker/components/SlotRow';
import type { Exercise, WorkoutView } from '@/features/fitness-tracker/domain/types';
import { fitnessStrings } from '@/lib/strings/fitness';
import styles from './WorkoutEditScreen.module.css';

type WorkoutEditScreenProps = {
  programId: string;
  workout: WorkoutView;
  exercises: readonly Exercise[];
};

const slotsHeadingId = 'workout-slots-heading';

export function WorkoutEditScreen({ programId, workout, exercises }: WorkoutEditScreenProps) {
  return (
    <Screen
      title={workout.name}
      back={{
        href: `/fitness-tracker/programs/${programId}`,
        label: fitnessStrings.navigation.toProgram,
      }}
    >
      <RenameForm
        label={fitnessStrings.workoutEdit.nameLabel}
        currentName={workout.name}
        url={`/api/fitness/workouts/${workout.id}`}
      />
      <section className={styles.section}>
        <h2 id={slotsHeadingId} className={styles.heading}>
          {fitnessStrings.workoutEdit.slotsTitle}
        </h2>
        {workout.slots.length === 0 ? (
          <p className={styles.empty}>{fitnessStrings.workoutEdit.noSlots}</p>
        ) : (
          <ul className={styles.list} aria-labelledby={slotsHeadingId}>
            {workout.slots.map((slot, index) => (
              <li key={slot.id}>
                <SlotRow
                  programId={programId}
                  workoutId={workout.id}
                  slot={slot}
                  index={index}
                  count={workout.slots.length}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
      <AddSlotForm workoutId={workout.id} exercises={exercises} />
    </Screen>
  );
}
