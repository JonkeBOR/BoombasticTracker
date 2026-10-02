---
description: 'Task list for the fitness tracker domain model'
---

# Tasks: Fitness Tracker Domain Model

**Input**: Design documents from `specs/002-fitness-domain-model/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/fitness-operations.md](contracts/fitness-operations.md),
[quickstart.md](quickstart.md)

**Tests**: Required. Development is test-driven (constitution, Development Workflow), and this is a
**domain-only feature** under constitution 2.1.0, so the spec's acceptance scenarios are the
acceptance tests. Each story phase opens by writing that story's acceptance tests in Vitest and
confirming they fail for the intended reason ("not implemented" or a failed assertion, never a
missing import or type error). The story is done when they pass **unmodified**. Domain rules inside
a story are driven by a red-green-refactor loop of pure unit tests.

**Organization**: Tasks are grouped by user story so each story can be built and verified on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: The user story the task belongs to (US1–US5)

## Conventions every task follows

Read these once; tasks don't repeat them.

- **Repository rules**: no comments in source; no `any`; no `as`, `!` or `@ts-expect-error` (narrow
  instead); `type` over `interface`; named exports; `@/*` imports; explicit return types on
  exported async functions. See `docs/03-typescript.md`.
- **Pure domain**: files in `src/features/fitness-tracker/domain/` are pure. They do no I/O, never
  import Drizzle or `server-only`, and never read the clock (callers pass `now`). Their tests are
  `*.test.ts` beside them and run in the Vitest `node` project.
- **Server modules**: files in `src/features/fitness-tracker/server/` start with
  `import 'server-only';` and take `db: Database` (from `@/lib/server/database`) as their first
  parameter. Profile-scoped operations take `profileId` next. Every operation filters by
  `profileId`, and a foreign ID behaves exactly like a missing one (`not-found`).
- **Results**: expected refusals return `Result<T, E>` from `domain/result.ts` with the error codes
  listed in [the contract](contracts/fitness-operations.md). Infrastructure failures throw. A
  refusal writes nothing.
- **Atomicity**: an operation that writes more than one row decides everything first, then issues
  **one** `db.batch([...])` (research R5).
- **Units**: weights cross the operation boundary in kg (`number`) and are stored as integer grams;
  instants are `Date` and are stored as epoch ms.
- **Storage tests**: `*.storage.test.ts` files run in the Vitest `storage` project against real
  local D1. Use the harness from T008. Each test creates its own profile with
  `ensureProfile(db, crypto.randomUUID(), now)` and never relies on rows from another test.
- **Rule numbers**: every acceptance or unit test that proves a domain rule names the rule in its
  title, e.g. `it('rule 15: logging a set records it and updates last weight together', …)`. Rule
  numbers refer to `domain-spec.md` (SC-002).
- **Finishing a task**: finish every code task with `pwsh -NoProfile -File scripts/check.ps1`. The
  only failures allowed while a story is in progress are that story's acceptance tests.

---

## Phase 1: Setup (shared infrastructure)

**Purpose**: Drizzle, the D1 access point and the storage test harness. No domain code yet.

- [x] T001 Add the dependencies in `package.json` and `package-lock.json`: run `npm install drizzle-orm@^0.45` and `npm install --save-dev drizzle-kit@^0.31`. If npm blocks an install script, record the approval under `allowScripts` in `package.json` instead of disabling the check (research R1).
- [x] T002 [P] Create `drizzle.config.ts` at the repository root with `defineConfig({ dialect: 'sqlite', schema: './src/features/fitness-tracker/server/schema.ts', out: './migrations' })` from `drizzle-kit`. Set no driver or credentials, because only `generate` is used (research R1).
- [x] T003 [P] Delete `migrations/0001_baseline.sql`. It holds only `SELECT 1;`, and its row in remote `d1_migrations` is harmless (research R1).
- [x] T004 [P] Create `src/lib/server/database.ts`:
  - `import 'server-only'`.
  - Export `type Database = DrizzleD1Database<typeof schema>`, with `schema` imported as `* as schema` from `@/features/fitness-tracker/server/schema`.
  - Export `function getDatabase(): Database`, returning `drizzle(getCloudflareContext().env.DB, { schema })`, with `getCloudflareContext` from `@opennextjs/cloudflare` and `drizzle` from `drizzle-orm/d1`.
  - This is the only module in `src/` that touches the `DB` binding (research R2). If `env.DB` is not typed, add the binding type with `npx wrangler types` (writes `cloudflare-env.d.ts`) instead of casting.
- [x] T005 Update `vitest.config.mts`:
  - Add `'src/features/**/*.test.ts'` to the `node` project's `include`.
  - Add `exclude: ['**/*.storage.test.ts', '**/node_modules/**']` to the `node` project.
  - Add a third project, `{ extends: true, test: { name: 'storage', environment: 'node', include: ['src/**/*.storage.test.ts'], globalSetup: ['./vitest.storage-setup.ts'], testTimeout: 30000, hookTimeout: 60000, fileParallelism: false } }`.
  - Keep the existing `dom` project unchanged (research R4).
