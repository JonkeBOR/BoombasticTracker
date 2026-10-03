'use client';

import { useState } from 'react';
import { fitnessErrorStrings, fitnessStrings } from '@/lib/strings/fitness';
import type { SessionPlannedSet, SetLog } from '../domain/types';
import { formatKg, parseKgInput } from '../domain/values';
import { InlineError } from './InlineError';
import styles from './SetRow.module.css';
import { useFitnessAction } from './useFitnessAction';
import type { SetDraft } from './useSetDrafts';

type SetRowProps = {
  sessionId: string;
  exerciseName: string;
  plannedSet: SessionPlannedSet;
  logged: SetLog | null;
  draft: SetDraft | undefined;
  onDraftChange: (patch: SetDraft) => void;
  onLogged: () => void;
};

const wholeNumber = /^\d+$/;
const maxReps = 999;

function parseReps(text: string): number | null {
  const trimmed = text.trim();
  if (!wholeNumber.test(trimmed)) {
    return null;
  }
  const reps = Number(trimmed);
  return reps >= 1 && reps <= maxReps ? reps : null;
}

export function SetRow({
  sessionId,
  exerciseName,
  plannedSet,
  logged,
  draft,
  onDraftChange,
  onLogged,
}: SetRowProps) {
  const [inputError, setInputError] = useState<string | null>(null);
  const action = useFitnessAction();

  if (logged) {
    return (
      <div className={styles.logged}>
        <span className={styles.check} aria-hidden="true">
          {fitnessStrings.session.logSymbol}
        </span>
        <span className={styles.number}>
          {fitnessStrings.session.loggedLabel(plannedSet.setNumber)}
        </span>
        <span className={styles.values}>
          {fitnessStrings.session.loggedValues(
            logged.reps,
            logged.weightKg === null ? null : formatKg(logged.weightKg),
          )}
        </span>
      </div>
    );
  }

  const weightText =
    draft?.weight ??
    (plannedSet.suggestedWeightKg === null ? '' : formatKg(plannedSet.suggestedWeightKg));
  const repsText = draft?.reps ?? String(plannedSet.targetReps);

  async function log() {
    const weightKg = parseKgInput(weightText);
    if (!weightKg.ok) {
      setInputError(fitnessErrorStrings['invalid-weight']);
      return;
    }
    const reps = parseReps(repsText);
    if (reps === null) {
      setInputError(fitnessErrorStrings['invalid-reps']);
      return;
    }
    setInputError(null);
    const succeeded = await action.run('POST', `/api/fitness/sessions/${sessionId}/sets`, {
      plannedSetId: plannedSet.id,
      reps,
      weightKg: weightKg.value,
    });
    if (succeeded) {
      onLogged();
    }
  }

  return (
    <div className={styles.row}>
      <div className={styles.heading}>
        <span className={styles.number}>
          {fitnessStrings.slotEdit.setNumber(plannedSet.setNumber)}
        </span>
        <span className={styles.target}>
          {fitnessStrings.session.target(plannedSet.targetReps)}
        </span>
      </div>
      <div className={styles.fields}>
        <input
          className={styles.weight}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          aria-label={fitnessStrings.session.weightLabel(plannedSet.setNumber, exerciseName)}
          value={weightText}
          onChange={(event) => onDraftChange({ weight: event.target.value })}
        />
        <span className={styles.unit}>{fitnessStrings.session.weightUnit}</span>
        <input
          className={styles.reps}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-label={fitnessStrings.session.repsLabel(plannedSet.setNumber, exerciseName)}
          value={repsText}
          onChange={(event) => onDraftChange({ reps: event.target.value })}
        />
        <span className={styles.unit}>{fitnessStrings.session.repsUnit}</span>
        <button
          type="button"
          className={styles.log}
          aria-label={fitnessStrings.session.logLabel(plannedSet.setNumber, exerciseName)}
          disabled={action.pending}
          onClick={() => void log()}
        >
          {fitnessStrings.session.logSymbol}
        </button>
      </div>
      <InlineError message={inputError ?? action.errorMessage} />
    </div>
  );
}
