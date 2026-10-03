# Contract: Changes to the fitness operations

This is a delta against [spec 002's operations contract](../../002-fitness-domain-model/contracts/fitness-operations.md).
Calling conventions are unchanged: `db` first, `profileId` scoping, `now` passed in, and a `Result` with
stable codes. Anything not listed here is unchanged.

## Removed

| Operation                              | Replaced by                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------ |
| `startOver(db, profileId, now)`        | `skipToBlock` with the program's first block                                         |
| `listCycles(db, profileId, programId)` | nothing: history is out of scope, and a program has a single cycle (`Program.cycle`) |

## Added

| Operation                                      | Returns                | Refusals                             | Spec           |
| ---------------------------------------------- | ---------------------- | ------------------------------------ | -------------- |
| `skipToBlock(db, profileId, { blockId }, now)` | `{ newPass: boolean }` | `no-active-program`, `invalid-block` | FR-040, R6     |
| `getExerciseUsage(db, profileId, exerciseId)`  | `ExerciseUsage`        | `not-found`                          | FR-036, FR-041 |

`skipToBlock`:

- **The program's first block**: starts a new pass and returns `{ newPass: true }`.
- **A block after the current one**: becomes current and returns `{ newPass: false }`.
- **Any other block, or one not in the active program**: `invalid-block`.

Both write cases close the program's in-progress sessions as finished at `now`, in the same batch.

## Changed behaviour

| Operation             | Change                                                                                                                                                                    | Spec           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `createProgram`       | Also inserts the program's cycle (`pass 1`, first block) in the same batch                                                                                                | FR-045         |
| `activateProgram`     | Never creates or ends a cycle. It closes the previously active program's in-progress sessions and sets `active_program_id`. Activating the active program changes nothing | FR-045         |
| `pauseActiveProgram`  | Closes the program's in-progress sessions and clears `active_program_id`. The cycle keeps its block and pass                                                              | FR-045         |
| `finishWorkout`       | Counts sessions of the current pass and block ID. Returns `progression: 'none' \| 'block-advanced' \| 'new-pass'` (was `'cycle-completed'`) plus `completedBlockNumber`   | FR-045, R3     |
| `startWorkout`        | The session stores `pass` and `training_block_id`. Uniqueness is per cycle, pass, block and workout                                                                       | FR-045, R3     |
| `logSet`              | The set log's `cycle_number` column receives the session's `pass`. The planned set is matched by the session's `training_block_id`                                        | FR-045         |
| `removeTrainingBlock` | Re-evaluates the program's cycle whether or not it is active, using block identity (data-model transitions)                                                               | FR-043, R7     |
| `removeWorkout`       | Same, and closes that workout's in-progress session in the same batch                                                                                                     | FR-042, R7     |
| `deleteProgram`       | Unchanged. The cycle goes by cascade, as before                                                                                                                           |                |
| `getTrainingOverview` | Returns the new `TrainingOverview` (data model): block progress for every block, session IDs, no `cycle`                                                                  | FR-011, FR-041 |
| `getSession`          | Returns `block: { id, number, label }` instead of `cycleNumber` and `blockNumber`. It doesn't fail when the session's block has been removed                              | FR-017         |
| `getProgram`          | `activeCycle` is replaced by `cycle: { id, currentBlockId, pass }`                                                                                                        | FR-034         |
| `listPrograms`        | Adds `blockCount` and `workoutCount`                                                                                                                                      | FR-025, FR-041 |
| `getExerciseHistory`  | Set logs' context has `pass` instead of `cycleNumber`                                                                                                                     | FR-045         |

## Pure rules (domain)

| Rule                                  | Module                  | Change                                                                                                  |
| ------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------- |
| `decideAfterFinish`                   | `domain/progression.ts` | Works on the ordered block IDs and the current block ID. Returns `advance` to a block ID, or `new-pass` |
| `decideSkip`                          | `domain/progression.ts` | **New**                                                                                                 |
| `reevaluateAfterEdit`                 | `domain/progression.ts` | Works on the block order before and after the edit, and on the removed block ID                         |
| `decideActivation`, `decideStartOver` | `domain/progression.ts` | **Removed**: activation no longer decides about cycles                                                  |
| `blockStatuses`                       | `domain/progression.ts` | **New** (data model, block status rule)                                                                 |
| `isPlannedSetLogged`                  | `domain/logging.ts`     | **New** (research R9)                                                                                   |
| `parseKgInput`, `formatKg`            | `domain/values.ts`      | **New** (research R11)                                                                                  |
| `groupByBlockAcrossCycles`            | `domain/history.ts`     | Renamed `groupByBlockAcrossPasses`. Groups by `pass`                                                    |

## Tests that change

Spec 002's tests for rules 4–9 and 13 assert behaviour that FR-045 deliberately replaces: cycle numbers,
`completed` and `ended_early`, a new cycle on activation, and ending a cycle on pause. They are rewritten to
the new transitions table, not deleted. Each test title keeps its rule reference and adds the FR it now
follows. Every other spec 002 test keeps its assertions (FR-044). Only the renamed fields (`pass`,
`block`) and shared fixture helpers change where the types require it.