- [x] T006 Create `vitest.storage-setup.ts` at the repository root. It exports a default `async function setup(): Promise<void>` that:
  - Deletes `.wrangler/test-state` recursively (`fs.rm`, `force: true`).
  - Runs `npx wrangler d1 migrations apply onestopshop --local --persist-to .wrangler/test-state` with `child_process.execFileSync`, `stdio: 'inherit'`, `shell: true` on Windows.
  - Throws if the command fails.

  Verify that `.wrangler/` is already git-ignored (it is) (research R4).

- [x] T007 Generate the first migration once T009 (the schema) exists: run `npx drizzle-kit generate --name fitness_domain`. Confirm `migrations/0000_fitness_domain.sql` and `migrations/meta/` were created and that `npx wrangler d1 migrations apply onestopshop --local` applies cleanly, with `meta/` ignored. Do not hand-edit the generated SQL (research R1, verify step).
- [x] T008 Create the storage test harness `src/features/fitness-tracker/server/storage-test-database.ts` (imported only by `*.storage.test.ts`):
  - Export `async function openTestDatabase(): Promise<{ db: Database; dispose: () => Promise<void> }>`. It calls `getPlatformProxy({ persist: { path: '.wrangler/test-state/v3' } })` from `wrangler`, takes `env.DB`, and wraps it with `drizzle(…, { schema })`.
  - First confirm the exact `persist.path` that shares state with `--persist-to .wrangler/test-state`, and whether `v3` is appended automatically. Prove it with a smoke test, `src/features/fitness-tracker/server/harness.storage.test.ts`, which asserts that `sqlite_master` lists all eleven tables and the two `set_logs` triggers.
  - Record the measured per-file startup time in the PR description (research R4).

**Checkpoint**: `npx vitest run --project storage` runs the smoke test green against a migrated local D1.

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: Schema, migrations, the shared domain values and profiles. Every story needs these.

- [x] T009 Create `src/features/fitness-tracker/server/schema.ts` with Drizzle's `sqliteTable` for all eleven tables in [data-model.md](data-model.md), with these exact constraints:
  - `profiles`: `id` text PK; `account_subject` text **unique, not null**; `active_program_id` text null, FK → `programs.id` **ON DELETE SET NULL**; `created_at` integer `timestamp_ms` not null.
  - `exercises`: `id` text PK; `profile_id` FK → `profiles.id` not null; `name` text not null ("trimmed, 1–100 characters"); `name_key` text not null; **unique index (`profile_id`, `name_key`)**; `archived_at` integer `timestamp_ms` null; `created_at` not null.
  - `programs`: `id` text PK; `profile_id` FK not null; `name` text not null ("not required to be unique"); `created_at` not null.
  - `training_blocks`: `id` text PK; `program_id` FK → `programs.id` **ON DELETE CASCADE**; `position` integer not null; **unique (`program_id`, `position`)**; `label` text null.
  - `workouts`: `id` text PK; `program_id` FK **ON DELETE CASCADE**; `position` integer not null; **unique (`program_id`, `position`)**; `name` text not null.
  - `exercise_slots`: `id` text PK; `workout_id` FK → `workouts.id` **ON DELETE CASCADE**; `position` integer not null; **unique (`workout_id`, `position`)**; `exercise_id` FK → `exercises.id` **ON DELETE RESTRICT**; `is_optional` integer boolean not null default false.
  - `planned_sets`: `id` text PK; `exercise_slot_id` FK **ON DELETE CASCADE**; `training_block_id` FK → `training_blocks.id` **ON DELETE CASCADE**; `set_number` integer not null; **unique (`exercise_slot_id`, `training_block_id`, `set_number`)**; `target_reps` integer not null ("1–999"); `last_weight_grams` integer null.
  - `cycles`: `id` text PK; `program_id` FK **ON DELETE CASCADE**; `number` integer not null; **unique (`program_id`, `number`)**; `status` text not null, enum `['active','completed','ended_early']`; `current_block_number` integer not null; `started_at` not null; `ended_at` null; **partial unique index on (`program_id`) `.where(sql\`status = 'active'\`)`**.
  - `workout_sessions`: `id` text PK; `profile_id` FK not null; `program_id`, `cycle_id`, `workout_id` text not null with **no FK**; `cycle_number`, `block_number` integer not null; `status` text enum `['in_progress','finished']` not null; `started_at` not null; `finished_at` null; **unique (`cycle_id`, `block_number`, `workout_id`)**.
  - `set_logs`: `id` text PK; `profile_id` FK not null; `exercise_id` FK → `exercises.id` **ON DELETE RESTRICT**; `performed_at` not null; `set_number`, `reps` integer not null; `weight_grams` integer null; `program_id`, `cycle_id`, `training_block_id`, `workout_id`, `exercise_slot_id`, `workout_session_id` text not null with **no FK**; `cycle_number`, `block_number` integer not null; **index (`profile_id`, `exercise_id`, `performed_at`)**.
  - `bodyweight_entries`: `id` text PK; `profile_id` FK not null; `entry_date` text not null (`YYYY-MM-DD`); **unique (`profile_id`, `entry_date`)**; `weight_grams` integer not null ("1–1,000,000"); `recorded_at` not null.

  Also export Drizzle `relations` for the program tree (program → blocks, workouts → slots → planned sets; slot → exercise; program → cycles) so `db.query.programs.findFirst({ with: … })` can load a whole program. Then run T007.

