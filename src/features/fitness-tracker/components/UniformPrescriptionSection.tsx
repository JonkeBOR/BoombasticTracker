import { useId } from 'react';
import { fitnessStrings } from '@/lib/strings/fitness';
import type { PlannedSetView } from '../domain/types';
import { formatKg } from '../domain/values';
import { SchemeForm } from './SchemeForm';
import styles from './UniformPrescriptionSection.module.css';

type UniformPrescriptionSectionProps = {
  slotId: string;
  plannedSets: readonly PlannedSetView[];
};

export function UniformPrescriptionSection({
  slotId,
  plannedSets,
}: UniformPrescriptionSectionProps) {
  const headingId = useId();

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        {fitnessStrings.slotEdit.everyBlockTitle}
      </h2>
      <ul className={styles.sets}>
        {plannedSets.map((set) => (
          <li key={set.id} className={styles.set}>
            <span className={styles.number}>
              {fitnessStrings.slotEdit.setNumber(set.setNumber)}
            </span>
            <span>{set.targetReps}</span>
            <span className={styles.lastWeight}>
              {set.lastWeightKg === null
                ? fitnessStrings.common.noValue
                : fitnessStrings.slotEdit.lastWeight(formatKg(set.lastWeightKg))}
            </span>
          </li>
        ))}
      </ul>
      <SchemeForm
        key={plannedSets.map((set) => `${set.id}-${set.targetReps}`).join(',')}
        url={`/api/fitness/slots/${slotId}`}
        plannedSets={plannedSets}
        applyLabel={fitnessStrings.slotEdit.schemeSave}
      />
    </section>
  );
}
