'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import { fitnessStrings } from '@/lib/strings/fitness';
import type { Exercise } from '../domain/types';
import styles from './ExerciseList.module.css';

type ExerciseListProps = { exercises: readonly Exercise[] };

function byName(left: Exercise, right: Exercise): number {
  return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
}

export function ExerciseList({ exercises }: ExerciseListProps) {
  const filterId = useId();
  const archivedId = useId();
  const [filter, setFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const needle = filter.trim().toLowerCase();
  const visible = exercises
    .filter((exercise) => showArchived || !exercise.isArchived)
    .filter((exercise) => exercise.name.toLowerCase().includes(needle))
    .toSorted(byName);

  return (
    <div className={styles.list}>
      <div className={styles.controls}>
        <label className={styles.label} htmlFor={filterId}>
          {fitnessStrings.exercises.filterLabel}
        </label>
        <input
          id={filterId}
          className={styles.filter}
          type="text"
          autoComplete="off"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
        <label className={styles.toggle} htmlFor={archivedId}>
          <input
            id={archivedId}
            type="checkbox"
            className={styles.checkbox}
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
          />
          {fitnessStrings.exercises.showArchived}
        </label>
      </div>
      {exercises.length === 0 ? (
        <p className={styles.empty}>{fitnessStrings.exercises.empty}</p>
      ) : visible.length === 0 ? (
        <p className={styles.empty}>{fitnessStrings.exercises.noMatches}</p>
      ) : (
        <ul className={styles.items}>
          {visible.map((exercise) => (
            <li key={exercise.id}>
              <Link className={styles.row} href={`/fitness-tracker/exercises/${exercise.id}`}>
                <span className={styles.name}>{exercise.name}</span>
                {exercise.isArchived ? (
                  <span className={styles.tag}>{fitnessStrings.common.archived}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