- [x] T010 Create the custom migration: `npx drizzle-kit generate --custom --name set_log_immutability`, then fill `migrations/0001_set_log_immutability.sql` with two triggers, `CREATE TRIGGER set_logs_no_update BEFORE UPDATE ON set_logs BEGIN SELECT RAISE(ABORT, 'set_logs are immutable'); END;` and the same `BEFORE DELETE` as `set_logs_no_delete`, separated by `--> statement-breakpoint`. Apply locally with Wrangler and confirm both triggers exist. If Wrangler's splitter breaks the body, put each trigger on one line (research R6, verify step).
- [x] T011 [P] Create `src/features/fitness-tracker/domain/result.ts`: `export type Result<T, E extends string> = { ok: true; value: T } | { ok: false; error: E }`, plus `succeed(value)` and `fail(error)` helpers.
- [x] T012 [P] Test-first: `src/features/fitness-tracker/domain/values.test.ts`, then `src/features/fitness-tracker/domain/values.ts`. Implement validated constructors returning `Result`:
  - `parseWeightKg(kg)`: "> 0, ≤ 1000, at most 3 decimal places", else `invalid-weight`. Returns grams as an integer. Also `gramsToKg(grams)`.
  - `parseTargetReps(n)`: "whole reps, 1–999", else `invalid-target`.
  - `parseLoggedReps(n)`: "1–999", else `invalid-reps`.
  - `parseName(text)`: trims; empty gives `name-required`, more than 100 characters gives `name-too-long`.
  - `localDate(now, timeZone)`: `YYYY-MM-DD` via `Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })`. A `RangeError` gives `invalid-time-zone` (research R8).

  Include tests for 22.5 kg ⇄ 22500 g, 0 and negative values, 1000.0005 kg, 12.5 reps, `'  '` names, and `Europe/Stockholm` at 23:30 vs 00:10 local time.

- [x] T013 [P] Create `src/features/fitness-tracker/server/mapping.ts`: pure row ⇄ contract-type mappers (`toExercise`, `toCycle`, `toSetLog`, `toBodyweightEntry`, and a `toProgram` that sorts blocks, workouts, slots and planned sets by position or set number and converts grams to kg). Write `mapping.test.ts` first (node project, no database).
- [x] T014 Test-first: `src/features/fitness-tracker/server/profile.storage.test.ts`, then `src/features/fitness-tracker/server/profile.ts`. `ensureProfile(db, accountSubject, now): Promise<Profile>` runs `INSERT … ON CONFLICT (account_subject) DO NOTHING` and then selects. Calling it twice with the same subject returns the same `id` (FR-002, research R7).

**Checkpoint**: the schema, both migrations, values and profiles are green. The story phases can start.

---

## Phase 3: User Story 1 — Build a periodized program (Priority: P1) 🎯 MVP

**Goal**: the exercise catalog and complete program structure: blocks, workouts, slots and
per-block prescriptions, with empty last weights.

**Independent test**: create exercises and a program with blocks 1–3 plus a deload block, two
workouts and several slots with different prescriptions per block. Read it back with `getProgram`
and assert the structure, order, targets and null last weights. Invalid input is refused and writes
nothing.

### Acceptance tests (write first, confirm red)

- [x] T015 [US1] Add stub exports, with the exact contract signatures, that throw `new Error('not implemented')` in `src/features/fitness-tracker/server/exercises.ts` (`listExercises`, `addExercise`, `renameExercise`, `archiveExercise`, `unarchiveExercise`) and `src/features/fitness-tracker/server/programs.ts` (`listPrograms`, `getProgram`, `createProgram`, `renameProgram`, `addTrainingBlock`, `labelTrainingBlock`, `moveTrainingBlock`, `addWorkout`, `renameWorkout`, `moveWorkout`, `addExerciseSlot`, `setSlotOptional`, `moveExerciseSlot`, `removeExerciseSlot`, `setPrescription`). Use the `Program`/`Exercise` types from the contract in `src/features/fitness-tracker/server/types.ts`. This makes the acceptance tests fail on behaviour, not on imports.
- [x] T016 [P] [US1] Write `src/features/fitness-tracker/server/exercises.storage.test.ts` with:
  - US1 scenario 1: add "Incline bench press", and adding " incline BENCH press " is refused `name-taken`.
  - Rename to an existing name is refused `name-taken`.
  - Archive hides the exercise from `listExercises({ includeArchived: false })` and shows it with `includeArchived: true`.
  - An empty name is refused `name-required`.
  - A refused add leaves the catalog unchanged.

  Run and confirm red.

- [x] T017 [P] [US1] Write `src/features/fitness-tracker/server/programs.storage.test.ts` with:
  - US1 scenario 2: blocks 1, 2, 3 and "Deload"; `setPrescription` 3×12, 3×10, 3×8, 2×10; each block returns its own planned sets numbered from 1 with `lastWeightKg: null`.
  - US1 scenario 3: a target of 0 reps is refused `invalid-target`, as are 12.5 and 1000.
  - US1 scenario 4, rule 19: `addTrainingBlock` gives every slot planned sets copied from the last block's targets, all with null last weight.
  - US1 scenario 5, rule 20: `setSlotOptional` changes only `isOptional`.
  - `createProgram` with `blockCount: 0` is refused `invalid-block-count`.
  - `addExerciseSlot` with an archived exercise is refused `exercise-archived`.
  - `addExerciseSlot` with `targetReps: []` is refused `prescription-needs-a-set`.
  - Moving a workout, slot or block renumbers positions contiguously 1…n.

  Run and confirm red.

