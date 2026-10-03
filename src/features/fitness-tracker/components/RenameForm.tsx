'use client';

import { type FormEvent, useId, useState } from 'react';
import { fitnessStrings } from '@/lib/strings/fitness';
import { InlineError } from './InlineError';
import styles from './RenameForm.module.css';
import { useFitnessAction } from './useFitnessAction';

type RenameFormProps = {
  label: string;
  currentName: string;
  url: string;
  isCollapsible?: boolean;
};

export function RenameForm({ label, currentName, url, isCollapsible = false }: RenameFormProps) {
  const inputId = useId();
  const [isOpen, setIsOpen] = useState(!isCollapsible);
  const [name, setName] = useState(currentName);
  const action = useFitnessAction();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (name !== currentName) {
      const succeeded = await action.run('PATCH', url, { name });
      if (!succeeded) {
        return;
      }
    }
    if (isCollapsible) {
      setIsOpen(false);
    }
  }

  if (!isOpen) {
    return (
      <button type="button" className={styles.toggle} onClick={() => setIsOpen(true)}>
        {fitnessStrings.common.rename}
      </button>
    );
  }

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      <div className={styles.fields}>
        <input
          id={inputId}
          className={styles.input}
          type="text"
          autoComplete="off"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button type="submit" className={styles.submit} disabled={action.pending}>
          {isCollapsible ? fitnessStrings.common.save : fitnessStrings.common.rename}
        </button>
      </div>
      <InlineError message={action.errorMessage} />
    </form>
  );
}
