# Contract: Fitness operations

This feature exposes no HTTP endpoints and no screens. Its interface is the set of server-only
operations that later features (exercise catalog, program builder, training, profile & bodyweight)
call from their route handlers and Server Components. This document is that contract. Signatures
are indicative TypeScript. Names may be refined during implementation; the behaviour may not.

## Calling conventions

```ts
type Result<T, E extends string> = { ok: true; value: T } | { ok: false; error: E };
```

- Every operation lives in `src/features/fitness-tracker/server/` and is `server-only`.
- The first parameter is always `db: Database` (from `@/lib/server/database`); callers pass
  `getDatabase()`.
- Every profile-scoped operation takes `profileId`, obtained from `ensureProfile`. An ID that doesn't
  belong to that profile behaves exactly like one that doesn't exist (`not-found`), so it reveals
  nothing about other profiles (FR-001).
- Time is never read inside an operation. Callers pass `now: Date` and, where the day matters,
  `timeZone: string` (IANA).
- Weights cross this boundary in **kilograms** (`number`), reps as `number`.
- Expected refusals return `{ ok: false, error }` with one of the codes listed per operation.
  Infrastructure failures throw. A refused operation writes nothing (FR-042).
- Operations that write several rows do so atomically (research R5).

Codes accepted by every operation that takes the matching input: `not-found`, `name-required`,
`name-too-long`, `invalid-weight`, `invalid-target`, `invalid-reps`, `invalid-time-zone`.

## Profile

| Operation                                | Returns   | Refusals | Spec   |
| ---------------------------------------- | --------- | -------- | ------ |
| `ensureProfile(db, accountSubject, now)` | `Profile` | —        | FR-002 |

## Exercise catalog

| Operation                                                                                          | Returns              | Refusals          | Spec   |
| -------------------------------------------------------------------------------------------------- | -------------------- | ----------------- | ------ |
| `listExercises(db, profileId, { includeArchived })`                                                | `Exercise[]` by name | —                 |        |
| `addExercise(db, profileId, { name }, now)`                                                        | `Exercise`           | `name-taken`      | FR-004 |
| `renameExercise(db, profileId, exerciseId, { name })`                                              | `Exercise`           | `name-taken`      | FR-004 |
| `archiveExercise(db, profileId, exerciseId, now)` / `unarchiveExercise(db, profileId, exerciseId)` | `Exercise`           | —                 | FR-005 |
| `deleteExercise(db, profileId, exerciseId)`                                                        | `void`               | `exercise-in-use` | FR-005 |

`Exercise = { id, name, isArchived }`

## Program structure

| Operation                                                                         | Returns                            | Refusals                                                                       | Spec                |
| --------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------ | ------------------- |
| `listPrograms(db, profileId)`                                                     | `ProgramSummary[]` with `isActive` | —                                                                              |                     |
| `getProgram(db, profileId, programId)`                                            | `Program` (full tree)              | —                                                                              |                     |
| `createProgram(db, profileId, { name, blockCount }, now)`                         | `Program`                          | `invalid-block-count`                                                          | FR-007              |
| `renameProgram(db, profileId, programId, { name })`                               | `Program`                          | —                                                                              | FR-007              |
| `deleteProgram(db, profileId, programId, now)`                                    | `void`                             | —                                                                              | FR-033, FR-034      |
| `addTrainingBlock(db, profileId, programId, { label? })`                          | `Program`                          | —                                                                              | FR-010, R10         |
| `labelTrainingBlock(db, profileId, blockId, { label })`                           | `Program`                          | —                                                                              | FR-008              |
| `moveTrainingBlock(db, profileId, blockId, { toPosition })`                       | `Program`                          | `invalid-position`                                                             | R9                  |
| `removeTrainingBlock(db, profileId, blockId, now)`                                | `Program`                          | `program-needs-a-block`                                                        | R9, FR-039          |
| `addWorkout(db, profileId, programId, { name })`                                  | `Program`                          | —                                                                              | FR-009              |
| `renameWorkout` / `moveWorkout` / `removeWorkout(…, now)`                         | `Program`                          | `invalid-position`                                                             | FR-009, FR-039      |
| `addExerciseSlot(db, profileId, workoutId, { exerciseId, targetReps: number[] })` | `Program`                          | `exercise-archived`, `exercise-already-in-workout`, `prescription-needs-a-set` | FR-009, FR-010, R10 |
| `replaceSlotExercise(db, profileId, slotId, { exerciseId })`                      | `Program`                          | `exercise-archived`, `exercise-already-in-workout`                             | rule 18, FR-037     |
| `setSlotOptional(db, profileId, slotId, { isOptional })`                          | `Program`                          | —                                                                              | rule 20             |
| `moveExerciseSlot` / `removeExerciseSlot`                                         | `Program`                          | `invalid-position`                                                             | FR-009              |
| `setPrescription(db, profileId, slotId, blockId, { targetReps: number[] })`       | `Program`                          | `prescription-needs-a-set`                                                     | FR-011, FR-038, R10 |

