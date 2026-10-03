'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { fitnessStrings } from '@/lib/strings/fitness';
import { ConfirmDialog } from './ConfirmDialog';
import { InlineError } from './InlineError';
import { useFitnessAction } from './useFitnessAction';

type SkipToBlockCardProps = {
  blockId: string;
  label: string;
  message: string;
  className: string | undefined;
  children: ReactNode;
};

export function SkipToBlockCard({
  blockId,
  label,
  message,
  className,
  children,
}: SkipToBlockCardProps) {
  const router = useRouter();
  const skip = useFitnessAction();

  return (
    <>
      <ConfirmDialog
        triggerLabel={label}
        triggerContent={children}
        triggerClassName={className}
        message={message}
        confirmLabel={fitnessStrings.activeProgram.skipConfirmLabel}
        disabled={skip.pending}
        onConfirm={() =>
          void skip.run('POST', '/api/fitness/active-program/skip', { blockId }, () =>
            router.push('/fitness-tracker/active/block'),
          )
        }
      />
      <InlineError message={skip.errorMessage} />
    </>
  );
}