### Implementation

- [x] T018 [P] [US1] Test-first: `src/features/fitness-tracker/domain/exercise.test.ts`, then `src/features/fitness-tracker/domain/exercise.ts`.
  - `exerciseNameKey(name)`: `name.trim().toLocaleLowerCase()`.
  - `canUseInSlot(exercise)`: false when archived, giving `exercise-archived` (FR-004, FR-006).
- [x] T019 [P] [US1] Test-first: `src/features/fitness-tracker/domain/program.test.ts`, then `src/features/fitness-tracker/domain/program.ts`. These are pure functions over a plain `ProgramTree` type:
  - `initialBlocks(blockCount)`: refuses below 1 with `invalid-block-count`.
  - `plannedSetsForNewBlock(tree)`: copies the last block's `targetReps` per slot, with null last weight (research R10, rule 19).
  - `plannedSetsForNewSlot(targetReps, blocks)`: the same list for every block; empty gives `prescription-needs-a-set`.
  - `replacePrescription(existing, targetReps)`: set numbers that still exist keep their `lastWeightGrams` even if the target changes; new numbers get null; removed ones are dropped (spec edge cases, FR-038).
  - `renumber(items)` and `move(items, id, toPosition)`: contiguous 1…n; an out-of-range position gives `invalid-position`.
  - `isActivatable(tree)`: false when there are no workouts or any slot has no planned sets for some block (FR-017).
- [x] T020 [US1] Implement the catalog operations in `src/features/fitness-tracker/server/exercises.ts`: `listExercises` (sorted by `name_key`), `addExercise`, `renameExercise`, `archiveExercise`, `unarchiveExercise`. Check `name-taken` with a select on `(profile_id, name_key)` before writing, and also map a unique-constraint failure to `name-taken`, so a race still refuses cleanly.
- [x] T021 [US1] Implement the program operations in `src/features/fitness-tracker/server/programs.ts` with the domain functions from T019:
  - `listPrograms` (with `isActive` from `profiles.active_program_id`).
  - `getProgram` (one `db.query.programs.findFirst` with nested `with`, then `toProgram`). The `activeCycle` field is null until US2.
  - `createProgram`, `renameProgram`, `addTrainingBlock`, `labelTrainingBlock`, `moveTrainingBlock`, `addWorkout`, `renameWorkout`, `moveWorkout`, `addExerciseSlot`, `setSlotOptional`, `moveExerciseSlot`, `removeExerciseSlot`, `setPrescription`.

  Each edit is one `db.batch`. Renumbering must avoid transient unique-index collisions on `(…, position)`: first shift the affected rows to negative positions, then write the final positions, in the same batch.

- [x] T022 [US1] Run T016 and T017 unmodified until green, then run `scripts/check.ps1`.

**Checkpoint**: User Story 1 is complete and independently verifiable. This is the MVP.

---

## Phase 4: User Story 2 — Train a workout with prefilled weights (Priority: P1)

**Goal**: activate a program, start or resume workouts in the current block, log sets that update
last weight atomically, skip freely, and finish sessions.

**Independent test**: create and activate a program with T021's operations, start a session, log
some sets, skip others, and finish. Set logs exist for logged sets only, last weights changed only
for the planned sets that were logged, and the next session in the same block shows the new
suggested weights.

### Acceptance tests (write first, confirm red)

- [x] T023 [US2] Add contract-signature stubs throwing `not implemented` in `src/features/fitness-tracker/server/activation.ts` (`activateProgram`) and `src/features/fitness-tracker/server/training.ts` (`getTrainingOverview`, `startWorkout`, `getSession`, `logSet`, `finishWorkout`), with the `TrainingOverview`, `SessionView`, `SetLog` and `Cycle` types in `src/features/fitness-tracker/server/types.ts`.
- [x] T024 [US2] Write `src/features/fitness-tracker/server/training.storage.test.ts` with:
  - US2 scenario 2, the domain scenario "New exercise, no history", rule 14: an unlogged slot shows targets and `suggestedWeightKg: null`.
  - US2 scenario 3, the domain scenario "Skipping keeps last weight", rule 11: last weight 20 kg; finish without logging; no set log, and it stays 20 kg.
  - US2 scenario 4, rules 15–16: log 10 reps at 40 kg on set 2. The set log carries the full context (program, cycle, cycle number, training block ID, block number, workout, slot, session), and only that planned set's last weight is 40. Another slot with the same exercise, and the same slot in another block, are unchanged.
  - US2 scenario 5: chin-ups, 8 reps, no weight. The set log has `weightKg: null` and last weight becomes null.
  - US2 scenario 6, rule 10: four workouts, two finished; the suggestion is the first unfinished one in order, and any unfinished one can be started.
  - US2 scenario 7, rule 12: finishing with zero sets logged marks the session finished.
  - Edge cases:
    - Starting a workout already in progress returns the same session ID.
    - Starting a finished workout in the same block is refused `workout-already-finished`.
    - Logging in a finished session is refused `session-not-in-progress`.
    - Logging a planned set from another block or workout is refused `planned-set-not-in-session`.
    - Logging the same planned set twice creates two set logs, and the later weight wins.
    - A workout with no slots can be started and finished.
  - Activation, rules 1 and 3: activating a program with no active cycle starts cycle 1 at block 1 (`status: 'active'`, `startedAt = now`). Activating an incomplete program is refused `program-incomplete`. Activating the already-active program changes nothing.

  Run and confirm red.

