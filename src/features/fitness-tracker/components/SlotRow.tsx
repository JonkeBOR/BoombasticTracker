'use client';

import Link from 'next/link';
import { fitnessStrings } from '@/lib/strings/fitness';
import { summarize } from '../domain/prescription-edit';
import type { SlotView } from '../domain/types';
import { ConfirmActionButton } from './ConfirmActionButton';
import { InlineError } from './InlineError';
import { MoveButtons } from './MoveButtons';
import styles from './SlotRow.module.css';
import { useFitnessAction } from './useFitnessAction';

type SlotRowProps = {
  programId: string;
  workoutId: string;
  slot: SlotView;
  index: number;
  count: number;
};

export function SlotRow({ programId, workoutId, slot, index, count }: SlotRowProps) {
  const action = useFitnessAction();
  const url = `/api/fitness/slots/${slot.id}`;

  return (
    <div className={styles.row}>
      <Link
        className={slot.isOptional ? styles.optionalLink : styles.link}
        href={`/fitness-tracker/programs/${programId}/workouts/${workoutId}/slots/${slot.id}`}
      >
        <span className={styles.name}>{slot.exercise.name}</span>
        {slot.isOptional ? (
          <span className={styles.tag}>{fitnessStrings.common.optional}</span>
        ) : null}
        <span className={styles.summary}>{summarize(slot.prescriptions)}</span>
      </Link>
      <div className={styles.actions}>
        <MoveButtons
          itemName={slot.exercise.name}
          index={index}
          count={count}
          disabled={action.pending}
          onMove={(toPosition) => void action.run('PATCH', url, { toPosition })}
        />
        <ConfirmActionButton
          triggerLabel={fitnessStrings.workoutEdit.removeSlotFor(slot.exercise.name)}
          message={fitnessStrings.workoutEdit.removeSlotConfirm(slot.exercise.name)}
          confirmLabel={fitnessStrings.workoutEdit.removeSlotConfirmLabel}
          method="DELETE"
          url={url}
        />
      </div>
      <InlineError message={action.errorMessage} />
    </div>
  );
}
