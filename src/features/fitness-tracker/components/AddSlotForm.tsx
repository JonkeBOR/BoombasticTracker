'use client';

import { type FormEvent, useId, useState } from 'react';
import { fitnessStrings } from '@/lib/strings/fitness';
import type { Exercise } from '../domain/types';
import styles from './AddSlotForm.module.css';
import { InlineError } from './InlineError';
import { readId } from './read-id';
import { useFitnessAction } from './useFitnessAction';

type AddSlotFormProps = { workoutId: string; exercises: readonly Exercise[] };

const newExerciseValue = '__new__';
const wholeNumber = /^\d+$/;

function parseCount(text: string): number | null {
  return wholeNumber.test(text.trim()) ? Number(text.trim()) : null;
}

export function AddSlotForm({ workoutId, exercises }: AddSlotFormProps) {
  const selectId = useId();
  const nameId = useId();
  const setsId = useId();
  const repsId = useId();
  const [selected, setSelected] = useState(exercises.length === 0 ? newExerciseValue : '');
  const [newName, setNewName] = useState('');
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [created, setCreated] = useState<Exercise[]>([]);
  const action = useFitnessAction();

  const options = [
    ...exercises,
    ...created.filter((entry) => !exercises.some((exercise) => exercise.id === entry.id)),
  ];
  const setCount = parseCount(sets);
  const repCount = parseCount(reps);
  const hasValidNumbers =
    setCount !== null && setCount >= 1 && repCount !== null && repCount >= 1 && repCount <= 999;
  const hasExercise = selected === newExerciseValue ? newName.trim().length > 0 : selected !== '';
  const canSave = hasExercise && hasValidNumbers && !action.pending;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSave) {
      return;
    }
    let exerciseId = selected;
    if (selected === newExerciseValue) {
      const result: { id: string | null } = { id: null };
      const succeeded = await action.run(
        'POST',
        '/api/fitness/exercises',
        { name: newName },
        (body) => {
          result.id = readId(body);
        },
      );
      if (!succeeded || result.id === null) {
        return;
      }
      exerciseId = result.id;
      setCreated((previous) => [
        ...previous,
        { id: result.id ?? '', name: newName.trim(), isArchived: false },
      ]);
      setSelected(exerciseId);
    }
    const succeeded = await action.run('POST', `/api/fitness/workouts/${workoutId}/slots`, {
      exerciseId,
      sets: setCount,
      reps: repCount,
    });
    if (succeeded) {
      setSelected('');
      setNewName('');
      setSets('');
      setReps('');
    }
  }

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)}>
      <h2 className={styles.heading}>{fitnessStrings.workoutEdit.addExercise}</h2>
      <label className={styles.label} htmlFor={selectId}>
        {fitnessStrings.workoutEdit.exerciseLabel}
      </label>
      <select
        id={selectId}
        className={styles.input}
        value={selected}
        onChange={(event) => setSelected(event.target.value)}
      >
        <option value="">{fitnessStrings.workoutEdit.choose}</option>
        {options.map((exercise) => (
          <option key={exercise.id} value={exercise.id}>
            {exercise.name}
          </option>
        ))}
        <option value={newExerciseValue}>{fitnessStrings.workoutEdit.newExerciseOption}</option>
      </select>
      {selected === newExerciseValue ? (
        <>
          <label className={styles.label} htmlFor={nameId}>
            {fitnessStrings.workoutEdit.newExerciseNameLabel}
          </label>
          <input
            id={nameId}
            className={styles.input}
            type="text"
            autoComplete="off"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />
        </>
      ) : null}
      <div className={styles.numbers}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={setsId}>
            {fitnessStrings.workoutEdit.setsLabel}
          </label>
          <input
            id={setsId}
            className={styles.input}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={sets}
            onChange={(event) => setSets(event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={repsId}>
            {fitnessStrings.workoutEdit.repsLabel}
          </label>
          <input
            id={repsId}
            className={styles.input}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={reps}
            onChange={(event) => setReps(event.target.value)}
          />
        </div>
      </div>
      <button type="submit" className={styles.submit} disabled={!canSave}>
        {fitnessStrings.workoutEdit.save}
      </button>
      <InlineError message={action.errorMessage} />
    </form>
  );
}