### Implementation

- [x] T025 [P] [US2] Test-first: `src/features/fitness-tracker/domain/session.test.ts`, then `src/features/fitness-tracker/domain/session.ts`:
  - `decideStartWorkout({ workoutId, programWorkoutIds, existingSession })` returns `resume`, `create`, or the refusal `workout-not-in-active-program` / `workout-already-finished` (rule 10, FR-024).
  - `suggestedNextWorkout(workoutsInOrder, sessionsInBlock)`: the first workout without a finished session, or null (FR-025).
  - `workoutStatuses(…)`: `not-started` | `in-progress` | `finished` per workout.
- [x] T026 [P] [US2] Test-first: `src/features/fitness-tracker/domain/logging.test.ts`, then `src/features/fitness-tracker/domain/logging.ts`:
  - `prefill(plannedSets)`: maps `lastWeightGrams` to `suggestedWeightKg`, null when empty (rule 14).
  - `decideLogSet({ session, plannedSet, slot, input, now })`: validates reps and weight with `values.ts`; refuses `session-not-in-progress` or `planned-set-not-in-session` (the planned set's slot must belong to the session's workout, and its block must hold the session's block number); returns `{ setLog, newLastWeightGrams }` (rules 15–16).
- [x] T027 [US2] Implement `activateProgram` in `src/features/fitness-tracker/server/activation.ts`:
  - Refuse `program-incomplete` via `isActivatable`.
  - If the program is already active, return its active cycle unchanged.
  - Otherwise, in **one batch**: set `profiles.active_program_id`; end the previously active program's active cycle as `ended_early` with `ended_at = now`, finishing its in-progress sessions with `finished_at = now`; and if the target program has no active cycle, insert cycle `number = max + 1` (1 if none) at `current_block_number = 1`.

  Put the "decide transitions" part in a pure function in `src/features/fitness-tracker/domain/progression.ts` (`decideActivation`), test-first in `progression.test.ts` (rules 1–3, FR-015).

- [x] T028 [US2] Implement the training operations in `src/features/fitness-tracker/server/training.ts`:
  - `getTrainingOverview`: null when there is no active program.
  - `startWorkout`: insert a session with `cycle_number`, `block_number` and `status 'in_progress'`, or resume an existing one; map a unique violation on `(cycle_id, block_number, workout_id)` to a resume.
  - `getSession`: three indexed reads per research R11 (session; slots joined to exercises; planned sets for the block's `training_block_id`), plus this session's set logs, built into `SessionView` with `prefill`.
  - `logSet`: one batch that inserts the `set_logs` row and updates `planned_sets.last_weight_grams` (FR-029).
  - `finishWorkout`: sets `status 'finished'` and `finished_at = now`, and returns `{ progression: 'none' }`. US3 adds progression.

  Also fill `activeCycle` in `getProgram` (T021).

- [x] T029 [US2] Run T024 unmodified until green, then run `scripts/check.ps1`.

**Checkpoint**: User Stories 1 and 2 both work. A program can be built, activated and trained with prefill.

---

## Phase 5: User Story 3 — Progress through blocks and cycles (Priority: P2)

**Goal**: block advancement, cycle completion with automatic restart, start over, pause, switching
programs, and closing in-progress sessions when a cycle ends.

**Independent test**: activate a program and finish every workout of each block in turn. The
current block advances, the last block completes the cycle and starts cycle n+1 at block 1, and
start over, pause and switching programs end cycles as specified, with all history intact.

### Acceptance tests (write first, confirm red)

- [x] T030 [US3] Add contract-signature stubs throwing `not implemented` for `pauseActiveProgram`, `startOver` and `listCycles` in `src/features/fitness-tracker/server/activation.ts`.
- [x] T031 [US3] Write `src/features/fitness-tracker/server/cycles.storage.test.ts` with:
  - US3 scenario 1, the domain scenario "Block progression", rules 6–7: block 2 with 3 of 4 finished; finishing the fourth gives `progression: 'block-advanced'` and `currentBlockNumber` 3.
  - US3 scenario 2, the domain scenario "Cycle completion", rule 7: finishing the last workout of the last block gives `'cycle-completed'`. The cycle is `completed` with `endedAt`, and cycle n+1 is `active` at block 1.
  - US3 scenario 3, the domain scenario "Start over after a break", rules 8–9: after blocks 1 and 2, `startOver` gives an `ended_early` cycle with `currentBlockNumber` 3, a new cycle at block 1, and every earlier set log and session unchanged.
  - US3 scenario 4, rule 2: activating B ends A's cycle `ended_early`, and B gets an active cycle at block 1, or keeps its existing active cycle.
  - US3 scenario 5, rule 2: `pauseActiveProgram` leaves no active program and ends the cycle `ended_early`; `startOver` and `pauseActiveProgram` with nothing active are refused `no-active-program`.
  - US3 scenario 6, rule 13: a session in progress when its cycle ends (completion, start over, pause or switch) is closed as `finished`.
  - US2 scenario 1, the domain scenario "Prefill from the previous cycle", rule 14: block 1 is 3×12 incline bench; log 65, 62 and 60 kg in cycle 1; complete the cycle; in cycle 2 block 1, Upper A shows 65, 62 and 60. It sits here because reaching cycle 2 needs this story.
  - Rule 20: an optional slot that is never logged doesn't stop the block completing.
  - Cycle numbers are 1, 2, 3… across completion and start over (rule 5).

  Run and confirm red.

### Implementation

- [x] T032 [US3] Test-first: extend `src/features/fitness-tracker/domain/progression.test.ts`, then `src/features/fitness-tracker/domain/progression.ts`, with:
  - `isBlockComplete(workoutIds, finishedWorkoutIdsInBlock)`: false when there are no workouts (rule 6).
  - `decideAfterFinish({ cycle, blockCount, workoutIds, finishedInBlock, now })` returns `none` | `advance(to)` | `complete(newCycleNumber)` (rule 7).
  - `decideStartOver(cycle, now)` (rule 8).
  - `decidePause(cycle, now)` (rule 2).
  - `reevaluateAfterEdit({ cycle, blockCount, workoutIds, finishedInBlock })`: clamps `currentBlockNumber` to `blockCount`, then applies `decideAfterFinish` (research R9, FR-039).

  Every ending transition lists the in-progress session IDs to close (rule 13).

- [x] T033 [US3] Implement `pauseActiveProgram`, `startOver` and `listCycles` in `src/features/fitness-tracker/server/activation.ts`. Each transition is one batch that updates the cycle, closes in-progress sessions, inserts any new cycle and updates the profile.
- [x] T034 [US3] Extend `finishWorkout` in `src/features/fitness-tracker/server/training.ts` so it applies `decideAfterFinish` in the **same batch** as finishing the session, and returns `'block-advanced'` or `'cycle-completed'` (FR-027). The new cycle on completion starts at block 1 with `started_at = now`.
- [x] T035 [US3] Run T031 unmodified until green, re-run T024 to confirm US2 is still green, then run `scripts/check.ps1`.

**Checkpoint**: Stories 1–3 work. The full training loop runs across cycles.

---

## Phase 6: User Story 4 — Edit programs without losing history (Priority: P2)

**Goal**: replacing exercises, deleting programs and exercises, and structural edits mid-cycle, all
without changing any set log or session, plus exercise history.

**Independent test**: log sets against a program, then apply every kind of edit, including deleting
the program. Every set log and session is unchanged and readable, and last weights were cleared only
where the rules say.

### Acceptance tests (write first, confirm red)

- [x] T036 [US4] Add contract-signature stubs throwing `not implemented` for `replaceSlotExercise`, `removeTrainingBlock`, `removeWorkout` and `deleteProgram` in `src/features/fitness-tracker/server/programs.ts`; `deleteExercise` in `src/features/fitness-tracker/server/exercises.ts`; and `getExerciseHistory` in a new `src/features/fitness-tracker/server/history.ts`.
- [x] T037 [US4] Write `src/features/fitness-tracker/server/history.storage.test.ts` with:
  - US4 scenario 1, the domain scenario "Replacing an exercise", rule 18: seal rows has last weights in several blocks; replace it with machine rows; every planned set of the slot in every block is null, and `getExerciseHistory(seal rows)` still returns its set logs.
  - US4 scenario 2, rule 19: sets 1–3 have last weights; `setPrescription` to four sets keeps sets 1–3 and gives set 4 null.
  - US4 scenario 3, FR-034: `deleteProgram` on a program with history; all its set logs and sessions remain, unchanged field by field, and `getExerciseHistory` still returns them with the exercise name.
  - US4 scenario 4, FR-005: `deleteExercise` on an exercise with set logs, or used in a slot, is refused `exercise-in-use`; archiving it keeps its history readable; deleting an unused exercise succeeds.
  - FR-033: a direct `db.update(setLogs)` and a direct `db.delete(setLogs)` both reject (the triggers).
  - FR-039 edge cases:
    - Removing the only unfinished workout of the current block advances the cycle.
    - Adding a workout mid-block keeps the block incomplete until it is finished.
    - Removing blocks below the current block number moves the cycle to the new last block.
    - `removeTrainingBlock` on the last remaining block is refused `program-needs-a-block`.
  - Deleting the active program leaves the profile with no active program (edge case).
  - Rule 17: a program edit after a session leaves that session and its set logs unchanged.

  Run and confirm red.

### Implementation

- [x] T038 [P] [US4] Test-first: extend `src/features/fitness-tracker/domain/program.test.ts`, then `program.ts`, with `clearLastWeightsForSlot(plannedSets)` (rule 18) and the block and workout removal transforms that renumber positions.
- [x] T039 [P] [US4] Test-first: `src/features/fitness-tracker/domain/history.test.ts`, then `src/features/fitness-tracker/domain/history.ts`. `groupByBlockAcrossCycles(setLogs)` groups by `trainingBlockId`, then by `cycleNumber`, ordered by `performedAt`, and gives sets × reps × weight per group (FR-035).
- [x] T040 [US4] Implement in `src/features/fitness-tracker/server/programs.ts`:
  - `replaceSlotExercise`: refuses `exercise-archived`; one batch updates the slot and nulls `last_weight_grams` on every planned set of the slot.
  - `removeTrainingBlock`, `removeWorkout`, and the existing `moveTrainingBlock`/`moveWorkout`: when the program has an active cycle, the same batch applies `reevaluateAfterEdit` from T032.
  - `deleteProgram`: one batch that clears `profiles.active_program_id` if it is this program and deletes the program (cascades to its tree and cycles). It never touches `workout_sessions` or `set_logs`.
- [x] T041 [US4] Implement `deleteExercise` in `src/features/fitness-tracker/server/exercises.ts`, refusing `exercise-in-use` if any `exercise_slots` or `set_logs` row refers to it. Implement `getExerciseHistory` in `src/features/fitness-tracker/server/history.ts`: one query on the `(profile_id, exercise_id, performed_at)` index, mapped with `toSetLog`, plus the exercise name.
- [x] T042 [US4] Run T037 unmodified until green, re-run T017, T024 and T031, then run `scripts/check.ps1`.

**Checkpoint**: Stories 1–4 work. History is provably safe from every edit.

---

## Phase 7: User Story 5 — Record daily bodyweight (Priority: P3)

**Goal**: at most one bodyweight entry per calendar day in the user's time zone, never required.

**Independent test**: record a weigh-in; a second one the same local day is refused; after local
midnight a weigh-in is available again.

### Acceptance tests (write first, confirm red)

- [x] T043 [US5] Add contract-signature stubs throwing `not implemented` for `getWeighInStatus`, `recordBodyweight` and `listBodyweight` in `src/features/fitness-tracker/server/bodyweight.ts`.
- [x] T044 [US5] Write `src/features/fitness-tracker/server/bodyweight.storage.test.ts` with:
  - US5 scenario 1 and the domain scenario "Daily weigh-in", rule 22: no entry today means `isAvailable: true`.
  - US5 scenario 2, rule 21: after `recordBodyweight`, `isAvailable` is false, and a second record is refused `already-weighed-in-today`.
  - US5 scenario 3: record at 23:30 `Europe/Stockholm`; at 00:10 local the next day it is available and recording succeeds.
  - `invalid-time-zone` for `'Mars/Olympus'`, and `invalid-weight` for 0.
  - `listBodyweight` is sorted by date.

  Run and confirm red.

### Implementation

- [x] T045 [P] [US5] Test-first: `src/features/fitness-tracker/domain/bodyweight.test.ts`, then `src/features/fitness-tracker/domain/bodyweight.ts`. `weighInStatus(todayEntryExists, today)` and `decideRecordBodyweight({ weightKg, now, timeZone, todayEntryExists })` use `localDate` and `parseWeightKg` (rules 21–22).
- [x] T046 [US5] Implement `getWeighInStatus`, `recordBodyweight` and `listBodyweight` in `src/features/fitness-tracker/server/bodyweight.ts`. Map a unique violation on `(profile_id, entry_date)` to `already-weighed-in-today`.
- [x] T047 [US5] Run T044 unmodified until green, then run `scripts/check.ps1`.

**Checkpoint**: all five user stories work.

---

## Phase 8: Polish and cross-cutting concerns

- [x] T048 [P] Write `src/features/fitness-tracker/server/isolation.storage.test.ts` (SC-007, FR-001). Use two profiles, A and B. Every read or write operation in the contract, called by B with A's IDs (exercise, program, block, workout, slot, planned set, session), returns `not-found` or an empty result, and A's rows are unchanged afterwards.
- [x] T049 [P] Write `src/features/fitness-tracker/server/atomicity.storage.test.ts` (SC-004, FR-029). Make the second statement of `logSet`'s batch fail:
  - In the test, create `CREATE TRIGGER test_block_last_weight BEFORE UPDATE ON planned_sets BEGIN SELECT RAISE(ABORT, 'forced'); END;` with `db.run(sql…)`.
  - Call `logSet` and expect it to throw.
  - Assert that no set log exists for the session and the last weight is unchanged.
  - Drop the trigger in `finally`. Storage files don't run in parallel, per T005.

  Add no production code for this test.

- [x] T050 [P] Write `src/features/fitness-tracker/server/performance.storage.test.ts`:
  - SC-005: seed a program of 10 workouts × 10 slots × 10 blocks × 10 planned sets through the operations; `getSession` completes in under 1000 ms.
  - SC-006: bulk-insert 100,000 `set_logs` rows for one exercise in batches of ≤ 500 rows, straight through Drizzle in the test; `getExerciseHistory` plus `groupByBlockAcrossCycles` completes in under 2000 ms.

  Measure with `performance.now()`. Mark the file with `describe.concurrent` off and a 120 s timeout.

- [x] T051 Verify SC-002 coverage: for every rule 1–22, `rg "rule N[^0-9]" src/features/fitness-tracker` finds at least one test. Add any missing test before continuing.
- [x] T052 [P] Create `docs/architecture/006-domain-persistence.md` (status accepted, date of merge) recording:
  - Drizzle 0.45 / drizzle-kit 0.31, with `out: migrations` and the baseline removal.
  - `getDatabase()` and the database-as-parameter pattern.
  - `batch` for atomicity, and the read-then-batch race accepted for one user.
  - Immutability triggers.
  - The `storage` Vitest project via `getPlatformProxy`, including the measured gate time.
  - The functional-core layout of `src/features/<feature>/domain` and `server`.
  - `Result` codes for refusals.

  Then replace the "D1 with Wrangler migrations; Drizzle when there is a schema" paragraph in `docs/architecture/004-hosting-and-persistence.md` with a short pointer to 006.

- [x] T053 [P] Update `docs/architecture/003-development-workflow.md`. Add a section on domain-only features (constitution 2.1.0): the spec's acceptance scenarios are Vitest tests written first and confirmed red, and are done when green unmodified. Name the `storage` project and the `*.storage.test.ts` suffix. State that the per-story outer loop keeps `check.ps1` green between stories.
- [x] T054 [P] Update `CLAUDE.md`:
  - **Project state**: Drizzle, `src/features/fitness-tracker/` with `domain/` and `server/`, the eleven tables, and `src/lib/server/database.ts`.
  - **Testing**: the third Vitest project, `storage`.
  - **Not built yet**: remove Drizzle and `src/features/`; keep `src/components/`, fitness screens and PR checks.

  Do not remove the Next.js agent block at the end of the file.

- [x] T055 [P] Update `.claude/skills/test/SKILL.md` and `.claude/skills/check/SKILL.md`: when to write a `*.storage.test.ts`, the harness in `storage-test-database.ts`, that tests isolate by fresh profile, and that the gate now includes the `storage` project.
- [ ] T056 Change the last note in `specs/002-fitness-domain-model/checklists/requirements.md`. Replace "`/speckit-plan` must justify this in Complexity Tracking" with a note that the feature is domain-only under constitution 2.1.0.
- [x] T057 Run [quickstart.md](quickstart.md) §1–§5 end to end:
  - `drizzle-kit generate` reports no changes.
  - The trigger rejects `UPDATE set_logs`.
  - `scripts/check.ps1` exits 0, and its added time is under 10 s (or the overrun is recorded in 006).
  - `npx opennextjs-cloudflare build` followed by `npx wrangler deploy --dry-run` reports a compressed size under 3 MiB. Record the new number in 006.

---

## Dependencies and execution order

### Phase dependencies

- **Setup (Phase 1)**: none. T007 runs after T009, and T008's smoke test needs T009 and T010.
- **Foundational (Phase 2)**: needs Phase 1, and blocks every story.
- **US1 (Phase 3)**: needs Phase 2.
- **US2 (Phase 4)**: needs US1, which builds the programs it trains.
- **US3 (Phase 5)**: needs US2 (`activateProgram`, `finishWorkout`).
- **US4 (Phase 6)**: needs US1 for structure edits, and US2 and US3 for the logged history and active cycles its tests edit against.
- **US5 (Phase 7)**: needs only Phase 2. It can run in parallel with US1–US4.
- **Polish (Phase 8)**: needs every story it covers. T048–T050 need US1–US5.

### Story dependency graph

```text
Setup → Foundational ─┬─▶ US1 ─▶ US2 ─▶ US3 ─▶ US4 ─┐
                      └─▶ US5 ──────────────────────┴─▶ Polish
```

The stories aren't fully independent, and that's by nature of the domain: you can't train
without a program, or end a cycle without training. Each story still ends in a green, verifiable
increment.

### Within each story

1. Stubs, then acceptance tests, confirmed red for the intended reason.
2. Pure domain functions, test-first ([P] across different files).
3. Server operations.
4. Acceptance tests green unmodified, then `scripts/check.ps1` exits 0.

## Parallel opportunities

- **Phase 1**: T002, T003 and T004 together.
- **Phase 2**: T011, T012 and T013 together, once T009 is written.
- **US1**: T016 and T017 together; then T018 and T019 together.
- **US2**: T025 and T026 together.
- **US4**: T038 and T039 together.
- **US5**: the whole phase can run beside US1–US4, after Phase 2.
- **Polish**: T048, T049, T050, T052, T053, T054 and T055 together.

### Parallel example: User Story 1

```text
Task: "T016 [US1] exercises.storage.test.ts — catalog acceptance tests"
Task: "T017 [US1] programs.storage.test.ts — program structure acceptance tests"
# then
Task: "T018 [US1] domain/exercise.ts test-first"
Task: "T019 [US1] domain/program.ts test-first"
```

### Parallel example: User Story 5 beside US2

```text
Developer A: T023 → T029 (US2 training)
Developer B: T043 → T047 (US5 bodyweight)
```

## Implementation strategy

### MVP first

1. Phase 1 and Phase 2: Drizzle, schema, migrations, harness, values, profiles.
2. Phase 3 (US1): a periodized program can be built and read back.
3. **Stop and validate**: run T016 and T017 green and `check.ps1` at 0. This is a mergeable
   increment, because merging deploys, and the migration runs on remote D1 in CI.

### Incremental delivery

Each story phase ends green and is a safe point to commit and open a PR: US1 → US2 → US3 → US4, with
US5 at any point after Phase 2. The program-builder and training features can start once US1 and
US2/US3 have landed.

### Notes

- Never edit an acceptance test to make it pass. If a test is wrong, fix the spec first and record
  why.
- Every migration change goes through `drizzle-kit generate` (or `--custom`); never hand-edit
  generated SQL.
- Merging to `main` runs `wrangler d1 migrations apply --remote`. Check the generated SQL in the
  PR before merging.
