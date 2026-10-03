'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { fitnessStrings } from '@/lib/strings/fitness';
import type { Exercise } from '../domain/types';
import { ConfirmActionButton } from './ConfirmActionButton';
import styles from './ReplaceExercise.module.css';

type ReplaceExerciseProps = {
  slotId: string;
  currentExerciseId: string;
  exercises: readonly Exercise[];
};

export function ReplaceExercise({ slotId, currentExerciseId, exercises }: ReplaceExerciseProps) {
  const router = useRouter();
  const selectId = useId();
  const [selected, setSelected] = useState('');
  const choices = exercises.filter((exercise) => exercise.id !== currentExerciseId);

  return (
    <div className={styles.replace}>
      <label className={styles.label} htmlFor={selectId}>
        {fitnessStrings.slotEdit.replacementLabel}
      </label>
      <div className={styles.fields}>
        <select
          id={selectId}
          className={styles.select}
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
        >
          <option value="">{fitnessStrings.workoutEdit.choose}</option>
          {choices.map((exercise) => (
            <option key={exercise.id} value={exercise.id}>
              {exercise.name}
            </option>
          ))}
        </select>
        <ConfirmActionButton
          triggerLabel={fitnessStrings.slotEdit.replace}
          message={fitnessStrings.slotEdit.replaceConfirm}
          confirmLabel={fitnessStrings.slotEdit.replaceConfirmLabel}
          method="PATCH"
          url={`/api/fitness/slots/${slotId}`}
          body={{ exerciseId: selected }}
          disabled={selected === ''}
          onSuccess={() => {
            setSelected('');
            router.refresh();
          }}
        />
      </div>
    </div>
  );
}
