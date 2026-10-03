'use client';

import { useRouter } from 'next/navigation';
import { fitnessStrings } from '@/lib/strings/fitness';
import { ActionButton } from './ActionButton';
import { ConfirmActionButton } from './ConfirmActionButton';
import styles from './FinishWorkoutBar.module.css';
import { readNumberField, readStringField } from './read-id';

type FinishWorkoutBarProps = {
  sessionId: string;
  hasLoggedSets: boolean;
  onFinished: () => void;
};

export function FinishWorkoutBar({ sessionId, hasLoggedSets, onFinished }: FinishWorkoutBarProps) {
  const router = useRouter();
  const url = `/api/fitness/sessions/${sessionId}/finish`;

  function finished(body: unknown) {
    onFinished();
    const progression = readStringField(body, 'progression');
    const completedBlock = readNumberField(body, 'completedBlockNumber');
    const destination =
      progression !== null && progression !== 'none' && completedBlock !== null
        ? `/fitness-tracker/active/block?completed=${completedBlock}`
        : '/fitness-tracker/active/block';
    router.push(destination);
  }

  return (
    <div className={styles.bar}>
      {hasLoggedSets ? (
        <ActionButton
          label={fitnessStrings.session.finishWorkout}
          method="POST"
          url={url}
          body={{}}
          isPrimary
          onSuccess={finished}
        />
      ) : (
        <ConfirmActionButton
          triggerLabel={fitnessStrings.session.finishWorkout}
          message={fitnessStrings.session.finishEmptyConfirm}
          confirmLabel={fitnessStrings.session.finishEmptyConfirmLabel}
          method="POST"
          url={url}
          body={{}}
          onSuccess={finished}
        />
      )}
    </div>
  );
}
