'use client';

import { useRouter } from 'next/navigation';
import { fitnessStrings } from '@/lib/strings/fitness';
import { ConfirmActionButton } from './ConfirmActionButton';

type DeleteExerciseButtonProps = { exerciseId: string };

export function DeleteExerciseButton({ exerciseId }: DeleteExerciseButtonProps) {
  const router = useRouter();

  return (
    <ConfirmActionButton
      triggerLabel={fitnessStrings.exerciseEdit.delete}
      message={fitnessStrings.exerciseEdit.deleteConfirm}
      confirmLabel={fitnessStrings.exerciseEdit.deleteConfirmLabel}
      method="DELETE"
      url={`/api/fitness/exercises/${exerciseId}`}
      onSuccess={() => router.push('/fitness-tracker/exercises')}
    />
  );
}
