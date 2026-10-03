'use client';

import { type FormEvent, useId, useState } from 'react';
import { fitnessErrorStrings, fitnessStrings } from '@/lib/strings/fitness';
import { formatKg, parseKgInput } from '../domain/values';
import { InlineError } from './InlineError';
import { useFitnessAction } from './useFitnessAction';
import styles from './WeighInRow.module.css';

type WeighInRowProps = { isAvailable: boolean; lastEntryKg: number | null };

export function WeighInRow({ isAvailable, lastEntryKg }: WeighInRowProps) {
  const inputId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const action = useFitnessAction();

  function close() {
    setIsOpen(false);
    setText('');
    setInputError(null);
    action.clearError();
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const weightKg = parseKgInput(text);
    if (!weightKg.ok || weightKg.value === null) {
      setInputError(fitnessErrorStrings['invalid-weight']);
      return;
    }
    setInputError(null);
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const succeeded = await action.run('POST', '/api/fitness/bodyweight', {
      weightKg: weightKg.value,
      timeZone,
    });
    if (succeeded) {
      close();
    }
  }

  return (
    <div className={styles.row}>
      <div className={styles.summary}>
        <button
          type="button"
          className={styles.weighIn}
          disabled={!isAvailable}
          onClick={() => setIsOpen(true)}
        >
          {fitnessStrings.home.weighIn}
        </button>
        {lastEntryKg === null ? null : (
          <span className={styles.lastEntry}>
            {fitnessStrings.home.lastEntry(formatKg(lastEntryKg))}
          </span>
        )}
      </div>
      {isOpen ? (
        <form className={styles.form} onSubmit={(event) => void save(event)}>
          <label className={styles.label} htmlFor={inputId}>
            {fitnessStrings.home.weighInInputLabel}
          </label>
          <input
            id={inputId}
            className={styles.input}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <div className={styles.actions}>
            <button type="button" className={styles.cancel} onClick={close}>
              {fitnessStrings.common.cancel}
            </button>
            <button type="submit" className={styles.save} disabled={action.pending}>
              {fitnessStrings.common.save}
            </button>
          </div>
          <InlineError message={inputError ?? action.errorMessage} />
        </form>
      ) : null}
    </div>
  );
}
