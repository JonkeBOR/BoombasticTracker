'use client';

import { fitnessStrings } from '@/lib/strings/fitness';
import { InlineError } from './InlineError';
import styles from './OptionalToggle.module.css';
import { useFitnessAction } from './useFitnessAction';

type OptionalToggleProps = { slotId: string; isOptional: boolean };

export function OptionalToggle({ slotId, isOptional }: OptionalToggleProps) {
  const action = useFitnessAction();

  return (
    <div className={styles.toggle}>
      <label className={styles.label}>
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={isOptional}
          disabled={action.pending}
          onChange={(event) =>
            void action.run('PATCH', `/api/fitness/slots/${slotId}`, {
              isOptional: event.target.checked,
            })
          }
        />
        {fitnessStrings.slotEdit.optionalToggle}
      </label>
      <InlineError message={action.errorMessage} />
    </div>
  );
}
