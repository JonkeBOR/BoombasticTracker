'use client';

import { useId } from 'react';
import { fitnessStrings } from '@/lib/strings/fitness';
import type { SessionSlot, SessionView, SetLog } from '../domain/types';
import { FinishWorkoutBar } from './FinishWorkoutBar';
import { SetRow } from './SetRow';
import styles from './SessionBody.module.css';
import { useSetDrafts } from './useSetDrafts';

type SessionBodyProps = { session: SessionView };

function loggedFor(slot: SessionSlot, setNumber: number): SetLog | null {
  const matches = slot.loggedSets.filter((logged) => logged.setNumber === setNumber);
  return matches[matches.length - 1] ?? null;
}

function SlotSection({
  session,
  slot,
  drafts,
  setDraft,
  clearDraft,
}: {
  session: SessionView;
  slot: SessionSlot;
  drafts: ReturnType<typeof useSetDrafts>['drafts'];
  setDraft: ReturnType<typeof useSetDrafts>['setDraft'];
  clearDraft: ReturnType<typeof useSetDrafts>['clearDraft'];
}) {
  const headingId = useId();
  return (
    <section
      className={slot.isOptional ? styles.optionalSlot : styles.slot}
      aria-labelledby={headingId}
    >
      <div className={styles.header}>
        <h2 id={headingId} className={styles.exercise}>
          {slot.exercise.name}
        </h2>
        {slot.isOptional ? (
          <span className={styles.tag}>{fitnessStrings.common.optional}</span>
        ) : null}
      </div>
      <table className={styles.sets} aria-labelledby={headingId}>
        <thead>
          <tr>
            <th scope="col" className={styles.setColumn}>
              {fitnessStrings.session.columns.set}
            </th>
            <th scope="col" className={styles.column}>
              {fitnessStrings.session.columns.weight}
            </th>
            <th scope="col" className={styles.column}>
              {fitnessStrings.session.columns.reps}
            </th>
            <th scope="col" className={styles.logColumn}>
              <span className={styles.visuallyHidden}>{fitnessStrings.session.columns.log}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {slot.plannedSets.map((plannedSet) => (
            <SetRow
              key={plannedSet.id}
              sessionId={session.id}
              exerciseName={slot.exercise.name}
              plannedSet={plannedSet}
              logged={loggedFor(slot, plannedSet.setNumber)}
              draft={drafts[plannedSet.id]}
              onDraftChange={(patch) => setDraft(plannedSet.id, patch)}
              onLogged={() => clearDraft(plannedSet.id)}
            />
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function SessionBody({ session }: SessionBodyProps) {
  const { drafts, setDraft, clearDraft, clearAll } = useSetDrafts(session.id);
  const hasLoggedSets = session.slots.some((slot) => slot.loggedSets.length > 0);

  return (
    <>
      {session.slots.length === 0 ? (
        <p className={styles.empty}>{fitnessStrings.session.nothingToLog}</p>
      ) : (
        session.slots.map((slot) => (
          <SlotSection
            key={slot.id}
            session={session}
            slot={slot}
            drafts={drafts}
            setDraft={setDraft}
            clearDraft={clearDraft}
          />
        ))
      )}
      <FinishWorkoutBar
        sessionId={session.id}
        hasLoggedSets={hasLoggedSets}
        onFinished={clearAll}
      />
    </>
  );
}