```ts
type Program = {
  id: string;
  name: string;
  isActive: boolean;
  blocks: { id: string; number: number; label: string | null }[];
  workouts: {
    id: string;
    name: string;
    slots: {
      id: string;
      exercise: Exercise;
      isOptional: boolean;
      prescriptions: {
        blockId: string;
        plannedSets: {
          id: string;
          setNumber: number;
          targetReps: number;
          lastWeightKg: number | null;
        }[];
      }[];
    }[];
  }[];
  activeCycle: Cycle | null;
};
```

Only removals can change progression, so `removeWorkout` and `removeTrainingBlock` re-evaluate the
active cycle (FR-039) in the same batch and take `now` for a cycle that completes as a result.
Adding or moving workouts and blocks cannot complete a block, so those edits do not.
`deleteProgram` ends the program's cycle, so it also closes the program's in-progress sessions as
finished at `now`, and leaves the profile with no active program if it was the active one.

## Activation and cycles

| Operation                                        | Returns                  | Refusals             | Spec                      |
| ------------------------------------------------ | ------------------------ | -------------------- | ------------------------- |
| `activateProgram(db, profileId, programId, now)` | `Cycle` (the active one) | `program-incomplete` | rules 1–3, FR-015, FR-017 |
| `pauseActiveProgram(db, profileId, now)`         | `void`                   | `no-active-program`  | rule 2, FR-016            |
| `startOver(db, profileId, now)`                  | `Cycle` (the new one)    | `no-active-program`  | rule 8, FR-021            |
| `listCycles(db, profileId, programId)`           | `Cycle[]` by number      | —                    | FR-018                    |

`Cycle = { id, number, status: 'active' | 'completed' | 'ended_early', currentBlockNumber, startedAt,
endedAt }`

Activating the program that is already active returns its current cycle and changes nothing.
`program-incomplete` covers both "no workouts" and "a slot without planned sets for some block".

## Training

| Operation                                                                  | Returns                                                            | Refusals                                                                         | Spec                        |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------- | --------------------------- |
| `getTrainingOverview(db, profileId)`                                       | `TrainingOverview \| null` (null when nothing is active)           | —                                                                                | rule 10, FR-025             |
| `startWorkout(db, profileId, workoutId, now)`                              | `SessionView`                                                      | `no-active-program`, `workout-not-in-active-program`, `workout-already-finished` | rule 10, FR-024             |
| `getSession(db, profileId, sessionId)`                                     | `SessionView`                                                      | —                                                                                | rule 14, FR-028             |
| `logSet(db, profileId, sessionId, plannedSetId, { reps, weightKg? }, now)` | `SetLog`                                                           | `session-not-in-progress`, `planned-set-not-in-session`                          | rules 15–16, FR-029, FR-030 |
| `finishWorkout(db, profileId, sessionId, now)`                             | `{ progression: 'none' \| 'block-advanced' \| 'cycle-completed' }` | `session-not-in-progress`                                                        | rules 6–7, 12, FR-027       |

```ts
type TrainingOverview = {
  program: { id: string; name: string };
  cycle: Cycle;
  block: { number: number; label: string | null; count: number };
  workouts: { id: string; name: string; status: 'not-started' | 'in-progress' | 'finished' }[];
  suggestedWorkoutId: string | null;
};

type SessionView = {
  id: string;
  status: 'in_progress' | 'finished';
  startedAt: Date;
  finishedAt: Date | null;
  workout: { id: string; name: string };
  cycleNumber: number;
  blockNumber: number;
  slots: {
    id: string;
    exercise: Exercise;
    isOptional: boolean;
    plannedSets: {
      id: string;
      setNumber: number;
      targetReps: number;
      suggestedWeightKg: number | null;
    }[];
    loggedSets: SetLog[];
  }[];
};

type SetLog = {
  id: string;
  exerciseId: string;
  performedAt: Date;
  setNumber: number;
  reps: number;
  weightKg: number | null;
  context: {
    programId: string;
    cycleId: string;
    cycleNumber: number;
    trainingBlockId: string;
    blockNumber: number;
    workoutId: string;
    exerciseSlotId: string;
    workoutSessionId: string;
  };
};
```

Logging the same planned set twice creates two set logs, and the later weight wins as the last
weight (spec edge case).

## History

| Operation                                       | Returns                                                      | Refusals | Spec           |
| ----------------------------------------------- | ------------------------------------------------------------ | -------- | -------------- |
| `getExerciseHistory(db, profileId, exerciseId)` | `{ exercise, setLogs: SetLog[] }`, set logs by `performedAt` | —        | FR-035, SC-006 |

Grouping by block across cycles is a pure domain function over that list, so the future progress
feature can pick the grouping it needs.

## Bodyweight

| Operation                                                      | Returns                                   | Refusals                   | Spec            |
| -------------------------------------------------------------- | ----------------------------------------- | -------------------------- | --------------- |
| `getWeighInStatus(db, profileId, now, timeZone)`               | `{ isAvailable: boolean; today: string }` | —                          | rule 22, FR-041 |
| `recordBodyweight(db, profileId, { weightKg }, now, timeZone)` | `BodyweightEntry`                         | `already-weighed-in-today` | rule 21, FR-040 |
| `listBodyweight(db, profileId)`                                | `BodyweightEntry[]` by date               | —                          |                 |

`BodyweightEntry = { id, date: 'YYYY-MM-DD', weightKg }`
