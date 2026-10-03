'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useId, useState } from 'react';
import { fitnessErrorStrings, fitnessStrings } from '@/lib/strings/fitness';
import { InlineError } from './InlineError';
import styles from './NewProgramForm.module.css';
import { readId } from './read-id';
import { useFitnessAction } from './useFitnessAction';

const defaultBlockCount = '4';
const wholeNumber = /^\d+$/;

export function NewProgramForm() {
  const router = useRouter();
  const nameId = useId();
  const blocksId = useId();
  const [name, setName] = useState('');
  const [blocks, setBlocks] = useState(defaultBlockCount);
  const [inputError, setInputError] = useState<string | null>(null);
  const action = useFitnessAction();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const blockCount = wholeNumber.test(blocks.trim()) ? Number(blocks.trim()) : 0;
    if (blockCount < 1) {
      setInputError(fitnessErrorStrings['invalid-block-count']);
      return;
    }
    setInputError(null);
    await action.run('POST', '/api/fitness/programs', { name, blockCount }, (created) => {
      const id = readId(created);
      if (id !== null) {
        router.push(`/fitness-tracker/programs/${id}`);
      }
    });
  }

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)}>
      <h2 className={styles.heading}>{fitnessStrings.programs.newProgram}</h2>
      <label className={styles.label} htmlFor={nameId}>
        {fitnessStrings.programs.nameLabel}
      </label>
      <input
        id={nameId}
        className={styles.input}
        type="text"
        autoComplete="off"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <label className={styles.label} htmlFor={blocksId}>
        {fitnessStrings.programs.blocksLabel}
      </label>
      <input
        id={blocksId}
        className={styles.input}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={blocks}
        onChange={(event) => setBlocks(event.target.value)}
      />
      <button type="submit" className={styles.submit} disabled={action.pending}>
        {fitnessStrings.programs.create}
      </button>
      <InlineError message={inputError ?? action.errorMessage} />
    </form>
  );
}
