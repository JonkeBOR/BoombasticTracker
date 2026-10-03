'use client';

import { useId, useState } from 'react';
import { fitnessStrings } from '@/lib/strings/fitness';
import type { BlockView } from '../domain/types';
import { ConfirmActionButton } from './ConfirmActionButton';
import { InlineError } from './InlineError';
import styles from './BlockRow.module.css';
import { useFitnessAction } from './useFitnessAction';

type BlockRowProps = {
  block: BlockView;
  canRemove: boolean;
  removeMessage: string;
};

export function BlockRow({ block, canRemove, removeMessage }: BlockRowProps) {
  const inputId = useId();
  const [label, setLabel] = useState(block.label ?? '');
  const action = useFitnessAction();

  async function saveLabel() {
    if (label !== (block.label ?? '')) {
      await action.run('PATCH', `/api/fitness/blocks/${block.id}`, { label });
    }
  }

  return (
    <div className={styles.row}>
      <label className={styles.number} htmlFor={inputId}>
        {fitnessStrings.block.name(block.number)}
      </label>
      <input
        id={inputId}
        className={styles.input}
        type="text"
        autoComplete="off"
        aria-label={fitnessStrings.programEdit.blockLabelLabel(block.number)}
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        onBlur={() => void saveLabel()}
      />
      {canRemove ? (
        <ConfirmActionButton
          triggerLabel={fitnessStrings.programEdit.removeBlockFor(block.number)}
          message={removeMessage}
          confirmLabel={fitnessStrings.programEdit.removeBlockConfirmLabel}
          method="DELETE"
          url={`/api/fitness/blocks/${block.id}`}
        />
      ) : null}
      <InlineError message={action.errorMessage} />
    </div>
  );
}
