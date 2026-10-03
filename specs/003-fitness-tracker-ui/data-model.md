# Data Model: Fitness Tracker UI

This feature changes two tables and adds no new ones. Every other table from
[spec 002's data model](../002-fitness-domain-model/data-model.md) is unchanged. The reasoning is in
[research.md](research.md) R3–R5.

## Changed: `cycles`

Before this feature there was one row per pass, with a number, a status and dates. Now there is **one row
per program**, for the program's whole life (FR-045).

| Column             | Type    | Rules                                                                           |
| ------------------ | ------- | ------------------------------------------------------------------------------- |
| `id`               | text PK | UUID                                                                            |
| `program_id`       | text    | FK → `programs.id`, `ON DELETE CASCADE`, **unique**                             |
| `current_block_id` | text    | The block the user is on. No FK; always a block of the program (see invariants) |
| `pass`             | integer | ≥ 1. Incremented when a new pass starts. Never shown to the user                |

**Removed**: `number`, `status`, `current_block_number`, `started_at`, `ended_at`, the unique index
`cycles_program_number` and the partial index `cycles_one_active_per_program`.

**Indexes**: `cycles_program` unique on `(program_id)`.

**Invariants**:

- Each program has exactly one cycle. `createProgram` inserts it in the same batch, at `pass 1` on the
  first block.
- `current_block_id` always names a block of the same program. Every operation that removes a block moves
  it in the same batch (R7).
- The active program is still `profiles.active_program_id`. A cycle has no notion of "active" of its own.

**State transitions** (pure rules in `domain/progression.ts`):

| Event                                                         | `current_block_id`                                                                                                             | `pass`  | In-progress sessions of the program |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------- | ----------------------------------- |
| Finish the last unfinished workout of a block that isn't last | next block by position                                                                                                         | same    | (the finished one is closed)        |
| Finish the last unfinished workout of the last block          | first block                                                                                                                    | +1      | closed as finished                  |
| Skip to a later block                                         | the chosen block                                                                                                               | same    | closed as finished                  |
| Skip to the first block                                       | first block                                                                                                                    | +1      | closed as finished                  |
| Remove a block before the current one                         | unchanged                                                                                                                      | same    | unchanged                           |
| Remove the current block, not last                            | the block that followed it                                                                                                     | same    | unchanged                           |
| Remove the current block, last                                | first block                                                                                                                    | +1      | closed as finished                  |
| Remove a block after the current one                          | unchanged                                                                                                                      | same    | unchanged                           |
| Remove a workout                                              | unchanged, or the next block if the current block becomes complete, or the first block with `pass +1` if it was the last block | as left | that workout's session closed       |
| Pause, or activate another program                            | unchanged                                                                                                                      | same    | closed as finished                  |
| Activate                                                      | unchanged                                                                                                                      | same    | —                                   |
| Move a block                                                  | unchanged                                                                                                                      | same    | unchanged                           |

The "next block" after removing the current block is taken from the order **before** the removal.

## Changed: `workout_sessions`

| Column              | Type      | Rules                                                                                                    |
| ------------------- | --------- | -------------------------------------------------------------------------------------------------------- |
| `id`                | text PK   |                                                                                                          |
| `profile_id`        | text      | FK → `profiles.id`                                                                                       |
| `program_id`        | text      | No FK (history survives program deletion)                                                                |
| `cycle_id`          | text      | No FK                                                                                                    |
| `pass`              | integer   | **New.** The cycle's `pass` when the session started                                                     |
| `training_block_id` | text      | **New.** Replaces `block_number`. No FK. `'removed-<n>'` for sessions whose block was gone when migrated |
| `workout_id`        | text      | No FK                                                                                                    |
| `status`            | text      | `in_progress` \| `finished`                                                                              |
| `started_at`        | timestamp |                                                                                                          |
| `finished_at`       | timestamp | null while in progress                                                                                   |

**Removed**: `cycle_number`, `block_number` and the index `workout_sessions_cycle_block_workout`.

**Indexes**: `workout_sessions_cycle_pass_block_workout` unique on
`(cycle_id, pass, training_block_id, workout_id)`. That is "one session per workout per block per pass".

**Counting rule**: a session counts towards block completion, workout status and the suggested workout only
when `cycle_id` is the program's cycle, `pass` is the cycle's current `pass`, and `training_block_id` is
the block in question.

## Unchanged in SQL: `set_logs`

The table and its immutability triggers are untouched. In TypeScript, the `cycle_number` column is mapped
to a property named `pass` (`pass: integer('cycle_number')`), and `SetLogContext.cycleNumber` becomes
`pass`. Old rows' cycle numbers are the pass counter, because each program's kept cycle continues from its
highest number (research R5). New set logs store the session's `pass` in that column.

`groupByBlockAcrossCycles` in `domain/history.ts` is renamed to `groupByBlockAcrossPasses` and groups by
`pass`. Its behaviour is the same.

## Migrations

| File                               | Kind      | Content                                                                                                                  |
| ---------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------ |
| `0002_cycle_container_columns.sql` | generated | Adds nullable `cycles.current_block_id`, `cycles.pass`, `workout_sessions.training_block_id` and `workout_sessions.pass` |
| `0003_cycle_container_data.sql`    | custom    | Collapses cycles to one per program, backfills the new columns, inserts missing cycles (research R5)                     |
| `0004_cycle_container_schema.sql`  | generated | Makes the new columns `NOT NULL`, drops the old columns and indexes, and adds the new indexes                            |

The order inside `0003` matters, because the new values come from the old columns:

1. Choose the kept cycle per program: the one with `status = 'active'`, or else the highest `number`.
2. Update the sessions of each program:
   - `pass ← cycle_number` and `cycle_id ← kept cycle`
   - `training_block_id` ← the program's block at `position = block_number`, or `'removed-' || block_number`
     when there's none
   - Sessions of deleted programs keep their `cycle_id` and get the placeholder.
3. Update the kept cycle: `pass ← number`, and `current_block_id` ← the block at `current_block_number`, or
   the last block if that position is gone.
4. Delete the other cycles.
5. Insert `(new id, program, first block, pass 1)` for each program without a cycle.

A storage test builds the old shape with raw SQL, applies `0003`'s statements, and asserts these five steps
(quickstart §2).

## Domain types (TypeScript) after the change

```ts
type Cycle = { id: string; currentBlockId: string; pass: number };

type Program = {
  id: string;
  name: string;
  isActive: boolean;
  blocks: BlockView[];
  workouts: WorkoutView[];
  cycle: Cycle;
};

type ProgramSummary = {
  id: string;
  name: string;
  isActive: boolean;
  blockCount: number;
  workoutCount: number;
};

type BlockStatus = 'complete' | 'current' | 'upcoming' | 'skipped';

type BlockProgress = {
  id: string;
  number: number;
  label: string | null;
  status: BlockStatus;
  finishedCount: number;
};

type TrainingOverview = {
  program: { id: string; name: string };
  currentBlock: { id: string; number: number; label: string | null; isLast: boolean };
  blocks: BlockProgress[];
  workoutCount: number;
  workouts: {
    id: string;
    name: string;
    status: WorkoutProgress;
    sessionId: string | null;
    finishedAt: Date | null;
  }[];
  suggestedWorkoutId: string | null;
};

type SessionView = {
  id: string;
  status: SessionStatus;
  startedAt: Date;
  finishedAt: Date | null;
  workout: { id: string; name: string };
  block: { id: string; number: number | null; label: string | null };
  slots: SessionSlot[];
};

type ExerciseUsage = {
  exercise: Exercise;
  slots: { programId: string; programName: string; workoutId: string; workoutName: string }[];
  hasSetLogs: boolean;
};
```

`SessionView.block.number` is null when the session's block has since been removed. `cycleNumber` and
`blockNumber` are gone from `SessionView`, and `CycleStatus` is deleted.

**Block status rule** (`blockStatuses`, pure):

- The current block is `current`.
- A block after it is `upcoming`.
- A block before it is `complete` when every workout of the program has a finished session for that block in
  the current pass, and `skipped` otherwise.
- `finishedCount` counts the program's current workouts with a finished session for that block in the
  current pass.

## Client-only state

| What                                     | Where                                                                                                 | Lifetime                                       |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Unlogged weight and reps per planned set | `localStorage['fitness:session:<sessionId>']`, `{ [plannedSetId]: { weight: string; reps: string } }` | Until logged, or until the session is finished |
| Device time zone                         | `tz` cookie                                                                                           | One year, rewritten when it changes            |

## Validation summary (UI → domain)

| Input       | UI rule                                                    | Domain refusal                                 |
| ----------- | ---------------------------------------------------------- | ---------------------------------------------- |
| Weight (kg) | empty means no weight; `.` or `,`; at most 2 decimals; > 0 | `invalid-weight`                               |
| Reps        | whole number from 1 to 999                                 | `invalid-reps` / `invalid-target`              |
| Sets × reps | sets: whole number ≥ 1; reps 1–999                         | `prescription-needs-a-set`, `invalid-target`   |
| Names       | trimmed, 1–100 characters                                  | `name-required`, `name-too-long`, `name-taken` |
| Block count | whole number ≥ 1, default 4                                | `invalid-block-count`                          |
