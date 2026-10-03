'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { fitnessStrings } from '@/lib/strings/fitness';
import type { BlockProgress } from '../domain/types';
import { ConfirmActionButton } from './ConfirmActionButton';
import styles from './SkipToBlockButton.module.css';

type SkipToBlockButtonProps = {
  blocks: readonly BlockProgress[];
  currentBlockId: string;
  hasOpenWorkout: boolean;
};

export function SkipToBlockButton({
  blocks,
  currentBlockId,
  hasOpenWorkout,
}: SkipToBlockButtonProps) {
  const router = useRouter();
  const selectId = useId();
  const [selected, setSelected] = useState('');
  const current = blocks.find((block) => block.id === currentBlockId);
  const first = blocks[0];
  const later = blocks.slice(blocks.findIndex((block) => block.id === currentBlockId) + 1);
  const target = blocks.find((block) => block.id === selected);

  function confirmMessage(): string {
    if (!target || !current || !first) {
      return '';
    }
    const base =
      target.id === first.id
        ? fitnessStrings.activeProgram.skipConfirmStartAgain
        : fitnessStrings.activeProgram.skipConfirmLater(
            target.number,
            current.number,
            target.number - 1,
          );
    return hasOpenWorkout ? `${base} ${fitnessStrings.activeProgram.skipOpenWorkout}` : base;
  }

  return (
    <div className={styles.skip}>
      <label className={styles.label} htmlFor={selectId}>
        {fitnessStrings.activeProgram.skipPickerLabel}
      </label>
      <div className={styles.fields}>
        <select
          id={selectId}
          className={styles.select}
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
        >
          <option value="">{fitnessStrings.activeProgram.skipChoose}</option>
          {later.map((block) => (
            <option key={block.id} value={block.id}>
              {fitnessStrings.block.title(block.number, block.label)}
            </option>
          ))}
          {first ? (
            <option value={first.id}>{fitnessStrings.activeProgram.skipStartAgain}</option>
          ) : null}
        </select>
        <ConfirmActionButton
          triggerLabel={fitnessStrings.activeProgram.skipToBlock}
          message={confirmMessage()}
          confirmLabel={fitnessStrings.activeProgram.skipConfirmLabel}
          method="POST"
          url="/api/fitness/active-program/skip"
          body={{ blockId: selected }}
          disabled={selected === ''}
          onSuccess={() => router.push('/fitness-tracker/active/block')}
        />
      </div>
    </div>
  );
}
