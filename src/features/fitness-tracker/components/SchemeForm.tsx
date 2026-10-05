'use client';

import { useState } from 'react';
import { fitnessStrings } from '@/lib/strings/fitness';
import { quickFill, removesWeightedSets } from '../domain/prescription-edit';
import type { PlannedSetView } from '../domain/types';
import { ConditionalConfirmButton } from './ConditionalConfirmButton';
import styles from './SchemeForm.module.css';

type SchemeFormProps = {
  url: string;
  plannedSets: readonly PlannedSetView[];
  applyLabel: string;
  extraBody?: Record<string, unknown>;
};

const wholeNumber = /^\d+$/;

function parseCount(text: string): number | null {
  return wholeNumber.test(text.trim()) ? Number(text.trim()) : null;
}

export function SchemeForm({ url, plannedSets, applyLabel, extraBody = {} }: SchemeFormProps) {
  const [sets, setSets] = useState(String(plannedSets.length));
  const [reps, setReps] = useState(String(plannedSets[0]?.targetReps ?? ''));

  const setCount = parseCount(sets);
  const repCount = parseCount(reps);
  const scheme = setCount === null || repCount === null ? null : quickFill(setCount, repCount);
  const isValid = scheme?.ok === true;

  return (
    <div className={styles.form}>
      <div className={styles.fields}>
        <label className={styles.label}>
          {fitnessStrings.slotEdit.schemeSetsLabel}
          <input
            className={styles.input}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={sets}
            onChange={(event) => setSets(event.target.value)}
          />
        </label>
        <label className={styles.label}>
          {fitnessStrings.slotEdit.schemeRepsLabel}
          <input
            className={styles.input}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={reps}
            onChange={(event) => setReps(event.target.value)}
          />
        </label>
      </div>
      <ConditionalConfirmButton
        label={applyLabel}
        needsConfirm={isValid && removesWeightedSets(plannedSets, setCount ?? 0)}
        confirmMessage={fitnessStrings.slotEdit.removeSetsConfirm}
        confirmLabel={fitnessStrings.slotEdit.removeSetsConfirmLabel}
        method="PATCH"
        url={url}
        body={{ ...extraBody, sets: setCount, reps: repCount }}
        disabled={!isValid}
      />
    </div>
  );
}
