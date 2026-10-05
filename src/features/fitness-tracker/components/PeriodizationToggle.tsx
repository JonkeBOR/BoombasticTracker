'use client';

import { useState } from 'react';
import { fitnessStrings } from '@/lib/strings/fitness';
import type { PlannedSetView } from '../domain/types';
import { ActionButton } from './ActionButton';
import { InlineError } from './InlineError';
import styles from './PeriodizationToggle.module.css';
import { SchemeForm } from './SchemeForm';
import { useFitnessAction } from './useFitnessAction';

type PeriodizationToggleProps = {
  slotId: string;
  isPeriodized: boolean;
  firstBlockSets: readonly PlannedSetView[];
  hasLastWeights: boolean;
};

export function PeriodizationToggle({
  slotId,
  isPeriodized,
  firstBlockSets,
  hasLastWeights,
}: PeriodizationToggleProps) {
  const [isChanging, setIsChanging] = useState(false);
  const action = useFitnessAction();
  const url = `/api/fitness/slots/${slotId}`;

  function toggle() {
    if (!isPeriodized && !hasLastWeights) {
      void action.run('PATCH', url, { isPeriodized: true });
      return;
    }
    setIsChanging((previous) => !previous);
  }

  return (
    <div className={styles.toggle}>
      <label className={styles.label}>
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={isChanging ? !isPeriodized : isPeriodized}
          disabled={action.pending}
          onChange={toggle}
        />
        {fitnessStrings.slotEdit.periodizedToggle}
      </label>
      {isChanging && isPeriodized ? (
        <SchemeForm
          url={url}
          plannedSets={firstBlockSets}
          applyLabel={fitnessStrings.slotEdit.unperiodizeApply}
          extraBody={{ isPeriodized: false }}
        />
      ) : null}
      {isChanging && !isPeriodized ? (
        <div className={styles.confirm}>
          <p className={styles.message}>{fitnessStrings.slotEdit.periodizeConfirm}</p>
          <ActionButton
            label={fitnessStrings.slotEdit.periodizeApply}
            method="PATCH"
            url={url}
            body={{ isPeriodized: true }}
          />
        </div>
      ) : null}
      <InlineError message={action.errorMessage} />
    </div>
  );
}
