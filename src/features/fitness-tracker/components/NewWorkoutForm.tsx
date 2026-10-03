'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useId, useState } from 'react';
import { fitnessStrings } from '@/lib/strings/fitness';
import { InlineError } from './InlineError';
import styles from './NewWorkoutForm.module.css';
import { useFitnessAction } from './useFitnessAction';

type NewWorkoutFormProps = { programId: string };

function createdId(body: unknown): string | null {
  if (typeof body === 'object' && body !== null && 'id' in body && typeof body.id === 'string') {
    return body.id;
  }
  return null;
}

export function NewWorkoutForm({ programId }: NewWorkoutFormProps) {
  const inputId = useId();
  const router = useRouter();
  const [name, setName] = useState('');
  const action = useFitnessAction();

  function openCreated(body: unknown) {
    const id = createdId(body);
    router.replace(
      id === null
        ? `/fitness-tracker/programs/${programId}`
        : `/fitness-tracker/programs/${programId}/workouts/${id}`,
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await action.run('POST', `/api/fitness/programs/${programId}/workouts`, { name }, openCreated);
  }

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)}>
      <label className={styles.label} htmlFor={inputId}>
        {fitnessStrings.workoutEdit.nameLabel}
      </label>
      <div className={styles.fields}>
        <input
          id={inputId}
          className={styles.input}
          type="text"
          autoComplete="off"
          enterKeyHint="done"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button
          type="submit"
          className={styles.submit}
          disabled={action.pending || name.trim() === ''}
        >
          {fitnessStrings.workoutEdit.create}
        </button>
      </div>
      <InlineError message={action.errorMessage} />
    </form>
  );
}
