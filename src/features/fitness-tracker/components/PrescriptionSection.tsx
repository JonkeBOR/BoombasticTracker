'use client';

import { useId, useState } from 'react';
import { fitnessErrorStrings, fitnessStrings } from '@/lib/strings/fitness';
import {
  addSet,
  copyFrom,
  quickFill,
  removeLastSet,
  removesWeightedSets,
} from '../domain/prescription-edit';
import type { PlannedSetView } from '../domain/types';
import { formatKg } from '../domain/values';
import { ConditionalConfirmButton } from './ConditionalConfirmButton';
import { InlineError } from './InlineError';
import styles from './PrescriptionSection.module.css';
import { useFitnessAction } from './useFitnessAction';

type PrescriptionSectionProps = {
  slotId: string;
  blockId: string;
  title: string;
  plannedSets: readonly PlannedSetView[];
  previousTargets: readonly number[] | null;
};

const wholeNumber = /^\d+$/;
const maxTarget = 999;

function parseCount(text: string): number | null {
  return wholeNumber.test(text.trim()) ? Number(text.trim()) : null;
}

export function PrescriptionSection({
  slotId,
  blockId,
  title,
  plannedSets,
  previousTargets,
}: PrescriptionSectionProps) {
  const headingId = useId();
  const [repsText, setRepsText] = useState(() => plannedSets.map((set) => String(set.targetReps)));
  const [fillSets, setFillSets] = useState('');
  const [fillReps, setFillReps] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const action = useFitnessAction();

  const url = `/api/fitness/slots/${slotId}/prescriptions/${blockId}`;
  const targets = plannedSets.map((set) => set.targetReps);
  const fillSetCount = parseCount(fillSets);
  const fillRepCount = parseCount(fillReps);
  const fill =
    fillSetCount === null || fillRepCount === null ? null : quickFill(fillSetCount, fillRepCount);
  const removal = removeLastSet(targets);

  function commitReps(index: number) {
    const parsed = parseCount(repsText[index] ?? '');
    if (parsed === null || parsed < 1 || parsed > maxTarget) {
      setInputError(fitnessErrorStrings['invalid-target']);
      return;
    }
    setInputError(null);
    if (parsed !== targets[index]) {
      void action.run('PUT', url, {
        targetReps: targets.map((target, position) => (position === index ? parsed : target)),
      });
    }
  }

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        {title}
      </h2>
      <ul className={styles.sets}>
        {plannedSets.map((set, index) => (
          <li key={set.id} className={styles.set}>
            <span className={styles.number}>
              {fitnessStrings.slotEdit.setNumber(set.setNumber)}
            </span>
            <input
              className={styles.reps}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              aria-label={fitnessStrings.slotEdit.targetRepsLabel(set.setNumber)}
              value={repsText[index] ?? ''}
              onChange={(event) =>
                setRepsText((previous) =>
                  previous.map((text, position) =>
                    position === index ? event.target.value : text,
                  ),
                )
              }
              onBlur={() => commitReps(index)}
            />
            <span className={styles.lastWeight}>
              {set.lastWeightKg === null
                ? fitnessStrings.common.noValue
                : fitnessStrings.slotEdit.lastWeight(formatKg(set.lastWeightKg))}
            </span>
          </li>
        ))}
      </ul>
      <InlineError message={inputError} />
      <div className={styles.actions}>
        <ConditionalConfirmButton
          label={fitnessStrings.slotEdit.addSet}
          needsConfirm={false}
          confirmMessage={fitnessStrings.slotEdit.removeSetsConfirm}
          confirmLabel={fitnessStrings.slotEdit.removeSetsConfirmLabel}
          method="PUT"
          url={url}
          body={{ targetReps: addSet(targets) }}
        />
        {removal.ok ? (
          <ConditionalConfirmButton
            label={fitnessStrings.slotEdit.removeLastSet}
            needsConfirm={removesWeightedSets(plannedSets, removal.value.length)}
            confirmMessage={fitnessStrings.slotEdit.removeSetsConfirm}
            confirmLabel={fitnessStrings.slotEdit.removeSetsConfirmLabel}
            method="PUT"
            url={url}
            body={{ targetReps: removal.value }}
          />
        ) : null}
        {previousTargets === null ? null : (
          <ConditionalConfirmButton
            label={fitnessStrings.slotEdit.copyFromPrevious}
            needsConfirm={removesWeightedSets(plannedSets, previousTargets.length)}
            confirmMessage={fitnessStrings.slotEdit.removeSetsConfirm}
            confirmLabel={fitnessStrings.slotEdit.removeSetsConfirmLabel}
            method="PUT"
            url={url}
            body={{ targetReps: copyFrom(previousTargets) }}
          />
        )}
      </div>
      <div className={styles.quickFill}>
        <span className={styles.quickFillTitle}>{fitnessStrings.slotEdit.quickFill}</span>
        <div className={styles.quickFillFields}>
          <label className={styles.label}>
            {fitnessStrings.slotEdit.quickFillSetsLabel}
            <input
              className={styles.reps}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={fillSets}
              onChange={(event) => setFillSets(event.target.value)}
            />
          </label>
          <label className={styles.label}>
            {fitnessStrings.slotEdit.quickFillRepsLabel}
            <input
              className={styles.reps}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={fillReps}
              onChange={(event) => setFillReps(event.target.value)}
            />
          </label>
          <ConditionalConfirmButton
            label={fitnessStrings.slotEdit.quickFillApply}
            needsConfirm={fill?.ok === true && removesWeightedSets(plannedSets, fill.value.length)}
            confirmMessage={fitnessStrings.slotEdit.removeSetsConfirm}
            confirmLabel={fitnessStrings.slotEdit.removeSetsConfirmLabel}
            method="PUT"
            url={url}
            body={{ targetReps: fill?.ok === true ? fill.value : [] }}
            disabled={fill?.ok !== true}
          />
        </div>
      </div>
      <InlineError message={action.errorMessage} />
    </section>
  );
}
