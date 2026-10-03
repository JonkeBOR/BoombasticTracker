'use client';

import { useRouter } from 'next/navigation';
import { fitnessStrings } from '@/lib/strings/fitness';
import { ConfirmActionButton } from './ConfirmActionButton';

type PauseButtonProps = { triggerLabel: string; redirectTo?: string };

export function PauseButton({ triggerLabel, redirectTo }: PauseButtonProps) {
  const router = useRouter();

  return (
    <ConfirmActionButton
      triggerLabel={triggerLabel}
      message={fitnessStrings.activeProgram.pauseConfirm}
      confirmLabel={fitnessStrings.activeProgram.pauseConfirmLabel}
      method="DELETE"
      url="/api/fitness/active-program"
      onSuccess={() => {
        if (redirectTo === undefined) {
          router.refresh();
        } else {
          router.push(redirectTo);
        }
      }}
    />
  );
}
