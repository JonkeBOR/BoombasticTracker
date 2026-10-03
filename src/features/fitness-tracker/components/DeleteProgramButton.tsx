'use client';

import { useRouter } from 'next/navigation';
import { fitnessStrings } from '@/lib/strings/fitness';
import { ConfirmActionButton } from './ConfirmActionButton';

type DeleteProgramButtonProps = { programId: string };

export function DeleteProgramButton({ programId }: DeleteProgramButtonProps) {
  const router = useRouter();

  return (
    <ConfirmActionButton
      triggerLabel={fitnessStrings.programEdit.deleteProgram}
      message={fitnessStrings.programEdit.deleteConfirm}
      confirmLabel={fitnessStrings.common.delete}
      method="DELETE"
      url={`/api/fitness/programs/${programId}`}
      onSuccess={() => router.push('/fitness-tracker/programs')}
    />
  );
}
