'use client';

import { fitnessStrings } from '@/lib/strings/fitness';
import styles from './MoveButtons.module.css';

type MoveButtonsProps = {
  itemName: string;
  index: number;
  count: number;
  onMove: (toPosition: number) => void;
  disabled?: boolean;
};

export function MoveButtons({
  itemName,
  index,
  count,
  onMove,
  disabled = false,
}: MoveButtonsProps) {
  return (
    <span className={styles.buttons}>
      <button
        type="button"
        className={styles.button}
        aria-label={fitnessStrings.common.moveUpFor(itemName)}
        disabled={disabled || index === 0}
        onClick={() => onMove(index)}
      >
        {fitnessStrings.common.moveUpSymbol}
      </button>
      <button
        type="button"
        className={styles.button}
        aria-label={fitnessStrings.common.moveDownFor(itemName)}
        disabled={disabled || index >= count - 1}
        onClick={() => onMove(index + 2)}
      >
        {fitnessStrings.common.moveDownSymbol}
      </button>
    </span>
  );
}
