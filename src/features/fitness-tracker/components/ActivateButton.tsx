'use client';

import { fitnessStrings } from '@/lib/strings/fitness';
import { ActionButton } from './ActionButton';
import { ConfirmActionButton } from './ConfirmActionButton';

type ActivateButtonProps = { programId: string; otherActiveProgramName: string | null };

export function ActivateButton({ programId, otherActiveProgramName }: ActivateButtonProps) {
  const url = `/api/fitness/programs/${programId}/activation`;

  if (otherActiveProgramName !== null) {
    return (
      <ConfirmActionButton
        triggerLabel={fitnessStrings.programEdit.activate}
        message={fitnessStrings.programEdit.activateWillPause(otherActiveProgramName)}
        confirmLabel={fitnessStrings.programEdit.activateConfirmLabel}
        method="POST"
        url={url}
        body={{}}
      />
    );
  }
  return (
    <ActionButton
      label={fitnessStrings.programEdit.activate}
      method="POST"
      url={url}
      body={{}}
      isPrimary
    />
  );
}
