'use client';

import { Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { fitnessStrings } from '@/lib/strings/fitness';
import { ConfirmDialog } from './ConfirmDialog';
import { InlineError } from './InlineError';
import styles from './FinishWorkoutButton.module.css';
import { readNumberField, readStringField } from './read-id';
import { useFitnessAction } from './useFitnessAction';
import { useSetDrafts } from './useSetDrafts';

type FinishWorkoutButtonProps = {
  sessionId: string;
  hasLoggedSets: boolean;
};

export function FinishWorkoutButton({ sessionId, hasLoggedSets }: FinishWorkoutButtonProps) {
  const router = useRouter();
  const action = useFitnessAction();
  const { clearAll } = useSetDrafts(sessionId);
  const url = `/api/fitness/sessions/${sessionId}/finish`;
  const icon = <Check className={styles.icon} aria-hidden="true" />;

  function finished(body: unknown) {
    clearAll();
    const progression = readStringField(body, 'progression');
    const completedBlock = readNumberField(body, 'completedBlockNumber');
    const finishedPage = `/fitness-tracker/active/sessions/${sessionId}/finished`;
    const destination =
      progression !== null && progression !== 'none' && completedBlock !== null
        ? `${finishedPage}?completed=${completedBlock}`
        : finishedPage;
    router.push(destination);
  }

  function finish() {
    void action.run('POST', url, {}, finished);
  }

  return (
    <span className={styles.wrapper}>
      {hasLoggedSets ? (
        <button
          type="button"
          className={styles.button}
          aria-label={fitnessStrings.session.finishWorkout}
          disabled={action.pending}
          onClick={finish}
        >
          {icon}
        </button>
      ) : (
        <ConfirmDialog
          triggerLabel={fitnessStrings.session.finishWorkout}
          triggerClassName={styles.button}
          triggerContent={icon}
          message={fitnessStrings.session.finishEmptyConfirm}
          confirmLabel={fitnessStrings.session.finishEmptyConfirmLabel}
          disabled={action.pending}
          onConfirm={finish}
        />
      )}
      <InlineError message={action.errorMessage} />
    </span>
  );
}
